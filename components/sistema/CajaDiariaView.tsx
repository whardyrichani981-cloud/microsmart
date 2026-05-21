'use client'
import { useState, useEffect, useCallback } from 'react'
import type { VentaCaja, CierreCaja, SesionCaja } from '@/lib/sistema-types'
import { C, Modal, Field, PageHeader, Badge } from './shared'

const COLOR = '#F5C400'

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
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface Props {
  currentUser?: string
  role?: string
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
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

// ─── Method Row ───────────────────────────────────────────────────────────────
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
      <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Venta Row ────────────────────────────────────────────────────────────────
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
            {v.items.map((i: { nombre: string }) => i.nombre).join(', ')}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: C.muted }}>{v.hora}</span>
      <span>
        {v.pagos && v.pagos.length > 1
          ? <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {v.pagos.map((p, i) => (
                <Badge key={i} label={`${p.metodo.split(' ')[0]} $${p.monto.toLocaleString('es-AR')}`} color={METHOD_COLOR[p.metodo] ?? C.muted} />
              ))}
            </span>
          : <Badge label={v.metodoPago} color={color} />}
      </span>
      <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{fmt(v.total)}</span>
    </div>
  )
}

// ─── Cierre Row (historial legacy) ────────────────────────────────────────────
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
          {c.observaciones && <div style={{ marginTop: 4, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>📝 {c.observaciones}</div>}
          <button onClick={onDelete} style={{ marginTop: 6, alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Eliminar cierre</button>
        </div>
      )}
    </div>
  )
}

// ─── Sesión Row (historial nuevo) ─────────────────────────────────────────────
function SesionRow({ s }: { s: SesionCaja }) {
  const [open, setOpen] = useState(false)
  const metodos = Object.entries(s.desglosePorMetodo ?? {}).filter(([, v]) => v > 0)
  const cerrada = s.estado === 'cerrada'
  const diff = s.diferencia ?? 0
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${cerrada ? 'var(--border)' : 'rgba(245,196,0,0.35)'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setOpen(p => !p)}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cerrada ? `${COLOR}18` : 'rgba(245,196,0,0.12)', border: `1.5px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {cerrada ? '🔒' : '🔓'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {fmtDate(s.fecha)}
            <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 7px', borderRadius: 5, background: cerrada ? 'rgba(74,222,128,0.12)' : 'rgba(245,196,0,0.15)', color: cerrada ? '#4ade80' : COLOR, fontWeight: 700 }}>
              {cerrada ? '✓ Cerrada' : '● Abierta'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Abierta por {s.operadorApertura} a las {fmtTime(s.horaApertura)}
            {cerrada && s.operadorCierre && ` · Cerrada por ${s.operadorCierre} a las ${fmtTime(s.horaCierre!)}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#4ade80' }}>{fmt(s.totalGeneral ?? 0)}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{s.cantidadVentas ?? 0} ventas</div>
        </div>
        <span style={{ color: C.muted, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Fondo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, fontWeight: 700 }}>FONDO INICIAL</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{fmt(s.efectivoInicial)}</div>
            </div>
            {cerrada && s.efectivoContado !== undefined && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, fontWeight: 700 }}>EFECTIVO CONTADO</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{fmt(s.efectivoContado)}</div>
              </div>
            )}
            {cerrada && s.efectivoEnCaja !== undefined && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, fontWeight: 700 }}>FONDO PARA MAÑANA</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#4ade80' }}>{fmt(s.efectivoEnCaja)}</div>
              </div>
            )}
          </div>
          {/* Diferencia */}
          {cerrada && s.diferencia !== undefined && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: diff === 0 ? 'rgba(74,222,128,0.08)' : diff > 0 ? 'rgba(96,165,250,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${diff === 0 ? 'rgba(74,222,128,0.25)' : diff > 0 ? 'rgba(96,165,250,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted }}>Diferencia de efectivo</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: diff === 0 ? '#4ade80' : diff > 0 ? '#60a5fa' : '#ef4444' }}>
                {diff > 0 ? '+' : ''}{fmt(diff)}
              </span>
            </div>
          )}
          {/* Métodos */}
          {metodos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {metodos.map(([m, v]) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>{METHOD_ICON[m] ?? '💰'}</span>
                  <span style={{ flex: 1, color: C.muted }}>{m}</span>
                  <span style={{ fontWeight: 700, color: METHOD_COLOR[m] ?? C.muted }}>{fmt(v)}</span>
                </div>
              ))}
            </div>
          )}
          {/* Observaciones */}
          {s.observaciones && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>📝 {s.observaciones}</div>}
          {/* Intervenciones admin */}
          {(s.intervencionesAdmin ?? []).length > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>INTERVENCIONES ADMIN</div>
              {s.intervencionesAdmin!.map((iv, i) => (
                <div key={i} style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
                  🔑 {fmtTime(iv.fechaHora)} · {iv.operador} · {iv.detalle}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────
export default function CajaDiariaView({ currentUser = 'Sistema', role = 'employee' }: Props) {
  const isAdmin = role === 'admin' || role === 'superadmin'

  const [ventas, setVentas]     = useState<VentaCaja[]>([])
  const [cierres, setCierres]   = useState<CierreCaja[]>([])       // legacy
  const [sesiones, setSesiones] = useState<SesionCaja[]>([])
  const [sesionHoy, setSesionHoy] = useState<SesionCaja | null>(null)
  const [fondoInicial, setFondoInicial] = useState(0)              // del último cierre
  const [loading, setLoading]   = useState(true)
  const [fecha, setFecha]       = useState(todayISO())
  const [tab, setTab]           = useState<'dia' | 'historial'>('dia')
  const [saving, setSaving]     = useState(false)

  // ── Modal apertura ──
  const [showAbrir, setShowAbrir] = useState(false)

  // ── Modal cierre (3 pasos) ──
  const [showCerrar, setShowCerrar]           = useState(false)
  const [pasosCierre, setPasosCierre]         = useState<1 | 2 | 3>(1)
  const [efectivoContado, setEfectivoContado] = useState(0)
  const [efectivoEnCaja, setEfectivoEnCaja]   = useState(0)
  const [obsModal, setObsModal]               = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch each independently so one failure doesn't block the rest
      await fetch('/api/sistema/ventas-caja')
        .then(r => r.json()).then(d => setVentas(Array.isArray(d) ? d : (d.items ?? []))).catch(() => {})
      await fetch('/api/sistema/caja-diaria')
        .then(r => r.json()).then(d => setCierres(Array.isArray(d) ? d : [])).catch(() => {})
      // Sesiones: load all + load today's specifically
      const [sData, hoyData] = await Promise.all([
        fetch('/api/sistema/sesiones-caja').then(r => r.json()).catch(() => ({ sesiones: [] })),
        fetch(`/api/sistema/sesiones-caja?fecha=${todayISO()}`).then(r => r.json()).catch(() => ({ sesion: null, efectivoInicial: 0 })),
      ])
      setSesiones(sData.sesiones ?? [])
      setSesionHoy(hoyData.sesion ?? null)
      setFondoInicial(hoyData.efectivoInicial ?? 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived data para el día seleccionado ──
  const ventasDia = ventas.filter(v => v.fecha === fecha)
  const sesionFecha = sesiones.find(s => s.fecha === fecha) ?? null
  const esDiaCerrado = sesionFecha?.estado === 'cerrada'
  const esHoy = fecha === todayISO()

  // Legacy cierres (por si hay datos viejos)
  const cierresDia = cierres.filter(c => c.fecha === fecha)

  const desgloseTotal = computeDesglose(ventasDia)
  const totalDia = ventasDia.reduce((s, v) => s + v.total, 0)
  const maxTotal = Math.max(...Object.values(desgloseTotal).map(d => d.total), 1)
  const ventasConMetodo = METODOS.filter(m => desgloseTotal[m]?.count > 0)

  // Efectivo total esperado = fondo inicial + ventas en efectivo
  const efectivoVentasEfectivo = desgloseTotal['Efectivo']?.total ?? 0

  // ── Abrir caja ──
  const abrirCaja = async () => {
    setSaving(true)
    try {
      await fetch('/api/sistema/sesiones-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: todayISO(),
          operadorApertura: currentUser,
          horaApertura: new Date().toISOString(),
          efectivoInicial: fondoInicial,
        }),
      })
      await load()
      setShowAbrir(false)
    } finally { setSaving(false) }
  }

  // ── Cerrar caja ──
  const cerrarCaja = async () => {
    if (!sesionHoy) return
    setSaving(true)

    const efectivoEsperado = fondoInicial + efectivoVentasEfectivo
    const diferencia = efectivoContado - efectivoEsperado
    const efectivoRetirado = Math.max(0, efectivoContado - efectivoEnCaja)

    const desglosePorMetodo: Record<string, number> = {}
    for (const [m, d] of Object.entries(desgloseTotal)) {
      if (d.total > 0) desglosePorMetodo[m] = d.total
    }

    try {
      await fetch('/api/sistema/sesiones-caja', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sesionHoy.id,
          estado: 'cerrada',
          operadorCierre: currentUser,
          horaCierre: new Date().toISOString(),
          efectivoVentasEfectivo,
          efectivoContado,
          diferencia,
          efectivoEnCaja,
          efectivoRetirado,
          totalGeneral: totalDia,
          cantidadVentas: ventasDia.length,
          desglosePorMetodo,
          ventaIds: ventasDia.map(v => v.id),
          observaciones: obsModal.trim() || undefined,
        }),
      })
      await load()
      setShowCerrar(false)
      setPasosCierre(1)
      setObsModal('')
    } finally { setSaving(false) }
  }

  // ── Reabrir caja (admin) ──
  const reabrirCaja = async () => {
    if (!sesionHoy) return
    setSaving(true)
    try {
      await fetch('/api/sistema/sesiones-caja', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sesionHoy.id, adminReabrir: true, adminOperador: currentUser }),
      })
      await load()
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

  const abrirModal = () => {
    setPasosCierre(1)
    setEfectivoContado(fondoInicial + efectivoVentasEfectivo)
    setEfectivoEnCaja(0)
    setObsModal('')
    setShowCerrar(true)
  }

  // ── Estado de la caja hoy ──
  const cajaAbierta = sesionHoy?.estado === 'abierta'
  const cajaCerrada = sesionHoy?.estado === 'cerrada'
  const cajaSinAbrir = !sesionHoy

  const efectivoEsperado = fondoInicial + efectivoVentasEfectivo
  const diferencia = efectivoContado - efectivoEsperado

  const TABS = [
    { id: 'dia' as const, label: '📅 Vista del Día' },
    { id: 'historial' as const, label: '📋 Historial' },
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
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13 }}
            />
            {/* Botones sólo para hoy */}
            {esHoy && tab === 'dia' && (
              <>
                {cajaSinAbrir && (
                  <button onClick={() => setShowAbrir(true)} style={{ padding: '8px 18px', borderRadius: 8, background: COLOR, color: '#000', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    🔓 Abrir Caja
                  </button>
                )}
                {cajaAbierta && ventasDia.length > 0 && (
                  <button onClick={abrirModal} style={{ padding: '8px 18px', borderRadius: 8, background: COLOR, color: '#000', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    🔒 Cerrar Caja
                  </button>
                )}
                {cajaCerrada && isAdmin && (
                  <button onClick={reabrirCaja} disabled={saving} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: saving ? 'wait' : 'pointer' }}>
                    🔑 Reabrir caja
                  </button>
                )}
              </>
            )}
            {/* Si el día no es hoy y está cerrado */}
            {!esHoy && esDiaCerrado && isAdmin && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                🔑 Modo admin activo
              </span>
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
          esHoy={esHoy}
          isAdmin={isAdmin}
          sesionFecha={sesionFecha}
          sesionHoy={sesionHoy}
          fondoInicial={fondoInicial}
          ventasDia={ventasDia}
          desgloseTotal={desgloseTotal}
          totalDia={totalDia}
          maxTotal={maxTotal}
          ventasConMetodo={ventasConMetodo}
          cierresDia={cierresDia}
          onDeleteCierre={deleteCierre}
          cajaSinAbrir={cajaSinAbrir}
          onAbrirCaja={() => setShowAbrir(true)}
          onReabrirCaja={reabrirCaja}
          saving={saving}
        />
      ) : (
        <HistorialTab sesiones={sesiones} cierres={cierres} onDelete={deleteCierre} />
      )}

      {/* ── Modal Abrir Caja ────────────────────────────────────────────────── */}
      {showAbrir && (
        <Modal
          title="🔓 Abrir Caja"
          onClose={() => setShowAbrir(false)}
          onSubmit={abrirCaja}
          submitting={saving}
          submitLabel="Confirmar Apertura"
          submitColor={COLOR}
          width={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(245,196,0,0.08)', border: '1px solid rgba(245,196,0,0.25)' }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Operador</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>👤 {currentUser}</div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Fondo inicial en caja</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>{fmt(fondoInicial)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {fondoInicial > 0 ? 'Dejado por el cierre del día anterior' : 'Sin fondo registrado (primer apertura)'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              Al confirmar quedará registrada la apertura. Podés empezar a cargar ventas.
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Cerrar Caja (3 pasos) ─────────────────────────────────────── */}
      {showCerrar && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 499, backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!saving) { setShowCerrar(false); setPasosCierre(1) } }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 500, width: 480, maxHeight: '90vh', borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>🔒 Cerrar Caja — Paso {pasosCierre} de 3</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {pasosCierre === 1 ? 'Conteo de efectivo' : pasosCierre === 2 ? 'Fondo para mañana' : 'Confirmar cierre'}
                </div>
              </div>
              {!saving && (
                <button onClick={() => { setShowCerrar(false); setPasosCierre(1) }} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: C.muted, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              )}
            </div>

            {/* Steps indicator */}
            <div style={{ display: 'flex', padding: '10px 22px', gap: 6 }}>
              {([1, 2, 3] as const).map(n => (
                <div key={n} style={{ flex: 1, height: 4, borderRadius: 99, background: pasosCierre >= n ? COLOR : 'var(--border)', transition: 'background 0.2s' }} />
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── PASO 1: conteo efectivo ── */}
              {pasosCierre === 1 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700 }}>FONDO INICIAL</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{fmt(fondoInicial)}</div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700 }}>VENTAS EN EFECTIVO</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#4ade80' }}>+{fmt(efectivoVentasEfectivo)}</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,196,0,0.08)', border: '1px solid rgba(245,196,0,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Efectivo esperado en caja</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: COLOR }}>{fmt(efectivoEsperado)}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 8, fontWeight: 600 }}>💵 ¿Cuánto efectivo contás físicamente?</label>
                    <input
                      type="number"
                      value={efectivoContado}
                      onChange={e => setEfectivoContado(Number(e.target.value))}
                      min={0}
                      style={{ width: '100%', padding: '12px', borderRadius: 8, border: `1px solid ${diferencia !== 0 ? (diferencia > 0 ? 'rgba(96,165,250,0.5)' : 'rgba(239,68,68,0.5)') : 'rgba(74,222,128,0.4)'}`, background: 'var(--surface2)', color: 'var(--text-primary)', fontSize: 22, fontWeight: 800, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                    />
                  </div>
                  {/* Diferencia en tiempo real */}
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: diferencia === 0 ? 'rgba(74,222,128,0.08)' : diferencia > 0 ? 'rgba(96,165,250,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${diferencia === 0 ? 'rgba(74,222,128,0.25)' : diferencia > 0 ? 'rgba(96,165,250,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {diferencia === 0 ? '✓ Cuadra perfecto' : diferencia > 0 ? '↑ Sobrante' : '↓ Faltante'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: diferencia === 0 ? '#4ade80' : diferencia > 0 ? '#60a5fa' : '#ef4444' }}>
                      {diferencia > 0 ? '+' : ''}{fmt(diferencia)}
                    </span>
                  </div>
                </>
              )}

              {/* ── PASO 2: fondo para mañana ── */}
              {pasosCierre === 2 && (
                <>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Efectivo contado</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: '#4ade80' }}>{fmt(efectivoContado)}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 8, fontWeight: 600 }}>🏦 ¿Cuánto efectivo dejás en caja para mañana?</label>
                    <input
                      type="number"
                      value={efectivoEnCaja}
                      onChange={e => setEfectivoEnCaja(Math.min(Number(e.target.value), efectivoContado))}
                      min={0}
                      max={efectivoContado}
                      style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.4)', background: 'var(--surface2)', color: 'var(--text-primary)', fontSize: 22, fontWeight: 800, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                    />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Este será el fondo inicial de mañana al abrir la caja.</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted }}>A retirar de caja</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Efectivo contado − Fondo que dejás</div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 22, color: '#f97316' }}>
                      {fmt(Math.max(0, efectivoContado - efectivoEnCaja))}
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 3: confirmación final ── */}
              {pasosCierre === 3 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Total ventas del día',   value: fmt(totalDia),                           color: COLOR },
                      { label: 'Efectivo inicial',       value: fmt(fondoInicial),                       color: 'var(--text-primary)' },
                      { label: 'Ventas en efectivo',     value: `+${fmt(efectivoVentasEfectivo)}`,       color: '#4ade80' },
                      { label: 'Efectivo esperado',      value: fmt(efectivoEsperado),                   color: COLOR },
                      { label: 'Efectivo contado',       value: fmt(efectivoContado),                    color: 'var(--text-primary)' },
                      { label: 'Diferencia',             value: `${diferencia >= 0 ? '+' : ''}${fmt(diferencia)}`, color: diferencia === 0 ? '#4ade80' : diferencia > 0 ? '#60a5fa' : '#ef4444' },
                      { label: 'Fondo para mañana',      value: fmt(efectivoEnCaja),                     color: '#4ade80' },
                      { label: 'A retirar',              value: fmt(Math.max(0, efectivoContado - efectivoEnCaja)), color: '#f97316' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 7, background: 'var(--surface2)' }}>
                        <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <Field label="Observaciones (opcional)">
                    <textarea
                      value={obsModal}
                      onChange={e => setObsModal(e.target.value)}
                      rows={2}
                      placeholder="Ej: Faltante de $200 en efectivo..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </Field>
                </>
              )}
            </div>

            {/* Footer con navegación entre pasos */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              {pasosCierre > 1 && (
                <button onClick={() => setPasosCierre(p => (p - 1) as 1 | 2 | 3)} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: C.muted, fontSize: 13, fontWeight: 600 }}>
                  ← Anterior
                </button>
              )}
              {pasosCierre < 3 ? (
                <button
                  onClick={() => setPasosCierre(p => (p + 1) as 1 | 2 | 3)}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, cursor: 'pointer', background: COLOR, border: 'none', color: '#000', fontSize: 13, fontWeight: 700 }}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={cerrarCaja}
                  disabled={saving}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'var(--border)' : COLOR, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  {saving
                    ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Cerrando...</>
                    : '🔒 Confirmar Cierre'
                  }
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeDesglose(ventas: VentaCaja[]): Record<string, { total: number; count: number }> {
  const d: Record<string, { total: number; count: number }> = {}
  for (const m of METODOS) d[m] = { total: 0, count: 0 }
  for (const v of ventas) {
    if (v.pagos && v.pagos.length > 1) {
      // Split payment: distribute each portion to its method
      for (const p of v.pagos) {
        if (!d[p.metodo]) d[p.metodo] = { total: 0, count: 0 }
        d[p.metodo].total += p.monto
        d[p.metodo].count += 1
      }
    } else {
      const m = v.metodoPago
      if (!d[m]) d[m] = { total: 0, count: 0 }
      d[m].total += v.total
      d[m].count++
    }
  }
  return d
}

// ─── Día Tab ──────────────────────────────────────────────────────────────────
function DiaTab({ fecha, esHoy, isAdmin, sesionFecha, sesionHoy, fondoInicial, ventasDia, desgloseTotal, totalDia, maxTotal, ventasConMetodo, cierresDia, onDeleteCierre, cajaSinAbrir, onAbrirCaja, onReabrirCaja, saving }: {
  fecha: string; esHoy: boolean; isAdmin: boolean
  sesionFecha: SesionCaja | null; sesionHoy: SesionCaja | null
  fondoInicial: number
  ventasDia: VentaCaja[]
  desgloseTotal: Record<string, { total: number; count: number }>
  totalDia: number; maxTotal: number
  ventasConMetodo: string[]
  cierresDia: CierreCaja[]
  onDeleteCierre: (id: string) => void
  cajaSinAbrir: boolean
  onAbrirCaja: () => void
  onReabrirCaja: () => void
  saving: boolean
}) {
  const esDiaCerrado = sesionFecha?.estado === 'cerrada'
  const porcentajeMetodo = (m: string) => maxTotal > 0 ? (desgloseTotal[m]?.total / maxTotal) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Banner estado caja — siempre visible */}
      {(() => {
        // Para hoy usamos sesionHoy (cargada puntualmente); para otros días, sesionFecha
        const sesion = esHoy ? sesionHoy : sesionFecha
        const sinAbrir = !sesion
        const abierta = sesion?.estado === 'abierta'
        const cerrada = sesion?.estado === 'cerrada'
        const bg = sinAbrir ? 'rgba(245,196,0,0.08)' : abierta ? 'rgba(74,222,128,0.08)' : 'rgba(107,114,128,0.08)'
        const border = sinAbrir ? 'rgba(245,196,0,0.3)' : abierta ? 'rgba(74,222,128,0.3)' : 'rgba(107,114,128,0.3)'
        return (
          <div style={{ padding: '14px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, background: bg, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 28 }}>{sinAbrir ? '🔓' : abierta ? '✅' : '🔒'}</div>
            <div style={{ flex: 1 }}>
              {sinAbrir && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLOR }}>
                    {esHoy ? 'Caja sin abrir' : `Sin sesión registrada el ${fmtDate(fecha)}`}
                  </div>
                  {esHoy && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      Fondo disponible: <strong style={{ color: '#4ade80' }}>{fmt(fondoInicial)}</strong>
                      {fondoInicial === 0 ? ' (primera apertura del día)' : ' (del cierre anterior)'}
                    </div>
                  )}
                </>
              )}
              {abierta && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#4ade80' }}>Caja abierta</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Abierta por <strong>{sesion!.operadorApertura}</strong> a las {fmtTime(sesion!.horaApertura)}
                    {' · '}Fondo inicial: <strong>{fmt(sesion!.efectivoInicial)}</strong>
                  </div>
                </>
              )}
              {cerrada && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>
                    🔒 Caja cerrada{esHoy && isAdmin ? ' — modo admin activo' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Cerrada por <strong>{sesion!.operadorCierre}</strong> a las {fmtTime(sesion!.horaCierre!)}
                    {sesion!.efectivoEnCaja !== undefined && <> · Fondo para mañana: <strong style={{ color: '#4ade80' }}>{fmt(sesion!.efectivoEnCaja)}</strong></>}
                    {esHoy && !isAdmin && ' · Sin permiso para agregar o eliminar ventas'}
                  </div>
                </>
              )}
            </div>
            {sinAbrir && esHoy && (
              <button onClick={onAbrirCaja} style={{ padding: '8px 18px', borderRadius: 8, background: COLOR, color: '#000', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                🔓 Abrir ahora
              </button>
            )}
            {cerrada && esHoy && isAdmin && (
              <button onClick={onReabrirCaja} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer', flexShrink: 0 }}>
                🔑 Reabrir caja
              </button>
            )}
          </div>
        )
      })()}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KPI label="Total del día" value={fmt(totalDia)} icon="💰" color={COLOR} sub={`${ventasDia.length} ventas`} />
        <KPI label="Efectivo en caja" value={fmt((sesionFecha?.efectivoInicial ?? fondoInicial) + (desgloseTotal['Efectivo']?.total ?? 0))} icon="💵" color="#4ade80" sub="fondo + ventas efectivo" />
        <KPI label="Estado" value={esDiaCerrado ? 'Cerrada' : sesionFecha?.estado === 'abierta' ? 'Abierta' : 'Sin abrir'} icon={esDiaCerrado ? '🔒' : '🔓'} color={esDiaCerrado ? '#6b7280' : '#4ade80'} />
        <KPI label="Promedio venta" value={ventasDia.length > 0 ? fmt(totalDia / ventasDia.length) : '—'} icon="📊" color="#60a5fa" />
      </div>

      {ventasDia.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏧</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin ventas el {fmtDate(fecha)}</div>
          <div style={{ fontSize: 13 }}>Las ventas registradas desde la Caja aparecerán aquí.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Desglose por método de pago</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ventasConMetodo.length === 0
                ? <div style={{ color: C.muted, fontSize: 13 }}>Sin datos</div>
                : ventasConMetodo.map(m => (
                  <MetodoRow key={m} metodo={m} total={desgloseTotal[m].total} count={desgloseTotal[m].count} pct={porcentajeMetodo(m)} />
                ))
              }
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Resumen de caja</div>
            {sesionFecha ? (
              <SesionRow s={sesionFecha} />
            ) : cierresDia.length > 0 ? (
              cierresDia.map(c => <CierreRow key={c.id} c={c} onDelete={() => onDeleteCierre(c.id)} />)
            ) : (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: C.muted, fontSize: 13, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                Sin sesión registrada para esta fecha.
              </div>
            )}
          </div>
        </div>
      )}

      {ventasDia.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Detalle de ventas del día</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 130px 110px 100px', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
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
function HistorialTab({ sesiones, cierres, onDelete }: { sesiones: SesionCaja[]; cierres: CierreCaja[]; onDelete: (id: string) => void }) {
  const sorted = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const legacyCierres = cierres.filter(c => !sesiones.some(s => s.fecha === c.fecha))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const allDates = new Set([...sorted.map(s => s.fecha.slice(0, 7)), ...legacyCierres.map(c => c.fecha.slice(0, 7))])
  const months = [...allDates].sort((a, b) => b.localeCompare(a))

  if (sorted.length === 0 && legacyCierres.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin historial de cierres</div>
        <div style={{ fontSize: 13 }}>Los cierres de caja aparecerán aquí una vez que los registres.</div>
      </div>
    )
  }

  const totalHistorico = sorted.reduce((s, x) => s + (x.totalGeneral ?? 0), 0)
    + legacyCierres.reduce((s, c) => s + c.totalGeneral, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <KPI label="Total histórico" value={fmt(totalHistorico)} icon="💰" color={COLOR} />
        <KPI label="Días registrados" value={String(sorted.length + legacyCierres.length)} icon="🔒" color="#60a5fa" />
        <KPI label="Promedio por día" value={(sorted.length + legacyCierres.length) > 0 ? fmt(totalHistorico / (sorted.length + legacyCierres.length)) : '—'} icon="📊" color="#4ade80" />
      </div>
      {months.map(month => {
        const [y, m] = month.split('-')
        const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })
        const mSesiones = sorted.filter(s => s.fecha.startsWith(month))
        const mCierres = legacyCierres.filter(c => c.fecha.startsWith(month))
        const monthTotal = mSesiones.reduce((s, x) => s + (x.totalGeneral ?? 0), 0) + mCierres.reduce((s, c) => s + c.totalGeneral, 0)
        return (
          <div key={month}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📅 {monthName}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{fmt(monthTotal)}</div>
            </div>
            {mSesiones.map(s => <SesionRow key={s.id} s={s} />)}
            {mCierres.map(c => <CierreRow key={c.id} c={c} onDelete={() => onDelete(c.id)} />)}
          </div>
        )
      })}
    </div>
  )
}
