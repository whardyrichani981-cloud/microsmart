'use client'

import { useEffect, useState } from 'react'
import type { CFItem } from '@/lib/gremio-parser'

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function matches(text: string, q: string) {
  const words = norm(q).split(/\s+/).filter(Boolean)
  const t = norm(text)
  return words.every(w => t.includes(w))
}

function fmtARS(n: number | null) {
  if (n === null) return <span style={{ color: '#475569', fontSize: 12 }}>—</span>
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}
function fmtUSD(n: number | null) {
  if (n === null) return <span style={{ color: '#475569', fontSize: 12 }}>—</span>
  return `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return <>{text}</>
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        words.some(w => norm(part) === w)
          ? <mark key={i} style={{ background: 'rgba(234,179,8,0.4)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
          : part
      )}
    </>
  )
}

const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, fontWeight: 600,
  color: '#7c85a2', letterSpacing: 0.4, textTransform: 'uppercase',
  border: '1px solid rgba(255,255,255,0.06)', textAlign: 'right',
}
const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  border: '1px solid rgba(255,255,255,0.04)',
}

export default function CFView() {
  const [items, setItems] = useState<CFItem[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/gremio/cf')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: CFItem[]) => setItems(data))
      .catch(e => setError(String(e)))
  }, [])

  const q = search.trim()
  const filtered = items
    ? (q ? items.filter(it => matches(it.name, q) || matches(it.category, q)) : items)
    : []

  const grouped = filtered.reduce<Record<string, CFItem[]>>((acc, it) => {
    const cat = it.category || 'Sin categoría'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(it)
    return acc
  }, {})
  const categories = Object.keys(grouped).sort()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#facc15', margin: 0 }}>
            Lista Consumidor Final
          </h2>
          <p style={{ fontSize: 12, color: '#7c85a2', margin: '4px 0 0' }}>
            {items ? `${items.length} reparaciones · ${categories.length} categorías` : 'Cargando...'}
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 380, minWidth: 200 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7c85a2', pointerEvents: 'none' }}>
            <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar reparación..."
            style={{
              width: '100%', padding: '8px 32px 8px 32px', boxSizing: 'border-box',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#7c85a2', cursor: 'pointer', fontSize: 16,
            }}>×</button>
          )}
        </div>
      </div>

      {/* States */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
          Error: {error}
        </div>
      )}
      {!items && !error && (
        <div style={{ padding: 40, textAlign: 'center', color: '#7c85a2', fontSize: 14 }}>Cargando lista...</div>
      )}
      {items && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 14 }}>Sin resultados</div>
      )}

      {/* Results count when searching */}
      {q && filtered.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#7c85a2' }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Category sections */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{
            padding: '7px 12px', background: 'rgba(234,179,8,0.15)', borderLeft: '3px solid #eab308',
            borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700, color: '#facc15',
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>
            {cat}
            <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, color: '#7c85a2' }}>
              ({grouped[cat].length})
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
                <th style={{ ...th, textAlign: 'left', width: '40%' }}>Reparación</th>
                <th style={th}>USD repuesto</th>
                <th style={th}>Efectivo / Transf.</th>
                <th style={th}>3 cuotas</th>
                <th style={th}>6 cuotas</th>
              </tr>
            </thead>
            <tbody>
              {grouped[cat].map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...td, color: '#e2e8f0', fontWeight: 500 }}>
                    <Highlight text={item.name} q={q} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#818cf8', fontWeight: 600 }}>
                    {fmtUSD(item.usdRepuesto)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
                    {fmtARS(item.precioEfectivo)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
                    {fmtARS(item.precio3cuotas)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
                    {fmtARS(item.precio6cuotas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <style>{`input::placeholder{color:#475569}input:focus{border-color:#eab308!important}`}</style>
    </div>
  )
}
