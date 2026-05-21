'use client'
import { useState, useEffect, useCallback } from 'react'
import StockView from './StockView'
import AccesoriosView from './AccesoriosView'
import type { StockItem, StockMovimiento } from '@/lib/sistema-types'
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

// ── Historial de Movimientos ──────────────────────────────────────────────────
function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function HistorialView() {
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState<'todos' | 'entrada' | 'salida' | 'ajuste'>('todos')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    const tipo = filterTipo !== 'todos' ? `&tipo=${filterTipo}` : ''
    const q = debounced ? `&q=${encodeURIComponent(debounced)}` : ''
    fetch(`/api/sistema/stock-movimientos?limit=300${tipo}${q}`)
      .then(r => r.json())
      .then(d => { setMovimientos(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filterTipo, debounced])

  useEffect(() => { load() }, [load])

  const entradas = movimientos.filter(m => m.tipo === 'entrada')
  const salidas  = movimientos.filter(m => m.tipo === 'salida')

  const tipoConfig = {
    entrada: { label: 'Entrada', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: '↑' },
    salida:  { label: 'Salida',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '↓' },
    ajuste:  { label: 'Ajuste',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: '↔' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>ENTRADAS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80' }}>{entradas.length}</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            +{entradas.reduce((s, m) => s + Math.abs(m.delta), 0)} unidades
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>SALIDAS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f87171' }}>{salidas.length}</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            -{salidas.reduce((s, m) => s + Math.abs(m.delta), 0)} unidades
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>TOTAL MOVIMIENTOS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{total}</div>
          <div style={{ fontSize: 12, color: C.muted }}>en el registro</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar producto, motivo, referencia…"
          style={{
            flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text-primary)', fontSize: 13,
          }}
        />
        {(['todos', 'entrada', 'salida', 'ajuste'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterTipo(t)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: filterTipo === t
                ? (t === 'todos' ? '#a78bfa' : t === 'entrada' ? '#4ade80' : t === 'salida' ? '#f87171' : '#fbbf24')
                : 'var(--surface2)',
              color: filterTipo === t ? '#0a0a0a' : C.muted,
              transition: 'all 0.12s',
            }}
          >
            {t === 'todos' ? 'Todos' : t === 'entrada' ? '↑ Entradas' : t === 'salida' ? '↓ Salidas' : '↔ Ajustes'}
          </button>
        ))}
        <button onClick={load} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
          ↻
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>Cargando…</div>
      ) : movimientos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Sin movimientos registrados</div>
          <div style={{ fontSize: 13, color: C.muted }}>Los cambios de stock se registrarán automáticamente a partir de ahora</div>
        </div>
      ) : (
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 1fr 120px 80px 140px 1fr',
            padding: '9px 16px', background: 'var(--surface2)',
            fontSize: 11, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Fecha</span>
            <span>Producto</span>
            <span>Tipo</span>
            <span style={{ textAlign: 'right' }}>Delta</span>
            <span style={{ textAlign: 'center' }}>Stock antes → después</span>
            <span>Motivo / Referencia</span>
          </div>
          {/* Rows */}
          {movimientos.map((m, i) => {
            const cfg = tipoConfig[m.tipo]
            return (
              <div
                key={m.id}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 120px 80px 140px 1fr',
                  padding: '10px 16px', alignItems: 'center',
                  background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  borderBottom: i < movimientos.length - 1 ? '1px solid var(--row-border)' : 'none',
                  fontSize: 12,
                }}
              >
                {/* Fecha */}
                <div style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace' }}>
                  {fmtDateTime(m.createdAt)}
                </div>
                {/* Producto */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.repuesto}</div>
                  {m.modelo && <div style={{ fontSize: 11, color: C.muted }}>{m.modelo}</div>}
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                    {m.tipoStock === 'repuestos' ? '🔩' : '🛍️'} {m.tipoStock}
                  </div>
                </div>
                {/* Tipo badge */}
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`,
                  }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                {/* Delta */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: 14,
                    color: m.delta > 0 ? '#4ade80' : '#f87171',
                  }}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                </div>
                {/* Stock flow */}
                <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>
                  <span style={{ color: 'var(--text-primary)' }}>{m.stockAntes}</span>
                  <span style={{ margin: '0 6px', color: C.muted }}>→</span>
                  <span style={{ color: m.delta > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{m.stockDespues}</span>
                </div>
                {/* Motivo */}
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>{m.motivo}</div>
                  {m.referencia && (
                    <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 2 }}>{m.referencia}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'repuestos' as const, label: '🔩 Repuestos', desc: 'Módulos, baterías y piezas' },
  { id: 'accesorios' as const, label: '🛍️ Accesorios', desc: 'Accesorios para la venta' },
  { id: 'alertas' as const,   label: '🚨 Alertas',    desc: 'Stock bajo o agotado' },
  { id: 'historial' as const, label: '📋 Historial',  desc: 'Log de entradas y salidas' },
]

export default function StockMainView({ onAlertCountChange }: { onAlertCountChange?: (n: number) => void }) {
  const [tab, setTab] = useState<'repuestos' | 'accesorios' | 'alertas' | 'historial'>('repuestos')
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
      const count = [...map.values()].filter(g => g.total <= g.min).length
      setAlertCount(count)
      onAlertCountChange?.(count)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => {
          const isActive = tab === t.id
          const tabColor = t.id === 'alertas' ? '#ef4444' : t.id === 'historial' ? '#60a5fa' : '#a78bfa'
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'none',
                color: isActive ? tabColor : 'var(--text-secondary)',
                borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.12s',
                display: 'flex', alignItems: 'center', gap: 6,
                position: 'relative',
              }}
            >
              {t.label}
              {t.id === 'alertas' && alertCount > 0 && (
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
      {tab === 'accesorios' && <AccesoriosView />}
      {tab === 'alertas'    && <AlertasView />}
      {tab === 'historial'  && <HistorialView />}
    </div>
  )
}
