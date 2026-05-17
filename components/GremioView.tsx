'use client'

import { useEffect, useState } from 'react'
import type { GremioData, GremioSection, GremioItem, OriginalItem, AmpsentrixItem } from '@/lib/gremio-parser'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtARS(n: number | null) {
  if (n === null) return 'Consultar'
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}
function fmtUSD(n: number | null) {
  if (n === null) return 'Consultar'
  return `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, fontWeight: 600,
  color: '#7c85a2', letterSpacing: 0.4, textTransform: 'uppercase',
  border: '1px solid rgba(255,255,255,0.06)', textAlign: 'right',
}
const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  border: '1px solid rgba(255,255,255,0.04)',
}

function EstadoBadge({ estado }: { estado: string }) {
  const lower = estado.toLowerCase()
  const isStock = /en stock/i.test(lower)
  const isIngresando = /ingresando/i.test(lower)
  const color = isStock ? '#4ade80' : isIngresando ? '#facc15' : '#7c85a2'
  const bg = isStock ? 'rgba(74,222,128,0.1)' : isIngresando ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.15)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: bg, color, border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {isStock ? 'En stock' : isIngresando ? 'Ingresando' : 'Consultar'}
    </span>
  )
}

// ── Tab: Reparaciones ─────────────────────────────────────────────────────────
function SectionTable({ section, isUSD }: { section: GremioSection; isUSD: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        padding: '7px 12px',
        background: 'rgba(236,72,153,0.18)', borderLeft: '3px solid #ec4899',
        borderRadius: '6px 6px 0 0',
        fontSize: 12, fontWeight: 700, color: '#f472b6',
        letterSpacing: 0.3, textTransform: 'uppercase',
      }}>
        {section.title}
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
          {section.items.map((item: GremioItem, i: number) => {
            const consultar = item.transferencia === null && item.efectivo === null
            const fmt = isUSD ? fmtUSD : fmtARS
            return (
              <tr key={i} style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <td style={{ ...td, color: '#e2e8f0', fontWeight: 500 }}>{item.name}</td>
                <td style={{ ...td, textAlign: 'right', color: consultar ? '#7c85a2' : '#f472b6', fontWeight: consultar ? 400 : 600, fontStyle: consultar ? 'italic' : 'normal' }}>
                  {consultar ? 'Consultar' : fmt(item.transferencia)}
                </td>
                <td style={{ ...td, textAlign: 'right', color: consultar ? '#7c85a2' : '#fbbf24', fontWeight: consultar ? 400 : 600, fontStyle: consultar ? 'italic' : 'normal' }}>
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

function ReparacionesTab({ data }: { data: GremioData }) {
  const usdTitles = ['Cambio de glass (USD)']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      <div>{data.left.map((s, i) => <SectionTable key={i} section={s} isUSD={usdTitles.includes(s.title)} />)}</div>
      <div>{data.right.map((s, i) => <SectionTable key={i} section={s} isUSD={usdTitles.includes(s.title)} />)}</div>
    </div>
  )
}

// ── Tab: Repuestos Originales ─────────────────────────────────────────────────
function OriginalesTab({ items }: { items: OriginalItem[] }) {
  return (
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
        {items.map((item, i) => {
          const isARS = item.currency === 'ARS'
          const fmt = isARS ? fmtARS : fmtUSD
          return (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <td style={{ ...td, color: '#e2e8f0', fontWeight: 500 }}>
                {item.name}
                {item.notas && (
                  <span style={{ display: 'block', fontSize: 11, color: '#7c85a2', marginTop: 2 }}>
                    {item.notas}
                  </span>
                )}
              </td>
              <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
                {fmt(item.efectivo)}
              </td>
              <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
                {fmt(item.transferencia)}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <EstadoBadge estado={item.estado} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Tab: Repuestos Ampsentrix ─────────────────────────────────────────────────
function AmpsentrixTab({ items }: { items: AmpsentrixItem[] }) {
  return (
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
        {items.map((item, i) => (
          <tr key={i} style={{
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <td style={{ ...td, color: '#e2e8f0', fontWeight: 500 }}>{item.name}</td>
            <td style={{ ...td, textAlign: 'right', color: '#818cf8', fontWeight: 600 }}>
              {fmtUSD(item.usd)}
            </td>
            <td style={{ ...td, textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
              {fmtARS(item.efectivoARS)}
            </td>
            <td style={{ ...td, textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>
              {fmtARS(item.transferenciaARS)}
            </td>
            <td style={{ ...td, textAlign: 'center' }}>
              <EstadoBadge estado={item.estado} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Loading / Error helpers ───────────────────────────────────────────────────
function Loading({ label }: { label: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#7c85a2', fontSize: 14 }}>Cargando {label}…</div>
}
function Err({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5' }}>
      Error: {msg}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type TabId = 'reparaciones' | 'originales' | 'ampsentrix'

const TABS: { id: TabId; label: string }[] = [
  { id: 'reparaciones', label: 'Reparaciones' },
  { id: 'originales',   label: 'Repuestos Originales' },
  { id: 'ampsentrix',   label: 'Repuestos Ampsentrix' },
]

export default function GremioView() {
  const [activeTab, setActiveTab] = useState<TabId>('reparaciones')
  const [reparaciones, setReparaciones] = useState<GremioData | null>(null)
  const [originales, setOriginales] = useState<OriginalItem[] | null>(null)
  const [ampsentrix, setAmpsentrix] = useState<AmpsentrixItem[] | null>(null)
  const [errors, setErrors] = useState<Partial<Record<TabId, string>>>({})

  useEffect(() => {
    fetch('/api/gremio').then(r => r.json()).then(setReparaciones).catch(e => setErrors(p => ({ ...p, reparaciones: String(e) })))
    fetch('/api/gremio/originales').then(r => r.json()).then(setOriginales).catch(e => setErrors(p => ({ ...p, originales: String(e) })))
    fetch('/api/gremio/ampsentrix').then(r => r.json()).then(setAmpsentrix).catch(e => setErrors(p => ({ ...p, ampsentrix: String(e) })))
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f472b6', margin: 0 }}>
          Lista de Precios · Gremio
        </h2>
        <p style={{ fontSize: 12, color: '#7c85a2', margin: '4px 0 0' }}>
          Microsmart Servicio Técnico Apple
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 4, width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? '#ec4899' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'reparaciones' && (
        errors.reparaciones ? <Err msg={errors.reparaciones} /> :
        !reparaciones ? <Loading label="reparaciones" /> :
        <ReparacionesTab data={reparaciones} />
      )}

      {activeTab === 'originales' && (
        errors.originales ? <Err msg={errors.originales} /> :
        !originales ? <Loading label="repuestos originales" /> :
        <OriginalesTab items={originales} />
      )}

      {activeTab === 'ampsentrix' && (
        errors.ampsentrix ? <Err msg={errors.ampsentrix} /> :
        !ampsentrix ? <Loading label="repuestos Ampsentrix" /> :
        <AmpsentrixTab items={ampsentrix} />
      )}

      {/* Legend */}
      <div style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 20, fontSize: 12, color: '#7c85a2', flexWrap: 'wrap',
      }}>
        <span><span style={{ color: '#f472b6', fontWeight: 600 }}>Rosa</span> = Transferencia</span>
        <span><span style={{ color: '#fbbf24', fontWeight: 600 }}>Amarillo</span> = Efectivo ARS</span>
        <span><span style={{ color: '#818cf8', fontWeight: 600 }}>Violeta</span> = USD</span>
      </div>
    </div>
  )
}
