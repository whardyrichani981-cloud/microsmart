'use client'
import { useState, useEffect } from 'react'
import StockView from './StockView'
import type { StockItem } from '@/lib/sistema-types'
import { fmtARS, C } from './shared'

interface StockGroup {
  key: string
  repuesto: string
  categoria: string
  modelo: string
  tipo: string
  totalStock: number
  stockMinimo: number
  items: StockItem[]
}

function groupKey(item: StockItem) {
  return `${item.tipo}|||${item.repuesto.trim().toLowerCase()}|||${item.modelo.trim().toLowerCase()}`
}

function AlertasView() {
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()),
      fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()),
    ]).then(([rep, acc]) => {
      const allItems: StockItem[] = [
        ...(rep?.items ?? []),
        ...(acc?.items ?? []),
      ]
      const map = new Map<string, StockGroup>()
      for (const item of allItems) {
        const k = groupKey(item)
        if (!map.has(k)) map.set(k, {
          key: k, repuesto: item.repuesto, categoria: item.categoria,
          modelo: item.modelo, tipo: item.tipo,
          totalStock: 0, stockMinimo: item.stockMinimo ?? 2, items: [],
        })
        const g = map.get(k)!
        g.totalStock += item.stock
        g.stockMinimo = Math.max(g.stockMinimo, item.stockMinimo ?? 2)
        g.items.push(item)
      }
      const alertas = [...map.values()].filter(g => g.totalStock <= g.stockMinimo)
        .sort((a, b) => a.totalStock - b.totalStock)
      setGroups(alertas)
    }).finally(() => setLoading(false))
  }, [])

  const COLOR = '#ef4444'
  const sinStock = groups.filter(g => g.totalStock === 0)
  const bajoMinimo = groups.filter(g => g.totalStock > 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Cargando…</div>

  if (groups.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Todo el stock está OK</div>
      <div style={{ fontSize: 13 }}>No hay productos por debajo de su stock mínimo</div>
    </div>
  )

  const Section = ({ title, color, items }: { title: string; color: string; items: StockGroup[] }) => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {title} — {items.length} producto{items.length !== 1 ? 's' : ''}
        </div>
        <div style={{ borderRadius: 10, border: `1px solid ${color}33`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 150px 80px 80px 100px',
            padding: '8px 14px', background: `${color}10`,
            fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
            borderBottom: `1px solid ${color}22`,
          }}>
            <span>Producto</span>
            <span>Categoría</span>
            <span>Modelo</span>
            <span style={{ textAlign: 'right' }}>Stock</span>
            <span style={{ textAlign: 'right' }}>Mínimo</span>
            <span style={{ textAlign: 'right' }}>Faltan</span>
          </div>
          {items.map((g, i) => (
            <div key={g.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 150px 80px 80px 100px',
              padding: '11px 14px', alignItems: 'center',
              background: 'var(--surface)',
              borderBottom: i < items.length - 1 ? `1px solid ${color}18` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{g.repuesto}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {g.tipo === 'repuestos' ? '🔩 Repuesto' : '🛍️ Accesorio'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{g.categoria}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{g.modelo || '—'}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: 'monospace', fontWeight: 800, fontSize: 15,
                  color, background: `${color}15`, padding: '2px 8px', borderRadius: 5,
                }}>{g.totalStock}</span>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: C.muted }}>{g.stockMinimo}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                  color, background: `${color}10`, padding: '2px 8px', borderRadius: 5,
                }}>
                  {g.totalStock === 0 ? `Comprar ${g.stockMinimo}` : `+${g.stockMinimo - g.totalStock}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>SIN STOCK</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{sinStock.length}</div>
          <div style={{ fontSize: 12, color: C.muted }}>productos agotados</div>
        </div>
        <div style={{
          flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)',
        }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>BAJO MÍNIMO</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fb923c' }}>{bajoMinimo.length}</div>
          <div style={{ fontSize: 12, color: C.muted }}>productos por reponer</div>
        </div>
        <div style={{
          flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.05)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>TOTAL ALERTAS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{groups.length}</div>
          <div style={{ fontSize: 12, color: C.muted }}>requieren atención</div>
        </div>
      </div>

      <Section title="🚫 Sin stock — urgente" color="#ef4444" items={sinStock} />
      <Section title="⚠️ Bajo el mínimo — reponer pronto" color="#fb923c" items={bajoMinimo} />
    </div>
  )
}

const TABS = [
  { id: 'repuestos' as const, label: '🔩 Repuestos', desc: 'Módulos, baterías y piezas' },
  { id: 'accesorios' as const, label: '🛍️ Accesorios', desc: 'Accesorios para la venta' },
  { id: 'alertas' as const, label: '🚨 Alertas', desc: 'Stock bajo o agotado' },
]

export default function StockMainView() {
  const [tab, setTab] = useState<'repuestos' | 'accesorios' | 'alertas'>('repuestos')
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()),
      fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()),
    ]).then(([rep, acc]) => {
      const allItems: StockItem[] = [...(rep?.items ?? []), ...(acc?.items ?? [])]
      const map = new Map<string, { total: number; min: number }>()
      for (const item of allItems) {
        const k = groupKey(item)
        if (!map.has(k)) map.set(k, { total: 0, min: item.stockMinimo ?? 2 })
        const g = map.get(k)!
        g.total += item.stock
        g.min = Math.max(g.min, item.stockMinimo ?? 2)
      }
      setAlertCount([...map.values()].filter(g => g.total <= g.min).length)
    }).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => {
          const isAlerta = t.id === 'alertas'
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'none',
                color: isActive ? (isAlerta ? '#ef4444' : '#a78bfa') : 'var(--text-secondary)',
                borderBottom: isActive ? `2px solid ${isAlerta ? '#ef4444' : '#a78bfa'}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.12s',
                display: 'flex', alignItems: 'center', gap: 6,
                position: 'relative',
              }}
            >
              {t.label}
              {isAlerta && alertCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  background: '#ef4444', color: '#fff',
                  padding: '1px 6px', borderRadius: 10, lineHeight: '16px',
                }}>{alertCount}</span>
              )}
            </button>
          )
        })}
      </div>
      {tab === 'repuestos'  && <StockView tipo="repuestos" />}
      {tab === 'accesorios' && <StockView tipo="accesorios" />}
      {tab === 'alertas'    && <AlertasView />}
    </div>
  )
}
