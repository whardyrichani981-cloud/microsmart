'use client'
/**
 * ImportExcelModal — carga masiva desde Excel (.xlsx/.xls) o CSV
 * Reutilizable: recibe las columnas esperadas, parsea el archivo y hace POST por fila.
 */
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { C } from './shared'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ColDef {
  key: string          // nombre interno
  label: string        // nombre a mostrar
  aliases?: string[]   // nombres alternativos que se aceptan en el header del archivo
  required?: boolean
  type?: 'string' | 'number' | 'boolean'
  default?: unknown
}

interface ImportExcelModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title: string
  color: string
  cols: ColDef[]
  apiEndpoint: string               // ej: '/api/sistema/stock'
  buildPayload: (row: Record<string, unknown>) => Record<string, unknown>
  templateRows?: Record<string, unknown>[]  // filas de ejemplo para la plantilla
  templateFilename?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function matchHeader(raw: string, col: ColDef): boolean {
  const norm = raw.toLowerCase().trim().replace(/[^a-z0-9áéíóúñü]/g, '')
  const names = [col.key, ...(col.aliases ?? [])].map(s => s.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, ''))
  return names.includes(norm)
}

function castValue(v: unknown, type: ColDef['type']): unknown {
  if (v === undefined || v === null || v === '') return undefined
  if (type === 'number') {
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  if (type === 'boolean') {
    const s = String(v).toUpperCase().trim()
    return s !== 'NO' && s !== '0' && s !== 'FALSE'
  }
  return String(v).trim()
}

function downloadTemplate(cols: ColDef[], rows: Record<string, unknown>[], filename: string) {
  const headers = cols.map(c => c.key)
  const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(data)
  // Style header row width
  ws['!cols'] = headers.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ImportExcelModal({
  open, onClose, onSuccess,
  title, color, cols, apiEndpoint, buildPayload,
  templateRows = [], templateFilename = 'plantilla-importacion.xlsx',
}: ImportExcelModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [errors, setErrors] = useState<string[]>([])          // por fila ('' = ok)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ ok: number; fail: number } | null>(null)
  const [step, setStep] = useState<'idle' | 'preview' | 'done'>('idle')

  function reset() {
    setRows([]); setErrors([]); setFileName(''); setImporting(false)
    setDone(null); setStep('idle')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() { reset(); onClose() }

  function parseFile(file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        if (raw.length === 0) { alert('El archivo está vacío o no tiene filas.'); return }

        // Map raw headers → col keys
        const sampleKeys = Object.keys(raw[0])
        const mapping: Record<string, string> = {}   // rawKey → col.key
        for (const rk of sampleKeys) {
          for (const col of cols) {
            if (matchHeader(rk, col)) { mapping[rk] = col.key; break }
          }
        }

        // Check required cols are present
        const foundKeys = new Set(Object.values(mapping))
        const missing = cols.filter(c => c.required && !foundKeys.has(c.key)).map(c => c.label)
        if (missing.length) {
          alert(`Columnas requeridas no encontradas: ${missing.join(', ')}.\n\nUsá la plantilla para asegurarte de tener los encabezados correctos.`)
          return
        }

        // Parse rows
        const parsed: Record<string, unknown>[] = []
        const errs: string[] = []
        for (const rawRow of raw) {
          const row: Record<string, unknown> = {}
          // Fill from mapping
          for (const [rk, ck] of Object.entries(mapping)) {
            const col = cols.find(c => c.key === ck)!
            row[ck] = castValue(rawRow[rk], col.type)
          }
          // Apply defaults for missing cols
          for (const col of cols) {
            if (!(col.key in row) || row[col.key] === undefined) {
              row[col.key] = col.default ?? (col.type === 'number' ? 0 : col.type === 'boolean' ? true : '')
            }
          }
          // Validate required
          const rowErr = cols.filter(c => c.required && !row[c.key]).map(c => c.label).join(', ')
          errs.push(rowErr ? `Falta: ${rowErr}` : '')
          parsed.push(row)
        }

        setRows(parsed); setErrors(errs); setFileName(file.name); setStep('preview')
      } catch (e) {
        alert('No se pudo leer el archivo. Asegurate de que sea un Excel (.xlsx) o CSV válido.')
        console.error(e)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    setImporting(true)
    let ok = 0, fail = 0
    for (let i = 0; i < rows.length; i++) {
      if (errors[i]) { fail++; continue }
      try {
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(rows[i])),
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    setDone({ ok, fail }); setStep('done'); setImporting(false)
    if (ok > 0) onSuccess()
  }

  const validRows = rows.filter((_, i) => !errors[i])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 860,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>📥 {title}</div>
            {step === 'preview' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                {rows.length} fila{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''} · {validRows.length} válida{validRows.length !== 1 ? 's' : ''}
                {rows.length - validRows.length > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {rows.length - validRows.length} con error</span>}
              </div>
            )}
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20, padding: '4px 8px', borderRadius: 6 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* STEP: idle */}
          {step === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = color }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                onDrop={e => {
                  e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'
                  const f = e.dataTransfer.files[0]
                  if (f) parseFile(f)
                }}
                style={{
                  width: '100%', maxWidth: 500, padding: '40px 24px',
                  border: `2px dashed var(--border)`, borderRadius: 14,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: 40 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Arrastrá tu archivo aquí</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>o hacé clic para buscarlo</div>
                <div style={{ fontSize: 11, color: C.muted }}>Formatos aceptados: .xlsx, .xls, .csv</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />

              {/* Columns info */}
              <div style={{ width: '100%', maxWidth: 500 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columnas esperadas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cols.map(c => (
                    <span key={c.key} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 99,
                      background: c.required ? `${color}18` : 'var(--surface2)',
                      color: c.required ? color : C.muted,
                      border: `1px solid ${c.required ? `${color}40` : 'var(--border)'}`,
                      fontWeight: c.required ? 700 : 400,
                    }}>
                      {c.label}{c.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>* Requerido · El resto son opcionales</div>
              </div>

              {/* Download template */}
              {templateRows.length > 0 && (
                <button
                  onClick={() => downloadTemplate(cols, templateRows, templateFilename)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                    borderRadius: 9, border: `1px solid ${color}44`, background: `${color}10`,
                    color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  📄 Descargar plantilla Excel
                </button>
              )}
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Archivo: <strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong></div>
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ padding: '8px 10px', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', width: 32 }}>#</th>
                      {cols.map(c => (
                        <th key={c.key} style={{ padding: '8px 10px', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {c.label.toUpperCase()}
                        </th>
                      ))}
                      <th style={{ padding: '8px 10px', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)' }}>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--row-border)', background: errors[i] ? 'rgba(239,68,68,0.04)' : '' }}>
                        <td style={{ padding: '6px 10px', color: C.muted, fontSize: 11 }}>{i + 1}</td>
                        {cols.map(c => (
                          <td key={c.key} style={{ padding: '6px 10px', color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(row[c.key] ?? '—')}
                          </td>
                        ))}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {errors[i]
                            ? <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>✕ {errors[i]}</span>
                            : <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>✓ OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && done && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
              <div style={{ fontSize: 48 }}>{done.fail === 0 ? '🎉' : done.ok === 0 ? '❌' : '⚠️'}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {done.ok > 0 ? `${done.ok} registro${done.ok !== 1 ? 's' : ''} importado${done.ok !== 1 ? 's' : ''}` : 'Sin registros importados'}
              </div>
              {done.fail > 0 && <div style={{ fontSize: 13, color: '#fb923c' }}>{done.fail} fila{done.fail !== 1 ? 's' : ''} con error omitida{done.fail !== 1 ? 's' : ''}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          {step === 'idle' && (
            <button onClick={handleClose} style={{ padding: '8px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={reset} style={{ padding: '8px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Volver</button>
              <button
                onClick={doImport}
                disabled={importing || validRows.length === 0}
                style={{
                  padding: '8px 24px', borderRadius: 9, border: 'none',
                  background: validRows.length === 0 ? 'var(--surface2)' : color,
                  color: validRows.length === 0 ? C.muted : '#fff',
                  cursor: validRows.length === 0 || importing ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                {importing ? 'Importando…' : `Importar ${validRows.length} fila${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={handleClose} style={{ padding: '8px 24px', borderRadius: 9, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  )
}
