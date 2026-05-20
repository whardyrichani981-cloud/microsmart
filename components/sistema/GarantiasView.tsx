'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Orden } from '@/lib/sistema-types'
import { fmtARS, C, inputSt } from './shared'

const COLOR = '#4ade80'

function formatDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

function getFechaEntregaReal(orden: Orden): string | null {
  // Buscar la PRIMERA entrega en el historial (no la más reciente).
  // La garantía no es acumulable: el vencimiento siempre es primera_entrega + diasGarantia.
  // Si el equipo reingresa y se vuelve a entregar, los días ya transcurridos se descuentan.
  const entry = (orden.historial ?? [])
    .find(h => h.tipo === 'estado' && h.descripcion.toLowerCase().includes('entregado'))
  if (entry) return entry.fecha
  // Fallback: si no hay historial, usar fecha de la orden
  return orden.fecha ?? null
}

function diasRestantes(fechaEntrega: string, diasGarantia: number): number {
  const entrega = new Date(fechaEntrega)
  const vencimiento = new Date(entrega.getTime() + diasGarantia * 24 * 60 * 60 * 1000)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000))
}

interface GarantiaRow {
  orden: Orden
  fechaEntregaReal: string
  diasRestantes: number
  vencimiento: string
}

function getEstadoColor(estado: string) {
  const map: Record<string, string> = {
    'Entrada': '#60a5fa', 'Técnico Saddi': '#a78bfa', 'Laboratorio': '#f472b6',
    'Salida de laboratorio': '#fb923c', 'Salida': '#4ade80', 'Entregado': '#8A8A8A',
  }
  return map[estado] ?? '#8A8A8A'
}

type FilterTipo = 'todas' | 'cf' | 'gremio'

export default function GarantiasView() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('todas')
  const [showVencidas, setShowVencidas] = useState(false)

  useEffect(() => {
    fetch('/api/sistema/ordenes')
      .then(r => r.json())
      .then((data: { items?: Orden[] } | Orden[]) => {
        const list: Orden[] = Array.isArray(data) ? data : (data.items ?? [])
        const entregadas = list.filter(o => o.estado === 'Entregado' && o.garantia === true)
        setOrdenes(entregadas)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo<GarantiaRow[]>(() => {
    return ordenes.map(o => {
      const fechaEntregaReal = getFechaEntregaReal(o) ?? o.fecha
      const dias = diasRestantes(fechaEntregaReal, o.diasGarantia ?? 90)
      const venc = new Date(new Date(fechaEntregaReal).getTime() + (o.diasGarantia ?? 90) * 86400000)
      return {
        orden: o,
        fechaEntregaReal,
        diasRestantes: dias,
        vencimiento: venc.toISOString(),
      }
    }).sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [ordenes])

  const q = search.toLowerCase()
  const filtered = rows.filter(r => {
    const o = r.orden
    const matchTipo = filterTipo === 'todas' || (filterTipo === 'cf' ? o.tipo === 'Cliente final' : o.tipo === 'Gremio')
    const matchQ = !q || o.nombreCliente.toLowerCase().includes(q) || o.modeloEquipo.toLowerCase().includes(q) ||
      o.telefonoCliente?.includes(q) || String(o.nOrden).includes(q)
    return matchTipo && matchQ
  })

  const vigentes    = filtered.filter(r => r.diasRestantes > 7)
  const porVencer   = filtered.filter(r => r.diasRestantes > 0 && r.diasRestantes <= 7)
  const vencidas    = filtered.filter(r => r.diasRestantes <= 0)

  // KPIs totales (sin filtro de búsqueda)
  const totalVigentes  = rows.filter(r => r.diasRestantes > 0).length
  const totalPorVencer = rows.filter(r => r.diasRestantes > 0 && r.diasRestantes <= 7).length
  const totalVencidas  = rows.filter(r => r.diasRestantes <= 0).length

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>Cargando…</div>

  const Row = ({ r }: { r: GarantiaRow }) => {
    const o = r.orden
    const urgente = r.diasRestantes <= 0
    const porVenc = r.diasRestantes > 0 && r.diasRestantes <= 7
    const colorDias = urgente ? '#ef4444' : porVenc ? '#fb923c' : COLOR

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '52px 1fr 140px 120px 100px 90px 90px',
        padding: '12px 16px', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: urgente ? 'rgba(239,68,68,0.04)' : porVenc ? 'rgba(251,146,60,0.04)' : 'var(--surface)',
      }}>
        {/* # Orden */}
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: getEstadoColor(o.estado),
          }}>#{o.nOrden}</span>
        </div>

        {/* Cliente + modelo */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.nombreCliente}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {o.modeloEquipo || '—'}
            {o.tipoServicio ? ` · ${o.tipoServicio}` : ''}
          </div>
          {o.telefonoCliente && (
            <div style={{ fontSize: 11, color: C.muted }}>📞 {o.telefonoCliente}</div>
          )}
        </div>

        {/* Fecha entrega */}
        <div style={{ fontSize: 12, color: C.muted }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 2 }}>ENTREGADO</div>
          {formatDate(r.fechaEntregaReal)}
        </div>

        {/* Vencimiento */}
        <div style={{ fontSize: 12, color: C.muted }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 2 }}>VENCE</div>
          <span style={{ color: colorDias, fontWeight: 600 }}>{formatDate(r.vencimiento)}</span>
        </div>

        {/* Días garantía */}
        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted }}>
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>GARANTÍA</div>
          {o.diasGarantia ?? 90}d
        </div>

        {/* Días restantes */}
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontSize: 15, fontWeight: 800,
            color: colorDias,
            background: `${colorDias}15`,
            padding: '3px 10px', borderRadius: 8,
          }}>
            {urgente ? `−${Math.abs(r.diasRestantes)}d` : `${r.diasRestantes}d`}
          </span>
        </div>

        {/* Tipo */}
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
            background: o.tipo === 'Cliente final' ? `${COLOR}18` : 'rgba(96,165,250,0.15)',
            color: o.tipo === 'Cliente final' ? COLOR : '#60a5fa',
          }}>
            {o.tipo === 'Cliente final' ? 'Cliente final' : 'Gremio'}
          </span>
        </div>
      </div>
    )
  }

  const Section = ({ title, color, items, defaultOpen = true }: { title: string; color: string; items: GarantiaRow[]; defaultOpen?: boolean }) => {
    const [open, setOpen] = useState(defaultOpen)
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', background: `${color}10`,
            border: `1px solid ${color}33`, borderRadius: open ? '10px 10px 0 0' : 10,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{title}</span>
          <span style={{
            fontSize: 11, fontWeight: 800, background: `${color}22`, color,
            padding: '2px 8px', borderRadius: 10,
          }}>{items.length}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <div style={{ border: `1px solid ${color}22`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            {/* Encabezado */}
            <div style={{
              display: 'grid', gridTemplateColumns: '52px 1fr 140px 120px 100px 90px 90px',
              padding: '7px 16px',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
              fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span>Cliente / Equipo</span>
              <span>Entregado</span>
              <span>Vence</span>
              <span style={{ textAlign: 'center' }}>Garantía</span>
              <span style={{ textAlign: 'center' }}>Días</span>
              <span style={{ textAlign: 'right' }}>Tipo</span>
            </div>
            {items.map(r => <Row key={r.orden.id} r={r} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          🛡️ Garantías Activas
          {totalPorVencer > 0 && (
            <span style={{ fontSize: 12, background: '#fb923c', color: '#fff', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>
              {totalPorVencer} vencen esta semana
            </span>
          )}
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>Órdenes entregadas con garantía vigente · Solo órdenes marcadas con garantía</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}33` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>✅ EN GARANTÍA</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: COLOR }}>{totalVigentes}</div>
          <div style={{ fontSize: 12, color: C.muted }}>reparaciones cubiertas</div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>⚠️ VENCE ESTA SEMANA</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fb923c' }}>{totalPorVencer}</div>
          <div style={{ fontSize: 12, color: C.muted }}>vencen en ≤ 7 días</div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>❌ VENCIDAS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{totalVencidas}</div>
          <div style={{ fontSize: 12, color: C.muted }}>garantías expiradas</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar cliente, modelo, # orden..."
          style={{ ...inputSt, flex: 1, minWidth: 200, fontSize: 13 }}
        />
        {(['todas', 'cf', 'gremio'] as FilterTipo[]).map(t => (
          <button key={t} onClick={() => setFilterTipo(t)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filterTipo === t ? `${COLOR}22` : 'var(--surface2)',
            color: filterTipo === t ? COLOR : C.muted,
            outline: filterTipo === t ? `1.5px solid ${COLOR}` : 'none',
          }}>
            {t === 'todas' ? 'Todas' : t === 'cf' ? 'Cliente final' : 'Gremio'}
          </button>
        ))}
        <button onClick={() => setShowVencidas(v => !v)} style={{
          padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: showVencidas ? 'rgba(239,68,68,0.15)' : 'var(--surface2)',
          color: showVencidas ? '#ef4444' : C.muted,
        }}>
          {showVencidas ? '👁 Ocultar vencidas' : '👁 Ver vencidas'}
        </button>
      </div>

      {/* Sin datos */}
      {ordenes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            No hay garantías activas
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Las órdenes aparecen acá cuando están en estado <b>Entregado</b> y tienen <b>Garantía</b> activada.<br />
            Activá el toggle de garantía al crear o editar una orden.
          </div>
        </div>
      )}

      {/* Secciones */}
      <Section title="⚠️ Vencen esta semana — avisale al cliente" color="#fb923c" items={porVencer} />
      <Section title="✅ En garantía" color={COLOR} items={vigentes} />
      {showVencidas && (
        <Section title="❌ Garantías vencidas (últimas 30 días)" color="#ef4444" items={vencidas} defaultOpen={false} />
      )}
    </div>
  )
}
