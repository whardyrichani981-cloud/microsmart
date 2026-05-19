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

// ─── Buscador de seguimiento ──────────────────────────────────────────────────
function SeguimientoBuscador() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const buscar = () => {
    const q = codigo.trim().toUpperCase()
    if (!q) return
    router.push(`/seguimiento/${q}`)
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3' }}>Consultar orden por código de seguimiento</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={codigo}
          onChange={e => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ej: AB3X7Y2K"
          maxLength={8}
          autoComplete="off"
          style={{
            flex: 1, padding: '12px 18px',
            border: '1.5px solid var(--border)', borderRadius: 10,
            background: 'var(--surface2)', color: '#E5E5E3',
            fontSize: 18, fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            outline: 'none', textAlign: 'center',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#60a5fa')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={buscar}
          disabled={!codigo.trim()}
          style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: !codigo.trim() ? 'var(--surface2)' : '#60a5fa',
            color: !codigo.trim() ? '#555' : '#fff',
            fontWeight: 700, fontSize: 15, cursor: !codigo.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          Ver orden
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
        Ingresá el código de 8 caracteres y te mostramos el estado de la orden
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
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

  const myNotes = notes.filter(n =>
    !n.resolved && !n.deleted &&
    n.author.toLowerCase() === displayName.toLowerCase()
  )
  const myHigh      = myNotes.filter(n => n.priority === 'alta')
  const myReminders = myNotes.filter(n => n.reminderAt)
    .sort((a, b) => new Date(a.reminderAt!).getTime() - new Date(b.reminderAt!).getTime())
  const totalPending = notes.filter(n => !n.resolved && !n.deleted).length

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
    <div style={{
      flex: '1 1 130px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#676767' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Welcome banner */}
      <div style={{
        borderRadius: 16, overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(245,196,0,0.10) 0%, rgba(245,196,0,0.04) 100%)',
        border: '1px solid rgba(245,196,0,0.20)',
        padding: '28px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#F5C400', fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{dayStr}</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#E5E5E3', margin: '0 0 6px' }}>
            {greeting()}, {displayName || currentUser} 👋
          </h2>
          <p style={{ fontSize: 14, color: '#8A8A8A', margin: 0 }}>
            {myNotes.length === 0
              ? 'No tenés tareas pendientes. ¡Buen trabajo!'
              : `Tenés ${myNotes.length} tarea${myNotes.length > 1 ? 's' : ''} pendiente${myNotes.length > 1 ? 's' : ''}.`}
          </p>
        </div>
        <div style={{ fontSize: 64, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(245,196,0,0.30))' }}>🍎</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon="📋" label="Mis tareas pendientes" value={myNotes.length}      color="#F5C400" />
        <StatCard icon="🔴" label="Alta prioridad (mías)"  value={myHigh.length}      color="#f87171" />
        <StatCard icon="⏰" label="Mis recordatorios"      value={myReminders.length} color="#fbbf24" />
        <StatCard icon="📌" label="Total equipo pendiente" value={totalPending}        color="#4ade80" />
      </div>

      {/* ── Buscador de seguimiento ── */}
      <SeguimientoBuscador />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* My tasks */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3' }}>Mis tareas</span>
            {myNotes.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
                background: 'rgba(245,196,0,0.12)', color: '#F5C400',
                border: '1px solid rgba(245,196,0,0.28)',
              }}>{myNotes.length}</span>
            )}
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#484848', fontSize: 13 }}>Cargando…</div>
          ) : myNotes.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
              <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 600 }}>¡Sin tareas pendientes!</div>
              <div style={{ fontSize: 12, color: '#484848', marginTop: 4 }}>Estás al día.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {myNotes.map(note => {
                const cat = CATEGORY_COLORS[note.category]
                const isHigh = note.priority === 'alta'
                return (
                  <div key={note.id} style={{
                    padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: `3px solid ${isHigh ? '#ef4444' : cat.border}`,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}>
                        {CATEGORY_LABELS[note.category]}
                      </span>
                      {note.product && <span style={{ fontSize: 10, color: '#676767' }}>📱 {note.product}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 13 }}>
                        {isHigh ? '🔴' : note.priority === 'media' ? '🟡' : '🟢'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#E5E5E3', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{note.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#484848' }}>Creada: {fmtShort(note.createdAt)}</span>
                      {note.reminderAt && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, background: 'rgba(250,204,21,0.1)', color: '#fbbf24', border: '1px solid rgba(250,204,21,0.25)' }}>
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

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Daily quote */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,196,0,0.06), rgba(245,196,0,0.05))',
            border: '1px solid rgba(245,196,0,0.22)', borderRadius: 14, padding: '24px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Frase del día</span>
            </div>
            <blockquote style={{ margin: 0 }}>
              <p style={{ fontSize: 16, color: '#E5E5E3', lineHeight: 1.65, fontStyle: 'italic', margin: '0 0 12px' }}>"{quote.text}"</p>
              <footer style={{ fontSize: 12, color: '#F5C400', fontWeight: 600 }}>— {quote.author}</footer>
            </blockquote>
          </div>

          {/* Reminders */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⏰</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3' }}>Próximos recordatorios</span>
              {myReminders.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(250,204,21,0.12)', color: '#fbbf24',
                  border: '1px solid rgba(250,204,21,0.3)',
                }}>{myReminders.length}</span>
              )}
            </div>
            {myReminders.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13, color: '#484848' }}>Sin recordatorios programados</div>
              </div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {myReminders.map(note => (
                  <div key={note.id} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: '#fbbf24', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#E5E5E3', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.content}</p>
                      <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>{fmtReminder(note.reminderAt!)}</span>
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
