'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Note } from '@/lib/notes'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/notes'

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
  { text: 'El verdadero trabajo duro nunca te mata; es la incertidumbre la que mata.', author: 'Anónimo' },
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
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtReminder(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return isToday
    ? `Hoy ${time}`
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

interface Props { displayName: string; currentUser: string }

// ─── Seguimiento buscador ─────────────────────────────────────────────────────
function SeguimientoBuscador() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')

  const buscar = () => {
    const q = codigo.trim().toUpperCase()
    if (!q) return
    router.push(`/seguimiento/${q}`)
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 18, padding: '22px 28px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Seguimiento de orden
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
          Consultá el estado de tu reparación
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={codigo}
          onChange={e => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ej: AB3X7Y2K"
          maxLength={8}
          autoComplete="off"
          style={{
            flex: 1, padding: '11px 18px',
            border: '1.5px solid var(--border)', borderRadius: 12,
            background: 'var(--surface2)', color: 'var(--text-primary)',
            fontSize: 17, fontFamily: 'ui-monospace, monospace', fontWeight: 700,
            letterSpacing: '0.20em', textTransform: 'uppercase',
            outline: 'none', textAlign: 'center',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          onClick={buscar}
          disabled={!codigo.trim()}
          style={{
            padding: '11px 28px', borderRadius: 12, border: 'none',
            background: !codigo.trim() ? 'var(--surface3)' : 'var(--accent)',
            color: !codigo.trim() ? 'var(--text-dim)' : '#fff',
            fontWeight: 600, fontSize: 14,
            cursor: !codigo.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s', whiteSpace: 'nowrap',
            boxShadow: codigo.trim() ? '0 2px 10px rgba(0,102,204,0.30)' : 'none',
          }}
        >
          Ver orden
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
        Ingresá el código de 8 caracteres para ver el estado de la orden
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, accentBg }: {
  icon: string; label: string; value: number; color: string; accentBg: string
}) {
  return (
    <div style={{
      flex: '1 1 140px', background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 18, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: 'var(--shadow-md)',
      transition: 'transform 0.18s, box-shadow 0.18s',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'var(--shadow-md)'
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: accentBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeView({ displayName, currentUser }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const quote = getDayQuote()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const dayStr = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  useEffect(() => {
    fetch('/api/notes')
      .then(r => r.json())
      .then((data: Note[]) => { setNotes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const myNotes      = notes.filter(n => !n.resolved && !n.deleted && n.author.toLowerCase() === displayName.toLowerCase())
  const myHigh       = myNotes.filter(n => n.priority === 'alta')
  const myReminders  = myNotes.filter(n => n.reminderAt).sort((a, b) => new Date(a.reminderAt!).getTime() - new Date(b.reminderAt!).getTime())
  const totalPending = notes.filter(n => !n.resolved && !n.deleted).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero banner ── */}
      <div style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, #f0f6ff 0%, #e8f0fb 40%, #f5f5f7 100%)',
        border: '1px solid var(--border-light)',
        padding: '36px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Subtle tech grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35,
          backgroundImage: 'linear-gradient(var(--border-light) 1px, transparent 1px), linear-gradient(90deg, var(--border-light) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}>
            {dayStr}
          </div>
          <h1 style={{
            fontSize: 34, fontWeight: 700, color: 'var(--text-primary)',
            margin: '0 0 8px', letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            {greeting()}, {displayName || currentUser} 👋
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, fontWeight: 400 }}>
            {myNotes.length === 0
              ? 'Todo al día · Sin tareas pendientes'
              : `Tenés ${myNotes.length} tarea${myNotes.length > 1 ? 's' : ''} pendiente${myNotes.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Brand mark */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: 80, height: 80, borderRadius: 22,
          background: 'linear-gradient(135deg, #0066CC 0%, #0A84FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, lineHeight: 1, flexShrink: 0,
          boxShadow: '0 8px 32px rgba(0,102,204,0.30)',
        }}>🍎</div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <StatCard icon="📋" label="Mis tareas pendientes" value={myNotes.length}      color="#0066CC" accentBg="rgba(0,102,204,0.08)" />
        <StatCard icon="🔴" label="Alta prioridad (mías)"  value={myHigh.length}      color="#FF3B30" accentBg="rgba(255,59,48,0.08)"  />
        <StatCard icon="⏰" label="Mis recordatorios"      value={myReminders.length} color="#F59E0B" accentBg="rgba(245,158,11,0.10)" />
        <StatCard icon="📌" label="Total equipo pendiente" value={totalPending}        color="#22C55E" accentBg="rgba(34,197,94,0.09)"  />
      </div>

      {/* ── Seguimiento ── */}
      <SeguimientoBuscador />

      {/* ── Grid: tareas + derecha ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Mis tareas */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{
            padding: '16px 22px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,102,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📋</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Mis tareas</span>
            {myNotes.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                padding: '2px 9px', borderRadius: 99,
                background: 'var(--accent-dim)', color: 'var(--accent)',
                border: '1px solid var(--accent-glow)',
              }}>{myNotes.length}</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</div>
          ) : myNotes.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 15, color: '#22C55E', fontWeight: 600, marginBottom: 4 }}>¡Sin tareas pendientes!</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Estás al día.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {myNotes.map(note => {
                const cat = CATEGORY_COLORS[note.category]
                const isHigh = note.priority === 'alta'
                return (
                  <div key={note.id} style={{
                    padding: '14px 22px', borderBottom: '1px solid var(--row-border)',
                    borderLeft: `3px solid ${isHigh ? '#FF3B30' : cat.border}`,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}>
                        {CATEGORY_LABELS[note.category]}
                      </span>
                      {note.product && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>📱 {note.product}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 13 }}>
                        {isHigh ? '🔴' : note.priority === 'media' ? '🟡' : '🟢'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{note.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Creada: {fmtShort(note.createdAt)}</span>
                      {note.reminderAt && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                          ⏰ {fmtReminder(note.reminderAt)}
                        </span>
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
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            borderRadius: 18, padding: '24px 26px',
            boxShadow: 'var(--shadow-md)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Accent line top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #0066CC, #0A84FF, #007AFF)', borderRadius: '18px 18px 0 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 4 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Frase del día</span>
            </div>
            <blockquote style={{ margin: 0 }}>
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.65, fontStyle: 'italic', margin: '0 0 14px', fontWeight: 400 }}>
                "{quote.text}"
              </p>
              <footer style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>— {quote.author}</footer>
            </blockquote>
          </div>

          {/* Próximos recordatorios */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            borderRadius: 18, overflow: 'hidden', flex: 1,
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⏰</div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Próximos recordatorios</span>
              {myReminders.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                  padding: '2px 9px', borderRadius: 99,
                  background: 'rgba(245,158,11,0.10)', color: '#F59E0B',
                  border: '1px solid rgba(245,158,11,0.28)',
                }}>{myReminders.length}</span>
              )}
            </div>

            {myReminders.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>📅</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sin recordatorios programados</div>
              </div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {myReminders.map(note => (
                  <div key={note.id} style={{
                    padding: '12px 22px', borderBottom: '1px solid var(--row-border)',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
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
