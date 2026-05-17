'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Note, NoteCategory, NotePriority } from '@/lib/notes'
import { CATEGORY_LABELS, CATEGORY_COLORS, PRIORITY_COLORS } from '@/lib/notes'

// ─── Note Card ───────────────────────────────────────────────────────────────
function NoteCard({
  note,
  currentUser,
  onToggle,
  onDelete,
}: {
  note: Note
  currentUser: string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const cat = CATEGORY_COLORS[note.category]
  const pri = PRIORITY_COLORS[note.priority]
  const isOwn = note.author.toLowerCase() === currentUser.toLowerCase()

  const dt = new Date(note.createdAt)
  const now = new Date()
  const diffMs = now.getTime() - dt.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const clockTime = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  const isToday = dt.toDateString() === now.toDateString()
  const relStr =
    diffMin < 1 ? 'ahora' :
    diffMin < 60 ? `hace ${diffMin} min` :
    diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)} h` :
    `hace ${Math.floor(diffMin / 1440)} d`
  const timeStr = isToday ? `${clockTime} · ${relStr}` : `${dateStr} ${clockTime}`

  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${note.resolved ? 'var(--border)' : cat.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      opacity: note.resolved ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${note.authorColor}22`,
          border: `2px solid ${note.authorColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: note.authorColor,
          flexShrink: 0,
        }}>
          {note.author.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>
              {note.author}
            </span>
            <span className="text-xs" style={{ color: '#7c85a2' }}>{timeStr}</span>
          </div>
        </div>

        {/* Priority dot */}
        <span className="text-xs" style={{ color: pri.text, flexShrink: 0 }}
          title={`Prioridad: ${note.priority}`}>
          {note.priority === 'alta' ? '🔴' : note.priority === 'media' ? '🟡' : '🟢'}
        </span>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
          background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
        }}>
          {CATEGORY_LABELS[note.category]}
        </span>
        {note.product && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
            border: '1px solid var(--border)',
          }}>
            📱 {note.product}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed" style={{
        color: '#e2e8f0',
        textDecoration: note.resolved ? 'line-through' : 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {note.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onToggle(note.id)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all"
          style={{
            background: note.resolved ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${note.resolved ? '#22c55e' : 'var(--border)'}`,
            color: note.resolved ? '#4ade80' : '#7c85a2',
            cursor: 'pointer',
          }}
        >
          {note.resolved ? '✓ Resuelto' : 'Marcar resuelto'}
        </button>

        {isOwn && (
          <button
            onClick={() => onDelete(note.id)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: '#475569',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.borderColor = '#ef4444'
              t.style.color = '#f87171'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.borderColor = 'transparent'
              t.style.color = '#475569'
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

const APPLE_DEVICES = [
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 Mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 Mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone SE 3', 'iPhone SE 2',
  'iPad Pro 13"', 'iPad Pro 11"', 'iPad Air 5', 'iPad Air 4',
  'iPad Mini 6', 'iPad 10', 'iPad 9',
  'Apple Watch Ultra 2', 'Apple Watch Series 9', 'Apple Watch Series 8',
  'AirPods Pro 2', 'AirPods 3', 'AirPods 2',
  'MacBook Pro 16"', 'MacBook Pro 14"', 'MacBook Air M2', 'MacBook Air M1',
]

// ─── New Note Form ────────────────────────────────────────────────────────────
function NoteForm({
  author,
  onAuthorChange,
  onSubmit,
  loading,
}: {
  author: string
  onAuthorChange: (v: string) => void
  onSubmit: (data: { content: string; category: NoteCategory; priority: NotePriority; product: string }) => void
  loading: boolean
}) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<NoteCategory>('repuesto')
  const [priority, setPriority] = useState<NotePriority>('media')
  const [product, setProduct] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!content.trim() || !author.trim()) return
    onSubmit({ content, category, priority, product })
    setContent('')
    setProduct('')
    textRef.current?.focus()
  }

  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    padding: '7px 10px',
  }

  const label = (text: string) => (
    <div className="text-xs mb-1" style={{ color: '#7c85a2' }}>{text}</div>
  )

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div className="text-sm font-semibold mb-3" style={{ color: '#e2e8f0' }}>
        Nueva nota
      </div>

      {/* Author */}
      <div className="mb-3">
        {label('Tu nombre')}
        <input
          value={author}
          onChange={e => onAuthorChange(e.target.value)}
          placeholder="Ej: Rony, Lucas, María..."
          style={inputStyle}
        />
      </div>

      {/* Category + Priority in 2 cols */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          {label('Tipo')}
          <select
            value={category}
            onChange={e => setCategory(e.target.value as NoteCategory)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="repuesto">🔧 Pedido de repuesto</option>
            <option value="reparacion">🛠️ Info de reparación</option>
            <option value="general">📋 General</option>
          </select>
        </div>
        <div>
          {label('Prioridad')}
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as NotePriority)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
        </div>
      </div>

      {/* Product reference */}
      <div className="mb-3">
        {label('Equipo Apple (opcional)')}
        <input
          value={product}
          onChange={e => setProduct(e.target.value)}
          placeholder="Ej: iPhone 15 Pro, iPad Air 5..."
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {APPLE_DEVICES.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setProduct(prev => prev === d ? '' : d)}
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                cursor: 'pointer',
                border: `1px solid ${product === d ? '#6366f1' : 'var(--border)'}`,
                background: product === d ? 'rgba(99,102,241,0.2)' : 'var(--bg)',
                color: product === d ? '#818cf8' : '#7c85a2',
                transition: 'all 0.15s',
                fontWeight: product === d ? 600 : 400,
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        {label('Nota')}
        <textarea
          ref={textRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Describí el pedido o la información..."
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) submit()
          }}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
        />
        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>Ctrl+Enter para guardar</div>
      </div>

      <button
        onClick={submit}
        disabled={loading || !content.trim() || !author.trim()}
        style={{
          width: '100%',
          padding: '9px 0',
          background: loading || !content.trim() || !author.trim() ? 'var(--surface2)' : '#6366f1',
          border: 'none',
          borderRadius: 8,
          color: loading || !content.trim() || !author.trim() ? '#475569' : '#fff',
          fontWeight: 600,
          fontSize: 13,
          cursor: loading || !content.trim() || !author.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'Guardando...' : '+ Agregar nota'}
      </button>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
}

export default function NotesPanel({ open, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | NoteCategory>('pending')
  const [loading, setLoading] = useState(false)

  // Persist author name in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ms-author')
    if (saved) setAuthor(saved)
  }, [])

  const handleAuthorChange = (v: string) => {
    setAuthor(v)
    localStorage.setItem('ms-author', v)
  }

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      setNotes(data)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when panel opens
  useEffect(() => {
    if (open) fetchNotes()
  }, [open, fetchNotes])

  // Poll every 30s when panel is open
  useEffect(() => {
    if (!open) return
    const id = setInterval(fetchNotes, 30_000)
    return () => clearInterval(id)
  }, [open, fetchNotes])

  const handleSubmit = async (data: {
    content: string; category: NoteCategory; priority: NotePriority; product: string
  }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, ...data }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes(prev => [note, ...prev])
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== id))
  }

  const filtered = notes.filter(n => {
    if (filter === 'pending') return !n.resolved
    if (filter === 'all') return true
    return n.category === filter
  })

  const pendingCount = notes.filter(n => !n.resolved).length
  const highPriorityCount = notes.filter(n => !n.resolved && n.priority === 'alta').length

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '95vw',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease',
      }}>
        {/* Panel Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-base" style={{ color: '#e2e8f0' }}>
                📋 Notas del equipo
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#7c85a2' }}>
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                {highPriorityCount > 0 && (
                  <span style={{ color: '#f87171', marginLeft: 6 }}>
                    · {highPriorityCount} alta prioridad
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotes}
                disabled={loading}
                title="Actualizar"
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                  color: '#7c85a2', fontSize: 13,
                }}
              >
                {loading ? '⟳' : '↻'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  color: '#7c85a2', fontSize: 20, cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {([
              ['pending', 'Pendientes'],
              ['all', 'Todas'],
              ['repuesto', '🔧 Repuestos'],
              ['reparacion', '🛠️ Reparaciones'],
              ['general', '📋 General'],
            ] as [typeof filter, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${filter === val ? '#6366f1' : 'var(--border)'}`,
                  background: filter === val ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: filter === val ? '#818cf8' : '#7c85a2',
                  transition: 'all 0.15s',
                }}
              >
                {label}
                {val === 'pending' && pendingCount > 0 && (
                  <span style={{
                    marginLeft: 5,
                    background: '#6366f1',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 5px',
                    fontSize: 10,
                  }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* New note form */}
          <NoteForm
            author={author}
            onAuthorChange={handleAuthorChange}
            onSubmit={handleSubmit}
            loading={submitting}
          />

          {/* Notes list */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>
                {filter === 'pending' ? 'No hay notas pendientes' : 'No hay notas en esta categoría'}
              </div>
            </div>
          ) : (
            filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                currentUser={author}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
