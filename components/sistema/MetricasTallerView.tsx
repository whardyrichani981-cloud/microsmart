'use client'
import { useState, useMemo } from 'react'
import { useApi, fmtARS, C, KPICard } from './shared'

// ─── Local interfaces ─────────────────────────────────────────────────────────
interface Orden {
  id: string
  nOrden: string
  fecha: string
  tipo: 'Cliente final' | 'Gremio'
  estado: string
  tecnico: string
  tipoServicio: string
  modeloEquipo: string
  montoCobrado: number
  moneda: string
  equivARS: number
  gananciaReal: number
  createdAt: string
}

interface VentaCaja {
  id: string
  fecha: string
  total: number
  gananciaReal: number
  metodoPago: string
  items: unknown[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR_TECH = '#818cf8'
const COLOR_REPAIR = '#34d399'
const COLOR_MODEL = '#60a5fa'
const COLOR_CHART = '#818cf8'

const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const ESTADO_COLORS: Record<string, string> = {
  'Entrada': '#60a5fa',
  'Técnico Saddi': '#fbbf24',
  'Laboratorio': '#f97316',
  'Salida de laboratorio': '#86efac',
  'Salida': '#22c55e',
  'Entregado': '#4ade80',
}

type Periodo = 'hoy' | 'semana' | 'mes' | 'año' | 'todo'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getISOWeekStart(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const start = new Date(d)
  start.setDate(d.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function filterByPeriodo(items: Orden[], periodo: Periodo): Orden[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (periodo === 'todo') return items

  if (periodo === 'hoy') {
    return items.filter(o => o.fecha === todayStr)
  }

  if (periodo === 'semana') {
    const weekStart = getISOWeekStart(now)
    return items.filter(o => {
      const d = new Date(o.fecha + 'T00:00:00')
      return d >= weekStart
    })
  }

  if (periodo === 'mes') {
    const prefix = todayStr.slice(0, 7)
    return items.filter(o => o.fecha.startsWith(prefix))
  }

  if (periodo === 'año') {
    const prefix = todayStr.slice(0, 4)
    return items.filter(o => o.fecha.startsWith(prefix))
  }

  return items
}

function filterVentasByPeriodo(items: VentaCaja[], periodo: Periodo): VentaCaja[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (periodo === 'todo') return items

  if (periodo === 'hoy') {
    return items.filter(v => v.fecha === todayStr)
  }

  if (periodo === 'semana') {
    const weekStart = getISOWeekStart(now)
    return items.filter(v => {
      const d = new Date(v.fecha + 'T00:00:00')
      return d >= weekStart
    })
  }

  if (periodo === 'mes') {
    const prefix = todayStr.slice(0, 7)
    return items.filter(v => v.fecha.startsWith(prefix))
  }

  if (periodo === 'año') {
    const prefix = todayStr.slice(0, 4)
    return items.filter(v => v.fecha.startsWith(prefix))
  }

  return items
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      {msg ?? 'Sin datos para el período seleccionado'}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MetricasTallerView() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  const { data: ordenesData, loading: loadingO } = useApi<{ items: Orden[] }>('/api/sistema/ordenes')
  const { data: cajasData, loading: loadingC } = useApi<{ items: VentaCaja[] }>('/api/sistema/ventas-caja')

  const loading = loadingO || loadingC

  // ─── Filtered data ─────────────────────────────────────────────────────────
  const ordenes = useMemo(() => {
    if (!ordenesData?.items) return []
    return filterByPeriodo(ordenesData.items, periodo)
  }, [ordenesData, periodo])

  const ventas = useMemo(() => {
    if (!cajasData?.items) return []
    return filterVentasByPeriodo(cajasData.items, periodo)
  }, [cajasData, periodo])

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const totalFacturado = useMemo(() => {
    const fromOrdenes = ordenes.reduce((s, o) => s + (o.equivARS ?? 0), 0)
    const fromVentas = ventas.reduce((s, v) => s + (v.total ?? 0), 0)
    return fromOrdenes + fromVentas
  }, [ordenes, ventas])

  const gananciaTotal = useMemo(() => {
    const fromOrdenes = ordenes.reduce((s, o) => s + (o.gananciaReal ?? 0), 0)
    const fromVentas = ventas.reduce((s, v) => s + (v.gananciaReal ?? 0), 0)
    return fromOrdenes + fromVentas
  }, [ordenes, ventas])

  const nOperaciones = ordenes.length + ventas.length
  const ticketPromedio = nOperaciones > 0 ? totalFacturado / nOperaciones : 0

  // ─── Técnicos ──────────────────────────────────────────────────────────────
  const tecnicoStats = useMemo(() => {
    const map: Record<string, { ordenes: number; facturado: number; ganancia: number }> = {}
    for (const o of ordenes) {
      const t = o.tecnico || 'Sin asignar'
      if (!map[t]) map[t] = { ordenes: 0, facturado: 0, ganancia: 0 }
      map[t].ordenes++
      map[t].facturado += o.equivARS ?? 0
      map[t].ganancia += o.gananciaReal ?? 0
    }
    return Object.entries(map)
      .map(([nombre, s]) => ({ nombre, ...s, promedio: s.ordenes > 0 ? s.facturado / s.ordenes : 0 }))
      .sort((a, b) => b.ordenes - a.ordenes)
  }, [ordenes])

  const maxOrdenesT = tecnicoStats.length > 0 ? tecnicoStats[0].ordenes : 1

  // ─── Tipos de servicio ─────────────────────────────────────────────────────
  const tipoServiceStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of ordenes) {
      const t = o.tipoServicio || 'Sin especificar'
      map[t] = (map[t] ?? 0) + 1
    }
    const total = ordenes.length || 1
    return Object.entries(map)
      .map(([nombre, count]) => ({ nombre, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [ordenes])

  const maxTipoCount = tipoServiceStats.length > 0 ? tipoServiceStats[0].count : 1

  // ─── Modelos ───────────────────────────────────────────────────────────────
  const modeloStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of ordenes) {
      const m = o.modeloEquipo || 'Sin especificar'
      map[m] = (map[m] ?? 0) + 1
    }
    const total = ordenes.length || 1
    return Object.entries(map)
      .map(([nombre, count]) => ({ nombre, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [ordenes])

  const maxModeloCount = modeloStats.length > 0 ? modeloStats[0].count : 1

  // ─── Estados ───────────────────────────────────────────────────────────────
  const estadoStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of ordenes) {
      const e = o.estado || 'Sin estado'
      map[e] = (map[e] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [ordenes])

  // ─── Evolución mensual ─────────────────────────────────────────────────────
  const evolucionMensual = useMemo(() => {
    const allOrdenes = ordenesData?.items ?? []
    const now = new Date()
    const months: { label: string; key: string; count: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = MESES_SHORT[d.getMonth()]
      const count = allOrdenes.filter(o => o.fecha.startsWith(key)).length
      months.push({ label, key, count })
    }
    return months
  }, [ordenesData])

  const maxEvo = Math.max(...evolucionMensual.map(m => m.count), 1)

  // ─── Pill buttons ──────────────────────────────────────────────────────────
  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'año', label: 'Este año' },
    { key: 'todo', label: 'Todo' },
  ]

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 14 }}>
        Cargando métricas del taller…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Header + filtro ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR_TECH}18`, border: `1px solid ${COLOR_TECH}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🔧
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Métricas del Taller</div>
            <div style={{ fontSize: 12, color: C.muted }}>Análisis de rendimiento operativo</div>
          </div>
        </div>

        {/* Filtro de período */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${periodo === p.key ? COLOR_TECH : 'var(--border)'}`,
                background: periodo === p.key ? `${COLOR_TECH}18` : 'var(--surface)',
                color: periodo === p.key ? COLOR_TECH : C.muted,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: periodo === p.key ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KPICard
          label="Total órdenes"
          value={String(ordenes.length)}
          color={COLOR_TECH}
          icon="📋"
          sub={`+ ${ventas.length} ventas caja`}
        />
        <KPICard
          label="Total facturado"
          value={fmtARS(totalFacturado)}
          color={COLOR_REPAIR}
          icon="💰"
          sub={`Órdenes + caja`}
        />
        <KPICard
          label="Ganancia neta"
          value={fmtARS(gananciaTotal)}
          color={gananciaTotal >= 0 ? COLOR_REPAIR : '#f87171'}
          icon="📈"
          sub={totalFacturado > 0 ? `Margen: ${((gananciaTotal / totalFacturado) * 100).toFixed(1)}%` : undefined}
        />
        <KPICard
          label="Ticket promedio"
          value={fmtARS(ticketPromedio)}
          color={COLOR_MODEL}
          icon="🎯"
          sub={`${nOperaciones} operaciones`}
        />
      </div>

      {/* ── Rendimiento por técnico ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <SectionHeader title="Rendimiento por técnico" color={COLOR_TECH} />
        {tecnicoStats.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  {['Técnico', 'Órdenes', 'Facturado', 'Ganancia', 'Promedio', 'Progreso'].map(col => (
                    <th key={col} style={{ padding: '8px 10px', textAlign: col === 'Técnico' || col === 'Progreso' ? 'left' : 'right', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tecnicoStats.map((t, i) => (
                  <tr
                    key={t.nombre}
                    style={{ borderBottom: i < tecnicoStats.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 10px', color: C.text, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${COLOR_TECH}18`, border: `1px solid ${COLOR_TECH}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                          {t.nombre.charAt(0).toUpperCase()}
                        </div>
                        {t.nombre}
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: COLOR_TECH, fontWeight: 700, fontFamily: 'monospace' }}>{t.ordenes}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: C.text, fontFamily: 'monospace' }}>{fmtARS(t.facturado)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: t.ganancia >= 0 ? COLOR_REPAIR : '#f87171', fontFamily: 'monospace', fontWeight: 600 }}>{fmtARS(t.ganancia)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: C.muted, fontFamily: 'monospace' }}>{fmtARS(t.promedio)}</td>
                    <td style={{ padding: '10px 10px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(t.ordenes / maxOrdenesT) * 100}%`,
                            borderRadius: 4,
                            background: `linear-gradient(90deg, ${COLOR_TECH}cc, ${COLOR_TECH})`,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap', minWidth: 30, textAlign: 'right' }}>
                          {((t.ordenes / maxOrdenesT) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tipos de reparación + Modelos (2 columnas) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Tipos de reparación */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <SectionHeader title="Tipos de reparación más frecuentes" color={COLOR_REPAIR} />
          {tipoServiceStats.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tipoServiceStats.map((t, i) => (
                <div key={t.nombre}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, minWidth: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{t.nombre}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: COLOR_REPAIR, fontWeight: 700, fontFamily: 'monospace' }}>{t.count}</span>
                      <span style={{ fontSize: 10, color: C.muted }}>{t.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(t.count / maxTipoCount) * 100}%`,
                      borderRadius: 4,
                      background: `linear-gradient(90deg, ${COLOR_REPAIR}99, ${COLOR_REPAIR})`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modelos más reparados */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <SectionHeader title="Modelos más reparados" color={COLOR_MODEL} />
          {modeloStats.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modeloStats.map((m, i) => (
                <div key={m.nombre}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, minWidth: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{m.nombre}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: COLOR_MODEL, fontWeight: 700, fontFamily: 'monospace' }}>{m.count}</span>
                      <span style={{ fontSize: 10, color: C.muted }}>{m.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(m.count / maxModeloCount) * 100}%`,
                      borderRadius: 4,
                      background: `linear-gradient(90deg, ${COLOR_MODEL}99, ${COLOR_MODEL})`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Distribución por estado ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <SectionHeader title="Distribución por estado" color={C.orange} />
        {estadoStats.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {estadoStats.map(([estado, count]) => {
              const color = ESTADO_COLORS[estado] ?? '#94a3b8'
              return (
                <div
                  key={estado}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: `${color}12`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{estado}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'monospace' }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Evolución mensual ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <SectionHeader title="Evolución mensual (últimos 6 meses)" color={COLOR_CHART} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, paddingBottom: 28, paddingTop: 8, position: 'relative' }}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 28 + (i / 4) * 112,
                height: 1,
                background: 'var(--border)',
                opacity: 0.5,
              }}
            />
          ))}

          {evolucionMensual.map(m => {
            const pct = maxEvo > 0 ? (m.count / maxEvo) * 100 : 0
            const barH = Math.max(pct * 1.12, m.count > 0 ? 4 : 0)
            return (
              <div
                key={m.key}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative' }}
              >
                {/* Count label */}
                {m.count > 0 && (
                  <span style={{ fontSize: 10, color: COLOR_CHART, fontWeight: 700, fontFamily: 'monospace', position: 'absolute', bottom: 28 + barH + 4 }}>
                    {m.count}
                  </span>
                )}
                {/* Bar */}
                <div
                  style={{
                    width: '70%',
                    height: `${barH}px`,
                    borderRadius: '4px 4px 0 0',
                    background: `linear-gradient(180deg, ${COLOR_CHART}, ${COLOR_CHART}99)`,
                    transition: 'height 0.5s ease',
                    boxShadow: m.count > 0 ? `0 0 8px ${COLOR_CHART}40` : 'none',
                  }}
                />
                {/* X label */}
                <span style={{ position: 'absolute', bottom: 6, fontSize: 10, color: C.muted, fontWeight: 500 }}>
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
