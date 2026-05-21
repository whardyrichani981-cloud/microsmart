'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { matchesAny } from '@/lib/search'
import type { Servicio, TipoServicioGremio } from '@/lib/sistema-types'
import {
  useApi, fmtARS,
  C, Modal, Field, FormGrid, PageHeader, Badge, KPICard,
  inputSt,
} from './shared'

const COLOR = '#60a5fa'
const COLOR_GREMIO = '#a78bfa'
const COLOR_CSF = '#4ade80'

type FormState = Omit<Servicio, 'id' | 'createdAt'>

function buildEmpty(): FormState {
  return { tipo: 'Gremio', nombre: '', descripcion: '', precio: 0, categoria: '', activo: true }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const CSV_HEADERS = ['tipo', 'nombre', 'categoria', 'precio', 'descripcion', 'activo']

function escapeField(v: string) {
  return `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
}

function exportCSV(list: Servicio[]) {
  const rows = [
    CSV_HEADERS,
    ...list.map(s => [
      s.tipo ?? 'Gremio',
      s.nombre ?? '',
      s.categoria ?? '',
      String(s.precio ?? 0),
      s.descripcion ?? '',
      s.activo ? 'SI' : 'NO',
    ]),
  ]
  const csv = '﻿' + rows.map(r => r.map(escapeField).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `servicios-microsmart-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportTemplate() {
  // Only the header row + one example row per type
  const rows = [
    CSV_HEADERS,
    ['Gremio', 'Cambio pantalla iPhone 15', 'Cambio pantalla', '45000', 'Incluye mano de obra', 'SI'],
    ['Cliente final', 'Cambio pantalla iPhone 15', 'Cambio pantalla', '65000', 'Incluye pantalla y mano de obra', 'SI'],
  ]
  const csv = '﻿' + rows.map(r => r.map(escapeField).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-servicios-microsmart.csv'
  a.click()
  URL.revokeObjectURL(url)
}

interface ParsedRow {
  tipo: TipoServicioGremio
  nombre: string
  categoria: string
  precio: number
  descripcion: string
  activo: boolean
  _error?: string
}

function parseCSV(text: string): ParsedRow[] {
  // Remove BOM if present
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect separator (semicolon or comma)
  const sep = lines[0].includes(';') ? ';' : ','

  // Parse a single CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === sep && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  const headerRaw = parseLine(lines[0]).map(h => h.toLowerCase().trim())
  const idx = (name: string) => headerRaw.indexOf(name)

  const iNombre = idx('nombre')
  const iTipo = idx('tipo')
  const iCategoria = idx('categoria')
  const iPrecio = idx('precio')
  const iDescripcion = idx('descripcion')
  const iActivo = idx('activo')

  if (iNombre === -1) return []

  return lines.slice(1).map(line => {
    const cols = parseLine(line)
    const nombre = cols[iNombre]?.trim() ?? ''
    if (!nombre) return null

    const tipoRaw = (iTipo !== -1 ? cols[iTipo] : '').trim().toLowerCase()
    const tipo: TipoServicioGremio =
      tipoRaw === 'cliente final' ? 'Cliente final' : 'Gremio'

    const categoria = iCategoria !== -1 ? cols[iCategoria]?.trim() ?? '' : ''
    const precioRaw = iPrecio !== -1 ? cols[iPrecio]?.trim() ?? '0' : '0'
    const precio = parseFloat(precioRaw.replace(',', '.')) || 0
    const descripcion = iDescripcion !== -1 ? cols[iDescripcion]?.trim() ?? '' : ''
    const activoRaw = iActivo !== -1 ? cols[iActivo]?.trim().toUpperCase() : 'SI'
    const activo = activoRaw !== 'NO' && activoRaw !== '0' && activoRaw !== 'FALSE'

    return { tipo, nombre, categoria, precio, descripcion, activo } as ParsedRow
  }).filter(Boolean) as ParsedRow[]
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ServiciosView() {
  const { data, loading, refresh } = useApi<Servicio[]>('/api/sistema/servicios')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TipoServicioGremio>('Gremio')

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importRows, setImportRows] = useState<ParsedRow[]>([])
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add')
  const [importModal, setImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<{ added: number; replaced: number } | null>(null)

  const list = data ?? []

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  const openNew = () => {
    setForm({ ...buildEmpty(), tipo: activeTab })
    setEditId(null)
    setModal('new')
  }

  const openEdit = (s: Servicio) => {
    const { id, createdAt, ...rest } = s
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/servicios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch(`/api/sistema/servicios/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (s: Servicio) => {
    if (!confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return
    await fetch(`/api/sistema/servicios/${s.id}`, { method: 'DELETE' })
    await refresh()
  }

  const toggleActivo = async (s: Servicio) => {
    await fetch(`/api/sistema/servicios/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, activo: !s.activo }),
    })
    await refresh()
  }

  // ─── Import handlers ────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    if (isExcel) {
      // Parse Excel with xlsx library → convert to CSV text and reuse parseCSV
      const reader = new FileReader()
      reader.onload = ev => {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const csv  = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
        const rows = parseCSV(csv)
        setImportRows(rows); setImportMode('add'); setImportDone(null); setImportModal(true)
      }
      reader.readAsArrayBuffer(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setImportRows(rows)
      setImportMode('add')
      setImportDone(null)
      setImportModal(true)
    }
    reader.readAsText(file, 'UTF-8')
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const doImport = async () => {
    if (!importRows.length) return
    setImporting(true)
    try {
      let replaced = 0
      if (importMode === 'replace') {
        // Delete all existing services of each tipo present in the import
        const tiposEnArchivo = new Set(importRows.map(r => r.tipo))
        const toDelete = list.filter(s => tiposEnArchivo.has(s.tipo as TipoServicioGremio))
        await Promise.all(
          toDelete.map(s => fetch(`/api/sistema/servicios/${s.id}`, { method: 'DELETE' }))
        )
        replaced = toDelete.length
      }
      // Add all rows
      await Promise.all(
        importRows.map(row =>
          fetch('/api/sistema/servicios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(row),
          })
        )
      )
      await refresh()
      setImportDone({ added: importRows.length, replaced })
    } finally {
      setImporting(false)
    }
  }

  const closeImport = () => {
    setImportModal(false)
    setImportRows([])
    setImportDone(null)
  }

  // ─── Lists ──────────────────────────────────────────────────────────────────
  const gremioList = list.filter(s => (s.tipo ?? 'Gremio') === 'Gremio')
  const csfList = list.filter(s => s.tipo === 'Cliente final')
  const tabList = activeTab === 'Gremio' ? gremioList : csfList
  const COLOR_TAB = activeTab === 'Gremio' ? COLOR_GREMIO : COLOR_CSF

  const filtered = tabList.filter(s =>
    !search.trim() || matchesAny([s.nombre, s.categoria, s.descripcion], search)
  )

  const activos = tabList.filter(s => s.activo).length
  const categorias = new Set(tabList.map(s => s.categoria).filter(Boolean)).size

  // Import preview split by tipo
  const importGremio = importRows.filter(r => r.tipo === 'Gremio')
  const importCSF = importRows.filter(r => r.tipo === 'Cliente final')

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon="🛠"
        title="Catálogo de Servicios"
        desc="Servicios y mano de obra"
        color={COLOR}
        count={list.length}
        onNew={openNew}
        newLabel="Nuevo Servicio"
      />

      {/* Pestañas Gremio / Cliente final */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['Gremio', 'Cliente final'] as TipoServicioGremio[]).map(tab => {
          const isActive = activeTab === tab
          const col = tab === 'Gremio' ? COLOR_GREMIO : COLOR_CSF
          const cnt = tab === 'Gremio' ? gremioList.length : csfList.length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500,
                background: 'none', borderBottom: isActive ? `2px solid ${col}` : '2px solid transparent',
                color: isActive ? col : C.muted, marginBottom: -1, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {tab === 'Gremio' ? '🔧' : '👤'} {tab}
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: isActive ? `${col}22` : 'transparent', color: isActive ? col : C.muted, fontWeight: 700 }}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total servicios" value={String(tabList.length)} color={COLOR_TAB} icon="🛠" />
        <KPICard label="Activos" value={String(activos)} color="#4ade80" icon="✅" />
        <KPICard label="Categorías" value={String(categorias)} color="#a78bfa" icon="📂" />
      </div>

      {/* Search + Import/Export */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, categoría, descripción..."
          style={{ ...inputSt, maxWidth: 360, flex: 1 }}
        />

        {/* Export current */}
        <button
          onClick={() => exportCSV(list)}
          title="Exportar todos los servicios a CSV (compatible con Excel)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-primary)', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR; e.currentTarget.style.color = COLOR }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        >
          ⬇ Exportar lista
        </button>

        {/* Download template */}
        <button
          onClick={exportTemplate}
          title="Descargar plantilla CSV vacía con el formato correcto"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          📄 Plantilla
        </button>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Importar servicios desde un archivo CSV"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.08)',
            color: '#4ade80', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.background = 'rgba(74,222,128,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)'; e.currentTarget.style.background = 'rgba(74,222,128,0.08)' }}
        >
          ⬆ Importar Excel / CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          {search ? 'Sin resultados para la búsqueda' : 'No hay servicios aún. Creá el primero.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['NOMBRE', 'CATEGORÍA', 'DESCRIPCIÓN', 'PRECIO', 'ESTADO', 'ACCIONES'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--row-border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{s.nombre}</span>
                  </td>
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                    {s.categoria ? (
                      <Badge label={s.categoria} color={COLOR_TAB} />
                    ) : (
                      <span style={{ color: C.muted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle', maxWidth: 240 }}>
                    <span style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {s.descripcion || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                      {fmtARS(s.precio)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                    <button
                      onClick={() => toggleActivo(s)}
                      title={s.activo ? 'Desactivar' : 'Activar'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20,
                        background: s.activo ? 'rgba(74,222,128,0.12)' : 'rgba(138,138,138,0.12)',
                        border: `1px solid ${s.activo ? '#4ade8044' : '#6E6E7344'}`,
                        color: s.activo ? '#4ade80' : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {s.activo ? '● Activo' : '○ Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '6px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => openEdit(s)}
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5 }}
                        onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
                        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                        title="Editar"
                      >✏️</button>
                      <button
                        onClick={() => del(s)}
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                        title="Eliminar"
                      >🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal edición / creación ────────────────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === 'new' ? `Nuevo Servicio — ${form.tipo}` : `Editar Servicio — ${form.tipo}`}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={form.tipo === 'Gremio' ? COLOR_GREMIO : COLOR_CSF}
          width={520}
        >
          <FormGrid cols={2}>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, marginBottom: 4 }}>
              {(['Gremio', 'Cliente final'] as TipoServicioGremio[]).map(t => {
                const isSelected = form.tipo === t
                const col = t === 'Gremio' ? COLOR_GREMIO : COLOR_CSF
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tipo', t)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${isSelected ? col : 'var(--border)'}`,
                      background: isSelected ? `${col}18` : 'transparent',
                      color: isSelected ? col : C.muted, transition: 'all 0.15s',
                    }}
                  >
                    {t === 'Gremio' ? '🔧' : '👤'} {t}
                  </button>
                )
              })}
            </div>

            <Field label="Nombre" required col={2}>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Cambio de pantalla" style={inputSt} autoFocus />
            </Field>
            <Field label="Categoría">
              <input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Cambio pantalla, Software..." style={inputSt} />
            </Field>
            <Field label="Precio (ARS)" required>
              <input type="number" min={0} value={form.precio} onChange={e => set('precio', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Descripción" col={2}>
              <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} placeholder="Descripción del servicio..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>

            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={() => set('activo', !form.activo)}
                style={{ width: 36, height: 20, borderRadius: 10, background: form.activo ? '#4ade80' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 2, left: form.activo ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: 12, color: form.activo ? '#4ade80' : C.muted, fontWeight: form.activo ? 700 : 400 }}>Servicio activo</span>
            </div>
          </FormGrid>
        </Modal>
      )}

      {/* ─── Modal de importación ────────────────────────────────────────────── */}
      {importModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
            width: '100%', maxWidth: 720, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>⬆ Importar Servicios</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {importRows.length} fila{importRows.length !== 1 ? 's' : ''} detectada{importRows.length !== 1 ? 's' : ''}
                  {importGremio.length > 0 && ` · ${importGremio.length} Gremio`}
                  {importCSF.length > 0 && ` · ${importCSF.length} Cliente final`}
                </div>
              </div>
              <button onClick={closeImport} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {importDone ? (
              /* Resultado */
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>
                  Importación completada
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {importDone.added} servicio{importDone.added !== 1 ? 's' : ''} importado{importDone.added !== 1 ? 's' : ''}
                  {importDone.replaced > 0 && ` · ${importDone.replaced} eliminado${importDone.replaced !== 1 ? 's' : ''} previamente`}
                </div>
                <button
                  onClick={closeImport}
                  style={{ marginTop: 24, padding: '10px 28px', borderRadius: 9, border: 'none', background: '#4ade80', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                {/* Modo de importación */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Modo de importación
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {([
                      { id: 'add', label: '➕ Agregar a los existentes', desc: 'Se suman a los servicios actuales sin borrar nada' },
                      { id: 'replace', label: '🔄 Reemplazar por tipo', desc: 'Borra los servicios actuales del mismo tipo antes de importar' },
                    ] as { id: 'add' | 'replace'; label: string; desc: string }[]).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setImportMode(opt.id)}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${importMode === opt.id ? (opt.id === 'replace' ? '#f87171' : '#4ade80') : 'var(--border)'}`,
                          background: importMode === opt.id ? (opt.id === 'replace' ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)') : 'var(--surface)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: importMode === opt.id ? (opt.id === 'replace' ? '#f87171' : '#4ade80') : 'var(--text-primary)', marginBottom: 3 }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {importMode === 'replace' && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 11, color: '#f87171' }}>
                      ⚠️ Se eliminarán{' '}
                      {importGremio.length > 0 && importCSF.length > 0
                        ? `todos los servicios de Gremio (${gremioList.length}) y Cliente final (${csfList.length})`
                        : importGremio.length > 0
                          ? `todos los servicios de Gremio (${gremioList.length} actuales)`
                          : `todos los servicios de Cliente final (${csfList.length} actuales)`}
                      {' '}antes de importar. Esta acción no se puede deshacer.
                    </div>
                  )}
                </div>

                {/* Preview table */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                  {importRows.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No se encontraron filas válidas en el archivo.<br />
                      <span style={{ fontSize: 11 }}>Verificá que el archivo tenga la columna <strong>nombre</strong> y use separador ; o ,</span>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)' }}>
                          {['TIPO', 'NOMBRE', 'CATEGORÍA', 'PRECIO', 'ACTIVO'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 10, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--row-border)' }}>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: row.tipo === 'Gremio' ? 'rgba(167,139,250,0.15)' : 'rgba(74,222,128,0.12)', color: row.tipo === 'Gremio' ? '#a78bfa' : '#4ade80' }}>
                                {row.tipo}
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{row.nombre}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{row.categoria || '—'}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{fmtARS(row.precio)}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{ color: row.activo ? '#4ade80' : 'var(--text-secondary)', fontSize: 10, fontWeight: 700 }}>
                                {row.activo ? '● SI' : '○ NO'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={closeImport}
                    style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={doImport}
                    disabled={importing || importRows.length === 0}
                    style={{
                      padding: '9px 22px', borderRadius: 8, border: 'none',
                      background: importRows.length === 0 ? 'var(--surface2)' : importMode === 'replace' ? '#f87171' : '#4ade80',
                      color: importRows.length === 0 ? '#555' : '#000',
                      fontWeight: 700, fontSize: 13,
                      cursor: importing || importRows.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: importing ? 0.7 : 1, transition: 'all 0.15s',
                    }}
                  >
                    {importing ? 'Importando…' : importMode === 'replace'
                      ? `Reemplazar y cargar ${importRows.length} servicio${importRows.length !== 1 ? 's' : ''}`
                      : `Agregar ${importRows.length} servicio${importRows.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
