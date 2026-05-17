'use client'

import { useRef, useState, useCallback } from 'react'
import type { Supplier } from '@/lib/types'
import { COLORS } from '@/lib/colors'
import { parseGeneric } from '@/lib/parsers'

interface Props {
  onSupplierAdd: (supplier: Supplier) => void
  supplierCount: number
}

declare const XLSX: { read: (data: ArrayBuffer, opts: object) => {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}, utils: { sheet_to_json: <T>(ws: unknown, opts: object) => T[] } }

declare const Papa: { parse: <T>(file: File, opts: object) => void }

export default function UploadZone({ onSupplierAdd, supplierCount }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const processFiles = useCallback(async (files: File[]) => {
    setLoading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const name = file.name.replace(/\.[^.]+$/, '')
      const color = COLORS[supplierCount % COLORS.length]
      const id = `upload-${Date.now()}-${Math.random()}`

      try {
        let items

        if (ext === 'csv') {
          items = await new Promise<ReturnType<typeof parseGeneric>>((resolve, reject) => {
            Papa.parse<string[]>(file, {
              skipEmptyLines: false,
              complete: (r: { data: string[][] }) => {
                try { resolve(parseGeneric(r.data as [string | number | null][])) }
                catch (e) { reject(e) }
              },
              error: reject,
            })
          })
        } else if (ext === 'xlsx' || ext === 'xls') {
          const buf = await file.arrayBuffer()
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })
          items = parseGeneric(rows)
        } else {
          showToast(`Formato no soportado: .${ext}`, 'err')
          continue
        }

        if (!items.length) {
          showToast(`"${name}": no se encontraron datos con precio válido`, 'err')
          continue
        }

        onSupplierAdd({ id, name, items, color, source: 'upload' })
        showToast(`✓ ${name} — ${items.length} productos cargados`)
      } catch (e) {
        showToast(`Error al leer "${name}": ${String(e)}`, 'err')
      }
    }
    setLoading(false)
  }, [onSupplierAdd, supplierCount])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  return (
    <>
      {/* Load SheetJS and PapaParse from CDN for client-side parsing */}
      <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js" async />
      <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js" async />

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="rounded-xl text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? '#6366f1' : 'var(--border)'}`,
          background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
          padding: '20px 24px',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => {
            processFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />

        <div className="flex items-center justify-center gap-3">
          {loading ? (
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
              fill="none" viewBox="0 0 24 24" style={{ color: '#6366f1' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor"
              viewBox="0 0 24 24" style={{ color: '#6366f1' }}>
              <path d="M12 2a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-1.414 1.414L13 5.414V16a1 1 0 0 1-2 0V5.414L8.707 7.707A1 1 0 0 1 7.293 6.293l4-4A1 1 0 0 1 12 2zM4 17a1 1 0 0 1 1 1v1h14v-1a1 1 0 0 1 2 0v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1z" />
            </svg>
          )}
          <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
            {loading ? 'Procesando...' : 'Agregar otro proveedor'}
          </span>
          <span className="text-xs" style={{ color: '#7c85a2' }}>
            Arrastrá o hacé clic · Excel (.xlsx) o CSV
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-5 right-5 px-4 py-3 rounded-lg text-sm font-medium z-50 shadow-lg"
          style={{
            background: 'var(--surface2)',
            border: `1px solid ${toast.type === 'ok' ? '#22c55e' : '#ef4444'}`,
            color: toast.type === 'ok' ? '#4ade80' : '#fca5a5',
            animation: 'slideUp 0.2s ease',
          }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
