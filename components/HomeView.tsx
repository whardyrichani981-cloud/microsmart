'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Note } from '@/lib/notes'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/notes'
import type { Orden } from '@/lib/sistema-types'

const QUOTES: { text: string; author: string }[] = [
  { text: 'El éxito no es la clave de la felicidad. La felicidad es la clave del éxito.', author: 'Albert Schweitzer' },
  { text: 'La única manera de hacer un gran trabajo es amar lo que hacés.', author: 'Steve Jobs' },
  { text: 'No contés los días, hacé que los días cuenten.', author: 'Muhammad Ali' },
  { text: 'El único lugar donde el éxito viene antes que el trabajo es en el diccionario.', author: 'Vidal Sassoon' },
  { text: 'Cada día es una nueva oportunidad para cambiar tu vida.', author: 'Anónimo' },
  { text: 'La disciplina es el puente entre metas y logros.', author: 'Jim Rohn' },
  { text: 'No te rindas. El principio es siempre lo más difícil.', author: 'Anónimo' },
  { text: 'El trabajo en equipo divide el esfuerzo y multiplica el éxito.', author: 'Anónimo' },
  { text: 'No importa lo lento que vayas, siempre y cuando no te detengas.', author: 'Confucio' },
  { text: 'Tus limitaciones solo existen en tu mente.', author: 'Anónimo' },
  { text: 'Sé el cambio que querés ver en el mundo.', author: 'Mahatma Gandhi' },
  { text: 'El fracaso es simplemente la oportunidad de comenzar de nuevo, esta vez con más inteligencia.', author: 'Henry Ford' },
  { text: 'Cree que puedes y ya estás a mitad de camino.', author: 'Theodore Roosevelt' },
  { text: 'La calidad nunca es un accidente; siempre es el resultado del esfuerzo inteligente.', author: 'John Ruskin' },
  { text: 'Haz hoy lo que otros no quieren hacer, para tener mañana lo que otros no pueden tener.', author: 'Anónimo' },
  { text: 'El secreto para avanzar es comenzar.', author: 'Mark Twain' },
  { text: 'Un cliente satisfecho es la mejor estrategia de negocio.', author: 'Michael LeBoeuf' },
  { text: 'La excelencia no es un acto, es un hábito.', author: 'Aristóteles' },
  { text: 'Los que son lo suficientemente locos para pensar que pueden cambiar el mundo son los que lo hacen.', author: 'Steve Jobs' },
  { text: 'No esperes el momento perfecto, toma el momento y hazlo perfecto.', author: 'Anónimo' },
  { text: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', author: 'Robert Collier' },
  { text: 'Trabaja en silencio, deja que tu éxito haga el ruido.', author: 'Anónimo' },
  { text: 'Si tus sueños no te asustan, es que no son lo suficientemente grandes.', author: 'Anónimo' },
  { text: 'El optimismo es la fe que conduce al logro.', author: 'Helen Keller' },
  { text: 'Cada logro comienza con la decisión de intentarlo.', author: 'Gail Devers' },
  { text: 'La motivación te pone en marcha; el hábito te mantiene en marcha.', author: 'Jim Ryun' },
  { text: 'Invierte en ti mismo. Tu carrera es el motor de tu riqueza.', author: 'Paul Clitheroe' },
  { text: 'No hay ascensor hacia el éxito. Hay que usar las escaleras.', author: 'Anónimo' },
  { text: 'Cuando el trabajo es un placer, la vida es una alegría.', author: 'Máximo Gorki' },
  { text: 'La perseverancia es la madre del éxito.', author: 'Anónimo' },
]

function getDayQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const diff = Number(new Date()) - Number(start)
  const dayOfYear = Math.floor(diff / 86_400_000)
  return QUOTES[dayOfYear % QUOTES.length]
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtReminder(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return isToday ? `Hoy ${time}` : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

function fmtARS(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

function diasSinMovimiento(o: Orden): number {
  const hist = o.historial ?? []
  const lastEntry = hist.length > 0 ? hist[hist.length - 1].fecha : o.fecha
  return Math.floor((Date.now() - new Date(lastEntry).getTime()) / 86_400_000)
}

// ─── Seguimiento buscador ─────────────────────────────────────────────────────
function SeguimientoBuscador() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const buscar = () => { const q = codigo.trim().toUpperCase(); if (!q) return; router.push(`/seguimiento/${q}`) }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 18, padding: '22px 28px', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Seguimiento de orden</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Consultá el estado de tu reparación</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ej: AB3X7Y2K" maxLength={8} autoComplete="off"
          style={{ flex: 1, padding: '11px 18px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text-primary)', fontSize: 17, fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', outline: 'none', textAlign: 'center', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
        />
        <button onClick={buscar} disabled={!codigo.trim()} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: !codigo.trim() ? 'var(--surface3)' : 'var(--accent)', color: !codigo.trim() ? 'var(--text-dim)' : '#fff', fontWeight: 600, fontSize: 14, cursor: !codigo.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
          Ver orden
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>Ingresá el código de 8 caracteres para ver el estado de la orden</div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ icon, label, value, color, sub }: { icon: string; label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ flex: '1 1 140px', background: 'var(--surface)', border: `1px solid ${color}28`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'var(--shadow-md)', borderTop: `3px solid ${color}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

// ─── Weekly Bar Chart (CSS only) ──────────────────────────────────────────────
function WeeklyChart({ ordenes }: { ordenes: Orden[] }) {
  const days: { label: string; date: string; count: number; monto: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toDateString()
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : d.toLocaleDateString('es-AR', { weekday: 'short' })
    const dayOrdenes = ordenes.filter(o => new Date(o.fecha).toDateString() === dateStr)
    days.push({ label, date: dateStr, count: dayOrdenes.length, monto: dayOrdenes.reduce((s, o) => s + (o.montoCobrado ?? 0), 0) })
  }
  const maxCount = Math.max(...days.map(d => d.count), 1)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 18, padding: '20px 24px', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,102,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📊</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Órdenes últimos 7 días</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
        {days.map(d => {
          const pct = d.count / maxCount
          const isToday = d.label === 'Hoy'
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-dim)' }}>
                {d.count > 0 ? d.count : ''}
              </div>
              <div style={{
                width: '100%', borderRadius: 6, transition: 'height 0.3s ease',
                height: `${Math.max(pct * 52, d.count > 0 ? 6 : 2)}px`,
                background: isToday
                  ? 'linear-gradient(180deg, #0A84FF, #0066CC)'
                  : d.count > 0 ? 'var(--accent-dim)' : 'var(--surface2)',
                border: isToday ? '1px solid rgba(0,102,204,0.4)' : '1px solid var(--border)',
              }} title={`${d.label}: ${d.count} orden${d.count !== 1 ? 'es' : ''}`} />
              <div style={{ fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-dim)', fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props { displayName: string; currentUser: string }

export default function HomeView({ displayName, currentUser }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [loadingOrdenes, setLoadingOrdenes] = useState(true)
  const quote = getDayQuote()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const dayStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    fetch('/api/notes').then(r => r.json()).then((data: Note[]) => { setNotes(data); setLoadingNotes(false) }).catch(() => setLoadingNotes(false))
    fetch('/api/sistema/ordenes').then(r => r.json()).then((data: { items?: Orden[] } | Orden[]) => {
      const list: Orden[] = Array.isArray(data) ? data : (data.items ?? [])
      setOrdenes(list); setLoadingOrdenes(false)
    }).catch(() => setLoadingOrdenes(false))
  }, [])

  // Notes stats
  const myNotes      = notes.filter(n => !n.resolved && !n.deleted && n.author.toLowerCase() === displayName.toLowerCase())
  const myHigh       = myNotes.filter(n => n.priority === 'alta')
  const myReminders  = myNotes.filter(n => n.reminderAt).sort((a, b) => new Date(a.reminderAt!).getTime() - new Date(b.reminderAt!).getTime())
  const totalPending = notes.filter(n => !n.resolved && !n.deleted).length

  // Orden KPIs
  const ingresadasHoy  = ordenes.filter(o => isToday(o.fecha))
  const enProceso      = ordenes.filter(o => o.estado !== 'Entregado')
  const listasRetirar  = ordenes.filter(o => o.estado === 'Salida')
  const entregadasHoy  = ordenes.filter(o => o.fechaEntregadoAt && isToday(o.fechaEntregadoAt))
  const facturadoHoy   = entregadasHoy.reduce((s, o) => s + (o.montoCobrado ?? 0), 0)
  const urgentes       = enProceso.filter(o => o.prioridad === 'Urgente').sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const sinMovimiento  = enProceso.filter(o => diasSinMovimiento(o) >= 5).sort((a, b) => diasSinMovimiento(b) - diasSinMovimiento(a))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', background: 'var(--hero-bg)', border: '1px solid var(--border-light)', padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--hero-grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--hero-grid-color) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{dayStr}</div>
          <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            {greeting()}, {displayName || currentUser} 👋
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, fontWeight: 400 }}>
            {loadingOrdenes ? 'Cargando datos del día…' :
              ingresadasHoy.length === 0 && entregadasHoy.length === 0
                ? 'Sin movimiento hoy todavía'
                : `${ingresadasHoy.length} ingresada${ingresadasHoy.length !== 1 ? 's' : ''} hoy · ${entregadasHoy.length} entregada${entregadasHoy.length !== 1 ? 's' : ''} hoy`}
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg, #0066CC 0%, #0A84FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, lineHeight: 1, flexShrink: 0, boxShadow: '0 8px 32px rgba(0,102,204,0.30)' }}>🍎</div>
      </div>

      {/* ── KPIs del negocio ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KPI icon="📥" label="Ingresadas hoy"    value={loadingOrdenes ? '—' : String(ingresadasHoy.length)}   color="#0A84FF" />
        <KPI icon="✅" label="Entregadas hoy"    value={loadingOrdenes ? '—' : String(entregadasHoy.length)}   color="#22C55E" sub={facturadoHoy > 0 ? fmtARS(facturadoHoy) : undefined} />
        <KPI icon="🔧" label="En proceso"        value={loadingOrdenes ? '—' : String(enProceso.length)}       color="#a78bfa" />
        <KPI icon="🟢" label="Listas p/ retirar" value={loadingOrdenes ? '—' : String(listasRetirar.length)}   color="#4ade80" />
        <KPI icon="📋" label="Mis tareas"        value={loadingNotes   ? '—' : String(myNotes.length)}         color="#0066CC" />
        <KPI icon="🔴" label="Alta prioridad"    value={loadingNotes   ? '—' : String(myHigh.length)}          color="#FF3B30" />
      </div>

      {/* ── Gráfico semanal + accesos rápidos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        <WeeklyChart ordenes={ordenes} />

        {/* Accesos rápidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Accesos rápidos</div>
          {[
            { label: 'Nueva orden',    icon: '🔧', nav: 'ordenes'    },
            { label: 'Nueva venta',    icon: '💵', nav: 'caja'       },
            { label: 'Ver stock',      icon: '📦', nav: 'stock'      },
            { label: 'Ver clientes',   icon: '👥', nav: 'clientes'   },
          ].map(a => (
            <button key={a.nav}
              onClick={() => (window as any).__msNav?.(a.nav)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface)' }}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Urgentes + Sin movimiento ── */}
      {!loadingOrdenes && (urgentes.length > 0 || sinMovimiento.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Urgentes */}
          {urgentes.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-md)', borderTop: '3px solid #ef4444' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>🚨</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>Órdenes urgentes</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '2px 8px', borderRadius: 20 }}>{urgentes.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {urgentes.slice(0, 6).map(o => (
                  <div key={o.id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--row-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', flexShrink: 0 }}>#{o.nOrden}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombreCliente}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{o.modeloEquipo} · {o.estado}</div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                      {new Date(o.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin movimiento */}
          {sinMovimiento.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-md)', borderTop: '3px solid #fb923c' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>⏸️</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fb923c' }}>Sin movimiento +5 días</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, background: 'rgba(251,146,60,0.12)', color: '#fb923c', padding: '2px 8px', borderRadius: 20 }}>{sinMovimiento.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {sinMovimiento.slice(0, 6).map(o => {
                  const dias = diasSinMovimiento(o)
                  return (
                    <div key={o.id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--row-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#fb923c', flexShrink: 0 }}>#{o.nOrden}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombreCliente}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{o.modeloEquipo} · {o.estado}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: dias >= 10 ? '#ef4444' : '#fb923c', flexShrink: 0 }}>{dias}d</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Seguimiento ── */}
      <SeguimientoBuscador />

      {/* ── Grid: tareas + derecha ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Mis tareas */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,102,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📋</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Mis tareas</span>
            {myNotes.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>{myNotes.length}</span>
            )}
          </div>
          {loadingNotes ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</div>
          ) : myNotes.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 15, color: '#22C55E', fontWeight: 600, marginBottom: 4 }}>¡Sin tareas pendientes!</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Estás al día.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {myNotes.map(note => {
                const cat = CATEGORY_COLORS[note.category]
                const isHigh = note.priority === 'alta'
                return (
                  <div key={note.id} style={{ padding: '14px 22px', borderBottom: '1px solid var(--row-border)', borderLeft: `3px solid ${isHigh ? '#FF3B30' : cat.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}>{CATEGORY_LABELS[note.category]}</span>
                      {note.product && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>📱 {note.product}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 13 }}>{isHigh ? '🔴' : note.priority === 'media' ? '🟡' : '🟢'}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{note.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Creada: {fmtShort(note.createdAt)}</span>
                      {note.reminderAt && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>⏰ {fmtReminder(note.reminderAt)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Frase del día */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 18, padding: '24px 26px', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #0066CC, #0A84FF, #007AFF)', borderRadius: '18px 18px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 4 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Frase del día</span>
            </div>
            <blockquote style={{ margin: 0 }}>
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.65, fontStyle: 'italic', margin: '0 0 14px', fontWeight: 400 }}>"{quote.text}"</p>
              <footer style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>— {quote.author}</footer>
            </blockquote>
          </div>

          {/* Próximos recordatorios */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 18, overflow: 'hidden', flex: 1, boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⏰</div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Próximos recordatorios</span>
              {myReminders.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.28)' }}>{myReminders.length}</span>
              )}
            </div>
            {myReminders.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>📅</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sin recordatorios programados</div>
              </div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {myReminders.map(note => (
                  <div key={note.id} style={{ padding: '12px 22px', borderBottom: '1px solid var(--row-border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 7, height: 7, borderRadius: '50%', background: '#F59E0B', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.content}</p>
                      <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{fmtReminder(note.reminderAt!)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
