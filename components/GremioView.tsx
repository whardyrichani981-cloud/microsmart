'use client'

import { useEffect, useState, useMemo } from 'react'
import type { GremioData, GremioSection, GremioItem, OriginalItem, AmpsentrixItem, CFItem } from '@/lib/gremio-parser'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtARS(n: number | null) {
  if (n === null) return 'Consultar'
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}
function fmtUSD(n: number | null) {
  if (n === null) return 'Consultar'
  return `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function matches(text: string, q: string) {
  const words = norm(q).split(/\s+/).filter(Boolean)
  const t = norm(text)
  return words.every(w => t.includes(w))
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, fontWeight: 600,
  color: '#676767', letterSpacing: 0.4, textTransform: 'uppercase',
  border: '1px solid rgba(255,255,255,0.06)', textAlign: 'right',
}
const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  border: '1px solid rgba(255,255,255,0.04)',
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return <>{text}</>
  // Build regex that matches any of the words
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        words.some(w => norm(part) === w)
          ? <mark key={i} style={{ background: 'rgba(236,72,153,0.35)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
          : part
      )}
    </>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const isStock = /en stock/i.test(estado)
  const isIngresando = /ingresando/i.test(estado)
  const color = isStock ? '#4ade80' : isIngresando ? '#facc15' : '#676767'
  const bg = isStock ? 'rgba(74,222,128,0.1)' : isIngresando ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.15)'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: bg, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {isStock ? 'En stock' : isIngresando ? 'Ingresando' : 'Consultar'}
    </span>
  )
}

// ── Tab: Reparaciones ─────────────────────────────────────────────────────────
function SectionTable({ section, isUSD, q }: { section: GremioSection; isUSD: boolean; q: string }) {
  const filtered = q ? section.items.filter(it => matches(it.name, q)) : section.items
  if (!filtered.length) return null
  const fmt = isUSD ? fmtUSD : fmtARS
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        padding: '7px 12px', background: 'rgba(236,72,153,0.18)', borderLeft: '3px solid #ec4899',
        borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700, color: '#f472b6',
        letterSpacing: 0.3, textTransform: 'uppercase',
      }}>
        {section.title}
        {q && <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11 }}>({filtered.length})</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
            <th style={{ ...th, textAlign: 'left', width: '52%' }}>Reparación</th>
            <th style={th}>Transferencia</th>
            <th style={th}>Efectivo</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item: GremioItem, i: number) => {
            const consultar = item.transferencia === null && item.efectivo === null
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...td, color: '#E5E5E3', fontWeight: 500 }}>
                  <Highlight text={item.name} q={q} />
                </td>
                <td style={{ ...td, textAlign: 'right', color: consultar ? '#676767' : '#f472b6', fontWeight: consultar ? 400 : 600, fontStyle: consultar ? 'italic' : 'normal' }}>
                  {consultar ? 'Consultar' : fmt(item.transferencia)}
                </td>
                <td style={{ ...td, textAlign: 'right', color: consultar ? '#676767' : '#fbbf24', fontWeight: consultar ? 400 : 600, fontStyle: consultar ? 'italic' : 'normal' }}>
                  {consultar ? 'Consultar' : fmt(item.efectivo)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReparacionesTab({ data, q }: { data: GremioData; q: string }) {
  const usdTitles = ['Cambio de glass (USD)']
  const total = [...data.left, ...data.right].reduce((acc, s) => acc + (q ? s.items.filter(it => matches(it.name, q)).length : s.items.length), 0)
  return (
    <>
      {q && <div style={{ marginBottom: 12, fontSize: 12, color: '#676767' }}>{total} resultado{total !== 1 ? 's' : ''}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>{data.left.map((s, i) => <SectionTable key={i} section={s} isUSD={usdTitles.includes(s.title)} q={q} />)}</div>
        <div>{data.right.map((s, i) => <SectionTable key={i} section={s} isUSD={usdTitles.includes(s.title)} q={q} />)}</div>
      </div>
      {q && total === 0 && <NoResults />}
    </>
  )
}

// ── Tab: Repuestos Originales ─────────────────────────────────────────────────
function OriginalesTab({ items, q }: { items: OriginalItem[]; q: string }) {
  const filtered = q ? items.filter(it => matches(it.name, q) || matches(it.notas, q)) : items
  return (
    <>
      {q && <div style={{ marginBottom: 12, fontSize: 12, color: '#676767' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>}
      {filtered.length === 0 ? <NoResults /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
              <th style={{ ...th, textAlign: 'left', width: '55%' }}>Producto</th>
              <th style={th}>Efectivo/USDT</th>
              <th style={th}>Transferencia</th>
              <th style={{ ...th, textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => {
              const fmt = item.currency === 'ARS' ? fmtARS : fmtUSD
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...td, color: '#E5E5E3', fontWeight: 500 }}>
                    <Highlight text={item.name} q={q} />
                    {item.notas && <span style={{ display: 'block', fontSize: 11, color: '#676767', marginTop: 2 }}>{item.notas}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>{fmt(item.efectivo)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmt(item.transferencia)}</td>
                  <td style={{ ...td, textAlign: 'center' }}><EstadoBadge estado={item.estado} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}

// ── Tab: Repuestos Ampsentrix ─────────────────────────────────────────────────
function AmpsentrixTab({ items, q }: { items: AmpsentrixItem[]; q: string }) {
  const filtered = q ? items.filter(it => matches(it.name, q)) : items
  return (
    <>
      {q && <div style={{ marginBottom: 12, fontSize: 12, color: '#676767' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>}
      {filtered.length === 0 ? <NoResults /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
              <th style={{ ...th, textAlign: 'left', width: '45%' }}>Producto</th>
              <th style={th}>USD</th>
              <th style={th}>Efectivo ARS</th>
              <th style={th}>Transferencia ARS</th>
              <th style={{ ...th, textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...td, color: '#E5E5E3', fontWeight: 500 }}><Highlight text={item.name} q={q} /></td>
                <td style={{ ...td, textAlign: 'right', color: '#F5C400', fontWeight: 600 }}>{fmtUSD(item.usd)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmtARS(item.efectivoARS)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>{fmtARS(item.transferenciaARS)}</td>
                <td style={{ ...td, textAlign: 'center' }}><EstadoBadge estado={item.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ── Tab: Consumidor Final (CF) ────────────────────────────────────────────────
function CFTab({ items, q }: { items: CFItem[]; q: string }) {
  const filtered = q ? items.filter(it => matches(it.name, q) || matches(it.category, q)) : items

  // Group by category
  const grouped = filtered.reduce<Record<string, CFItem[]>>((acc, it) => {
    const cat = it.category || 'Sin categoría'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(it)
    return acc
  }, {})
  const categories = Object.keys(grouped).sort()

  return (
    <>
      {q && <div style={{ marginBottom: 12, fontSize: 12, color: '#676767' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>}
      {filtered.length === 0 ? <NoResults /> : (
        categories.map(cat => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{
              padding: '7px 12px', background: 'rgba(234,179,8,0.15)', borderLeft: '3px solid #eab308',
              borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700, color: '#facc15',
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>
              {cat}
              {q && <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11 }}>({grouped[cat].length})</span>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
                  <th style={{ ...th, textAlign: 'left', width: '38%' }}>Reparación</th>
                  <th style={th}>USD repuesto</th>
                  <th style={th}>Efectivo / Transf.</th>
                  <th style={th}>3 cuotas</th>
                  <th style={th}>6 cuotas</th>
                </tr>
              </thead>
              <tbody>
                {grouped[cat].map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ ...td, color: '#E5E5E3', fontWeight: 500 }}>
                      <Highlight text={item.name} q={q} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#F5C400', fontWeight: 600 }}>
                      {item.usdRepuesto !== null ? fmtUSD(item.usdRepuesto) : <span style={{ color: '#484848' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
                      {item.precioEfectivo !== null ? fmtARS(item.precioEfectivo) : <span style={{ color: '#484848' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
                      {item.precio3cuotas !== null ? fmtARS(item.precio3cuotas) : <span style={{ color: '#484848', fontStyle: 'italic', fontWeight: 400, fontSize: 12 }}>No</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
                      {item.precio6cuotas !== null ? fmtARS(item.precio6cuotas) : <span style={{ color: '#484848', fontStyle: 'italic', fontWeight: 400, fontSize: 12 }}>No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  )
}

function NoResults() {
  return <div style={{ padding: '32px', textAlign: 'center', color: '#484848', fontSize: 14 }}>Sin resultados</div>
}

function Loading({ label }: { label: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#676767', fontSize: 14 }}>Cargando {label}…</div>
}
function Err({ msg }: { msg: string }) {
  return <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5' }}>Error: {msg}</div>
}

// ── Main component ────────────────────────────────────────────────────────────
type TabId = 'reparaciones' | 'originales' | 'ampsentrix' | 'cf'

const TABS: { id: TabId; label: string }[] = [
  { id: 'reparaciones', label: 'Reparaciones' },
  { id: 'originales',   label: 'Repuestos Originales' },
  { id: 'ampsentrix',   label: 'Repuestos Ampsentrix' },
  { id: 'cf',           label: 'Consumidor Final' },
]

export default function GremioView() {
  const [activeTab, setActiveTab] = useState<TabId>('reparaciones')
  const [search, setSearch] = useState('')
  const [reparaciones, setReparaciones] = useState<GremioData | null>(null)
  const [originales, setOriginales] = useState<OriginalItem[] | null>(null)
  const [ampsentrix, setAmpsentrix] = useState<AmpsentrixItem[] | null>(null)
  const [cf, setCf] = useState<CFItem[] | null>(null)
  const [errors, setErrors] = useState<Partial<Record<TabId, string>>>({})

  useEffect(() => {
    const load = <T,>(url: string, set: (v: T) => void, key: TabId) =>
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<T> })
        .then(set)
        .catch(e => setErrors(p => ({ ...p, [key]: String(e) })))

    load('/api/gremio',            setReparaciones, 'reparaciones')
    load('/api/gremio/originales', setOriginales,   'originales')
    load('/api/gremio/ampsentrix', setAmpsentrix,   'ampsentrix')
    load('/api/gremio/cf',         setCf,           'cf')
  }, [])

  // Badge counts per tab while searching
  const counts = useMemo(() => {
    const q = search.trim()
    if (!q || !reparaciones || !originales || !ampsentrix || !cf) return null
    const rep = [...reparaciones.left, ...reparaciones.right].reduce((a, s) => a + s.items.filter(it => matches(it.name, q)).length, 0)
    const ori = originales.filter(it => matches(it.name, q) || matches(it.notas, q)).length
    const amp = ampsentrix.filter(it => matches(it.name, q)).length
    const cfCount = cf.filter(it => matches(it.name, q) || matches(it.category, q)).length
    return { reparaciones: rep, originales: ori, ampsentrix: amp, cf: cfCount }
  }, [search, reparaciones, originales, ampsentrix, cf])

  const q = search.trim()

  return (
    <div>
      {/* Header + search */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f472b6', margin: 0 }}>Lista de Precios · Gremio</h2>
          <p style={{ fontSize: 12, color: '#676767', margin: '4px 0 0' }}>Microsmart Servicio Técnico Apple</p>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 380, minWidth: 200 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#676767', pointerEvents: 'none' }}>
            <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en todas las listas..."
            style={{
              width: '100%', padding: '8px 32px 8px 32px', boxSizing: 'border-box',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: '#E5E5E3', fontSize: 13, outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            }}>×</button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => {
          const count = counts?.[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                background: activeTab === tab.id ? '#ec4899' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#8A8A8A',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.label}
              {counts && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'rgba(236,72,153,0.2)',
                  color: activeTab === tab.id ? '#fff' : '#f472b6',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'reparaciones' && (
        errors.reparaciones ? <Err msg={errors.reparaciones} /> :
        !reparaciones ? <Loading label="reparaciones" /> :
        <ReparacionesTab data={reparaciones} q={q} />
      )}
      {activeTab === 'originales' && (
        errors.originales ? <Err msg={errors.originales} /> :
        !originales ? <Loading label="repuestos originales" /> :
        <OriginalesTab items={originales} q={q} />
      )}
      {activeTab === 'ampsentrix' && (
        errors.ampsentrix ? <Err msg={errors.ampsentrix} /> :
        !ampsentrix ? <Loading label="repuestos Ampsentrix" /> :
        <AmpsentrixTab items={ampsentrix} q={q} />
      )}
      {activeTab === 'cf' && (
        errors.cf ? <Err msg={errors.cf} /> :
        !cf ? <Loading label="lista Consumidor Final" /> :
        <CFTab items={cf} q={q} />
      )}

      {/* Legend */}
      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 20, fontSize: 12, color: '#676767', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#f472b6', fontWeight: 600 }}>Rosa</span> = Transferencia</span>
        <span><span style={{ color: '#fbbf24', fontWeight: 600 }}>Amarillo</span> = Efectivo ARS</span>
        <span><span style={{ color: '#F5C400', fontWeight: 600 }}>Dorado</span> = USD</span>
      </div>

      <style>{`input::placeholder{color:#484848}input:focus{border-color:#ec4899!important}`}</style>
    </div>
  )
}
