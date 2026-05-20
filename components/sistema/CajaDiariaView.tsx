'use client'
import { useState, useEffect, useCallback } from 'react'
import type { VentaCaja, CierreCaja } from '@/lib/sistema-types'
import { C, Modal, Field, PageHeader, Badge } from './shared'

const COLOR = '#F5C400'
const COLOR_DARK = '#b8920a'

const METODOS: string[] = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito', 'Cheque']

const METHOD_COLOR: Record<string, string> = {
  'Efectivo':        '#4ade80',
  'Transferencia':   '#60a5fa',
  'Mercado Pago':    '#818cf8',
  'Tarjeta Débito':  '#fb923c',
  'Tarjeta Crédito': '#f472b6',
  'Cheque':          '#a3e635',
}
const METHOD_ICON: Record<string, string> = {
  'Efectivo':        '💵',
  'Transferencia':   '🏦',
  'Mercado Pago':    '🔵',
  'Tarjeta Débito':  '💳',
  'Tarjeta Crédito': '💳',
  'Cheque':          '📄',
}

function fmt(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function nowISO() { return new Date().toISOString() }

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPI({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  )
}

// ─── Method Row ──────────────────────────────────────────────────────────────
function MetodoRow({ metodo, total, count, pct }: { metodo: string; total: number; count: number; pct: number }) {
  const color = METHOD_COLOR[metodo] ?? C.muted
  const icon = METHOD_ICON[metodo] ?? '💰'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1.5px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{metodo}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{count} venta{count !== 1 ? 's' : ''} · {pct.toFixed(1)}%</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color }}>{fmt(total)}</div>
      </div>
      {/* Progress bar */}
      <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Venta Row ───────────────────────────────────────────────────────────────
function VentaRow({ v }: { v: VentaCaja }) {
  const color = METHOD_COLOR[v.metodoPago] ?? C.muted
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '60px 1fr 130px 110px 100px',
      gap: 12, padding: '10px 14px',
      borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: 13,
    }}>
      <span style={{ fontFamily: 'monospace', color: COLOR, fontWeight: 700 }}>#{v.nVenta}</span>
      <div>
        <div style={{ fontWeight: 600 }}>{v.clienteNombre || <span style={{ color: C.muted }}>Sin nombre</span>}</div>
        {v.items?.length > 0 && (
          <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.items.map(i => i.nombre).join(', ')}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: C.muted }}>{v.hora}</span>
      <span>
        <Badge label={v.metodoPago} color={color} />
      </span>
      <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{fmt(v.total)}</span>
    </div>
  )
}

// ─── Cierre Row ──────────────────────────────────────────────────────────────
function CierreRow({ c, onDelete }: { c: CierreCaja; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const metodos = Object.entries(c.desglosePorMetodo).filter(([, v]) => v > 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setOpen(p => !p)}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}18`, border: `1.5px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Cierre del {fmtDate(c.fecha)}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{c.cantidadVentas} ventas · {new Date(c.fechaHoraCierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#4ade80' }}>{fmt(c.totalGeneral)}</div>
        <span style={{ color: C.muted, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {metodos.map(([m, v]) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span>{METHOD_ICON[m] ?? '💰'}</span>
              <span style={{ flex: 1, color: C.muted }}>{m}</span>
              <span style={{ fontWeight: 700, color: METHOD_COLOR[m] ?? C.muted }}>{fmt(v)}</span>
            </div>
          ))}
          {c.observaciones && (
            <div style={{ marginTop: 4, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>📝 {c.observaciones}</div>
          )}
          <button onClick={onDelete} style={{
            marginTop: 6, alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Eliminar cierre</button>
        </div>
      )}
    </div>
  )
}

// ─── Main View ───────────────────────────────────────────────────────────────
export default function CajaDiariaView() {
  const [ventas, setVentas] = useState<VentaCaja[]>([])
  const [cierres, setCierres] = useState<CierreCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(todayISO())
  const [tab, setTab] = useState<'dia' | 'historial'>('dia')
  const [showCerrar, setShowCerrar] = useState(false)
  const [obsModal, setObsModal] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, cRes] = await Promise.all([
        fetch('/api/sistema/ventas-caja'),
        fetch('/api/sistema/caja-diaria'),
      ])
      if (vRes.ok) {
        const d = await vRes.json()
        setVentas(Array.isArray(d) ? d : (d.items ?? []))
      }
      if (cRes.ok) {
        const d = await cRes.json()
        setCierres(Array.isArray(d) ? d : [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived data ──
  const ventasDia = ventas.filter(v => v.fecha === fecha)

  // Ventas no incluidas en ningún cierre del mismo día
  const cerradasIds = new Set(
    cierres.filter(c => c.fecha === fecha).flatMap(c => c.ventaIds)
  )
  const ventasPendientes = ventasDia.filter(v => !cerradasIds.has(v.id))
  const yaHayCierre = cierres.some(c => c.fecha === fecha)

  // Desgloses
  const desgloseTotal = computeDesglose(ventasDia)
  const desglosePendiente = computeDesglose(ventasPendientes)

  const totalDia = ventasDia.reduce((s, v) => s + v.total, 0)
  const totalPendiente = ventasPendientes.reduce((s, v) => s + v.total, 0)
  const maxTotal = Math.max(...Object.values(desgloseTotal).map(d => d.total), 1)

  // ── Cerrar Caja ──
  const cerrarCaja = async () => {
    if (ventasPendientes.length === 0) return
    setSaving(true)
    const desglosePorMetodo: Record<string, number> = {}
    for (const [metodo, d] of Object.entries(desglosePendiente)) {
      desglosePorMetodo[metodo] = d.total
    }
    const payload: Omit<CierreCaja, 'id'> = {
      fecha,
      fechaHoraCierre: nowISO(),
      totalGeneral: totalPendiente,
      cantidadVentas: ventasPendientes.length,
      desglosePorMetodo,
      ventaIds: ventasPendientes.map(v => v.id),
      observaciones: obsModal.trim() || undefined,
    }
    try {
      const r = await fetch('/api/sistema/caja-diaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) {
        await load()
        setShowCerrar(false)
        setObsModal('')
      }
    } finally { setSaving(false) }
  }

  const deleteCierre = async (id: string) => {
    await fetch('/api/sistema/caja-diaria', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const TABS = [
    { id: 'dia' as const, label: '📅 Vista del Día' },
    { id: 'historial' as const, label: '📋 Historial de Cierres' },
  ]

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        icon="🏧"
        title="Caja Diaria"
        desc="Resumen de ventas y cierre de caja por día"
        color={COLOR}
        count={ventasDia.length}
        extra={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13,
              }}
            />
            {tab === 'dia' && (
              <button
                onClick={() => { setObsModal(''); setShowCerrar(true) }}
                disabled={ventasPendientes.length === 0}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: ventasPendientes.length > 0 ? COLOR : 'var(--border)',
                  color: ventasPendientes.length > 0 ? '#000' : C.muted,
                  border: 'none', fontWeight: 700, fontSize: 13,
                  cursor: ventasPendientes.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                🔒 Cerrar Caja
              </button>
            )}
          </div>
        }
      />

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '9px 20px', border: 'none', borderRadius: '8px 8px 0 0',
              background: active ? `${COLOR}18` : 'transparent',
              borderBottom: active ? `2px solid ${COLOR}` : '2px solid transparent',
              color: active ? COLOR : C.muted,
              fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer',
            }}>{t.label}</button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Cargando...</div>
      ) : tab === 'dia' ? (
        <DiaTab
          fecha={fecha}
          ventasDia={ventasDia}
          ventasPendientes={ventasPendientes}
          desgloseTotal={desgloseTotal}
          totalDia={totalDia}
          totalPendiente={totalPendiente}
          maxTotal={maxTotal}
          yaHayCierre={yaHayCierre}
          cierresDia={cierres.filter(c => c.fecha === fecha)}
          onDeleteCierre={deleteCierre}
        />
      ) : (
        <HistorialTab cierres={cierres} onDelete={deleteCierre} />
      )}

      {/* Modal Cerrar Caja */}
      {showCerrar && (
        <Modal
          title="🔒 Cerrar Caja"
          onClose={() => setShowCerrar(false)}
          onSubmit={cerrarCaja}
          submitting={saving}
          submitLabel="Confirmar Cierre"
          submitColor={COLOR}
          width={500}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(245,196,0,0.08)', border: '1px solid rgba(245,196,0,0.25)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLOR, marginBottom: 10 }}>Resumen de cierre</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: C.muted }}>Fecha</span>
                <span style={{ fontWeight: 700 }}>{fmtDate(fecha)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: C.muted }}>Ventas a cerrar</span>
                <span style={{ fontWeight: 700 }}>{ventasPendientes.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, color: '#4ade80' }}>{fmt(totalPendiente)}</span>
              </div>
            </div>
            {/* Desglose */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desglose por método</div>
              {Object.entries(desglosePendiente).filter(([, d]) => d.count > 0).map(([m, d]) => (
                <div key={m} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--surface)' }}>
                  <span>{METHOD_ICON[m] ?? '💰'}</span>
                  <span style={{ flex: 1, color: C.muted }}>{m}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{d.count} vta{d.count !== 1 ? 's' : ''}</span>
                  <span style={{ fontWeight: 700, color: METHOD_COLOR[m] ?? C.muted }}>{fmt(d.total)}</span>
                </div>
              ))}
            </div>
            <Field label="Observaciones (opcional)">
              <textarea
                value={obsModal}
                onChange={e => setObsModal(e.target.value)}
                rows={2}
                placeholder="Ej: Falta de $200 en efectivo..."
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--input-bg)',
                  color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function computeDesglose(ventas: VentaCaja[]): Record<string, { total: number; count: number }> {
  const d: Record<string, { total: number; count: number }> = {}
  for (const m of METODOS) d[m] = { total: 0, count: 0 }
  for (const v of ventas) {
    const m = v.metodoPago
    if (!d[m]) d[m] = { total: 0, count: 0 }
    d[m].total += v.total
    d[m].count++
  }
  return d
}

// ─── Día Tab ──────────────────────────────────────────────────────────────────
function DiaTab({ fecha, ventasDia, ventasPendientes, desgloseTotal, totalDia, totalPendiente, maxTotal, yaHayCierre, cierresDia, onDeleteCierre }: {
  fecha: string
  ventasDia: VentaCaja[]
  ventasPendientes: VentaCaja[]
  desgloseTotal: Record<string, { total: number; count: number }>
  totalDia: number
  totalPendiente: number
  maxTotal: number
  yaHayCierre: boolean
  cierresDia: CierreCaja[]
  onDeleteCierre: (id: string) => void
}) {
  const ventasConMetodo = METODOS.filter(m => desgloseTotal[m]?.count > 0)
  const porcentajeMetodo = (m: string) =>
    maxTotal > 0 ? (desgloseTotal[m]?.total / maxTotal) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KPI label="Total del día" value={fmt(totalDia)} icon="💰" color={COLOR} sub={`${ventasDia.length} ventas`} />
        <KPI label="Por cerrar" value={fmt(totalPendiente)} icon="⏳" color={ventasPendientes.length > 0 ? '#fb923c' : '#4ade80'} sub={`${ventasPendientes.length} sin cerrar`} />
        <KPI label="Cierres hoy" value={String(cierresDia.length)} icon="🔒" color={cierresDia.length > 0 ? '#4ade80' : C.muted} />
        <KPI label="Promedio venta" value={ventasDia.length > 0 ? fmt(totalDia / ventasDia.length) : '—'} icon="📊" color="#60a5fa" />
      </div>

      {/* Alerta si ya hay cierre pero hay ventas pendientes */}
      {yaHayCierre && ventasPendientes.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)',
          fontSize: 13, color: '#fb923c', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span>⚠️</span>
          <span>Hay {ventasPendientes.length} venta{ventasPendientes.length !== 1 ? 's' : ''} realizadas después del último cierre. Podés hacer otro cierre para incluirlas.</span>
        </div>
      )}

      {/* Empty state */}
      {ventasDia.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏧</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin ventas el {fmtDate(fecha)}</div>
          <div style={{ fontSize: 13 }}>Las ventas realizadas desde la Caja aparecerán aquí.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Desglose por método */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Desglose por método de pago</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ventasConMetodo.length === 0
                ? <div style={{ color: C.muted, fontSize: 13 }}>Sin datos</div>
                : ventasConMetodo.map(m => (
                  <MetodoRow
                    key={m}
                    metodo={m}
                    total={desgloseTotal[m].total}
                    count={desgloseTotal[m].count}
                    pct={porcentajeMetodo(m)}
                  />
                ))
              }
            </div>
          </div>

          {/* Cierres del día */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Cierres del día</div>
            {cierresDia.length === 0 ? (
              <div style={{
                padding: '24px 16px', textAlign: 'center', color: C.muted, fontSize: 13,
                background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                Sin cierres para esta fecha.<br />Usá el botón <strong>"Cerrar Caja"</strong> para registrar.
              </div>
            ) : (
              cierresDia.map(c => <CierreRow key={c.id} c={c} onDelete={() => onDeleteCierre(c.id)} />)
            )}
          </div>
        </div>
      )}

      {/* Detalle de ventas */}
      {ventasDia.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Detalle de ventas del día</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 130px 110px 100px',
              gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
            }}>
              <span>#</span><span>Cliente / Artículos</span><span>Hora</span><span>Método</span><span style={{ textAlign: 'right' }}>Total</span>
            </div>
            {ventasDia.slice().reverse().map(v => <VentaRow key={v.id} v={v} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Historial Tab ────────────────────────────────────────────────────────────
function HistorialTab({ cierres, onDelete }: { cierres: CierreCaja[]; onDelete: (id: string) => void }) {
  const sorted = [...cierres].sort((a, b) => b.fecha.localeCompare(a.fecha))

  // Group by month
  const byMonth: Record<string, CierreCaja[]> = {}
  for (const c of sorted) {
    const key = c.fecha.slice(0, 7) // YYYY-MM
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(c)
  }

  if (cierres.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin historial de cierres</div>
        <div style={{ fontSize: 13 }}>Los cierres de caja aparecerán aquí una vez que los registres.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Global summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <KPI label="Total histórico" value={fmt(cierres.reduce((s, c) => s + c.totalGeneral, 0))} icon="💰" color={COLOR} />
        <KPI label="Total cierres" value={String(cierres.length)} icon="🔒" color="#60a5fa" />
        <KPI label="Promedio por cierre" value={cierres.length > 0 ? fmt(cierres.reduce((s, c) => s + c.totalGeneral, 0) / cierres.length) : '—'} icon="📊" color="#4ade80" />
      </div>

      {Object.entries(byMonth).map(([month, list]) => {
        const [y, m] = month.split('-')
        const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })
        const monthTotal = list.reduce((s, c) => s + c.totalGeneral, 0)
        return (
          <div key={month}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📅 {monthName}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{fmt(monthTotal)}</div>
            </div>
            {list.map(c => <CierreRow key={c.id} c={c} onDelete={() => onDelete(c.id)} />)}
          </div>
        )
      })}
    </div>
  )
}
