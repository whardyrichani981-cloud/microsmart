'use client'

import { useEffect, useState, useRef } from 'react'

interface SupplierMeta {
  key: string
  filename: string | null
  updated_at: string
}

const SUPPLIERS = [
  { key: 'gremio',     label: 'Reparaciones Gremio',   color: '#f472b6' },
  { key: 'originales', label: 'Repuestos Originales',   color: '#818cf8' },
  { key: 'ampsentrix', label: 'Repuestos Ampsentrix',   color: '#4ade80' },
  { key: 'cf',         label: 'Consumidor Final',       color: '#facc15' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminPage() {
  const [meta, setMeta] = useState<SupplierMeta[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function loadMeta() {
    try {
      const res = await fetch('/api/admin/meta')
      if (res.ok) setMeta(await res.json())
    } catch { /* */ }
  }

  useEffect(() => { loadMeta() }, [])

  async function handleUpload(key: string) {
    const input = fileRefs.current[key]
    if (!input?.files?.length) {
      setStatus(p => ({ ...p, [key]: { ok: false, msg: 'Seleccioná un archivo CSV primero' } }))
      return
    }
    setUploading(key)
    setStatus(p => ({ ...p, [key]: { ok: true, msg: 'Subiendo…' } }))
    try {
      const form = new FormData()
      form.append('key', key)
      form.append('file', input.files[0])
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setStatus(p => ({ ...p, [key]: { ok: true, msg: `✓ Actualizado — ${data.rows} filas` } }))
        input.value = ''
        loadMeta()
      } else {
        setStatus(p => ({ ...p, [key]: { ok: false, msg: data.error ?? 'Error' } }))
      }
    } catch (e) {
      setStatus(p => ({ ...p, [key]: { ok: false, msg: String(e) } }))
    } finally {
      setUploading(null)
    }
  }

  const metaMap = Object.fromEntries(meta.map(m => [m.key, m]))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 32px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
          Panel de administración
        </h1>
        <p style={{ fontSize: 13, color: '#7c85a2', marginBottom: 32 }}>
          Actualizá las listas de precios sin necesidad de redesplegar la app.
          Subí el CSV exportado desde Google Sheets para cada proveedor.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SUPPLIERS.map(s => {
            const m = metaMap[s.key]
            const st = status[s.key]
            const busy = uploading === s.key
            return (
              <div key={s.key} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.label}</span>
                    {m ? (
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                        Última actualización: {fmtDate(m.updated_at)}
                        {m.filename && <> · {m.filename}</>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Sin datos en DB</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{
                    padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: '#94a3b8', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    Elegir CSV…
                    <input
                      type="file"
                      accept=".csv"
                      ref={el => { fileRefs.current[s.key] = el }}
                      onChange={() => setStatus(p => ({ ...p, [s.key]: { ok: true, msg: '' } }))}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    onClick={() => handleUpload(s.key)}
                    disabled={busy}
                    style={{
                      padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 700,
                      background: busy ? '#374151' : s.color,
                      color: busy ? '#7c85a2' : '#0f1117',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {busy ? 'Subiendo…' : 'Actualizar'}
                  </button>

                  {st?.msg && (
                    <span style={{
                      fontSize: 12, color: st.ok ? '#4ade80' : '#f87171',
                      fontWeight: 500,
                    }}>
                      {st.msg}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: 32, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          fontSize: 12, color: '#7c85a2', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#818cf8' }}>Cómo exportar desde Google Sheets:</strong><br />
          Archivo → Descargar → Valores separados por comas (.csv)
        </div>
      </div>
    </div>
  )
}
