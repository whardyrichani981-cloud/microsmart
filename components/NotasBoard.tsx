'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Note, NoteCategory, NotePriority } from '@/lib/notes'
import { CATEGORY_LABELS, CATEGORY_COLORS, PRIORITY_COLORS } from '@/lib/notes'

const APPLE_DEVICES = [
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone SE 3', 'iPhone SE 2',
  'iPad Pro 13"', 'iPad Pro 11"', 'iPad Air 5', 'iPad Air 4',
  'iPad Mini 6', 'iPad 10', 'iPad 9',
  'Apple Watch Ultra 2', 'Apple Watch Series 9', 'Apple Watch Series 8',
  'AirPods Pro 2', 'AirPods 3', 'AirPods 2',
  'MacBook Pro 16"', 'MacBook Pro 14"', 'MacBook Air M2', 'MacBook Air M1',
]

// ─── Add Note Modal ──────────────────────────────────────────────────────────
function AddNoteModal({
  author,
  onAuthorChange,
  onSubmit,
  onClose,
  loading,
}: {
  author: string
  onAuthorChange: (v: string) => void
  onSubmit: (data: { content: string; category: NoteCategory; priority: NotePriority; product: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<NoteCategory>('repuesto')
  const [priority, setPriority] = useState<NotePriority>('media')
  const [product, setProduct] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  const submit = () => {
    if (!content.trim() || !author.trim()) return
    onSubmit({ content, category, priority, product })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    padding: '8px 12px',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 300,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 540,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        zIndex: 301,
        padding: 28,
        animation: 'fadeScaleIn 0.2s ease',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#e2e8f0' }}>Agregar nota</div>
            <div style={{ fontSize: 12, color: '#7c85a2', marginTop: 2 }}>Completá los campos y guardá</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7c85a2', fontSize: 18, cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* Author */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#7c85a2', display: 'block', marginBottom: 5 }}>Tu nombre</label>
          <input
            value={author}
            onChange={e => onAuthorChange(e.target.value)}
            placeholder="Ej: Rony, Lucas, María..."
            style={inputStyle}
          />
        </div>

        {/* Category + Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#7c85a2', display: 'block', marginBottom: 5 }}>Tipo</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as NoteCategory)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="repuesto">🔧 Pedido de repuesto</option>
              <option value="reparacion-cf">🛠️ Reparación CF</option>
              <option value="reparacion-gremio">🔩 Reparación gremio</option>
              <option value="general">📋 General</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#7c85a2', display: 'block', marginBottom: 5 }}>Prioridad</label>
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

        {/* Product */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#7c85a2', display: 'block', marginBottom: 5 }}>
            Equipo Apple <span style={{ color: '#475569' }}>(opcional)</span>
          </label>
          <input
            value={product}
            onChange={e => setProduct(e.target.value)}
            placeholder="Ej: iPhone 15 Pro, iPad Air 5..."
            style={inputStyle}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {APPLE_DEVICES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setProduct(prev => prev === d ? '' : d)}
                style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${product === d ? '#6366f1' : 'var(--border)'}`,
                  background: product === d ? 'rgba(99,102,241,0.2)' : 'var(--surface)',
                  color: product === d ? '#818cf8' : '#7c85a2',
                  transition: 'all 0.12s',
                  fontWeight: product === d ? 600 : 400,
                }}
              >{d}</button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#7c85a2', display: 'block', marginBottom: 5 }}>Descripción</label>
          <textarea
            ref={textRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit() }}
            placeholder="Describí el pedido o la información..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Ctrl+Enter para guardar</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: '#7c85a2', cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            onClick={submit}
            disabled={loading || !content.trim() || !author.trim()}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
              background: loading || !content.trim() || !author.trim() ? 'var(--surface2)' : '#6366f1',
              border: 'none',
              color: loading || !content.trim() || !author.trim() ? '#475569' : '#fff',
              cursor: loading || !content.trim() || !author.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >{loading ? 'Guardando...' : '+ Guardar nota'}</button>
        </div>
      </div>
    </>
  )
}

// ─── Note Card ───────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const dt = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - dt.getTime()) / 60000)
  const clock = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const date = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  const isToday = dt.toDateString() === now.toDateString()
  const rel =
    diffMin < 1 ? 'ahora' :
    diffMin < 60 ? `hace ${diffMin} min` :
    diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)} h` :
    `hace ${Math.floor(diffMin / 1440)} d`
  return isToday ? `${clock} · ${rel}` : `${date} ${clock}`
}

function NoteCard({
  note, onToggle, onDelete,
}: {
  note: Note
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cat = CATEGORY_COLORS[note.category]
  const isDeleted = !!note.deleted

  const borderColor = isDeleted ? '#ef4444' : note.resolved ? '#22c55e' : cat.border
  const topColor   = isDeleted ? '#ef4444' : note.resolved ? '#22c55e' : cat.border

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${borderColor}44`,
      borderTop: `3px solid ${topColor}`,
      borderRadius: 10,
      padding: '14px 16px',
      opacity: note.resolved || isDeleted ? 0.7 : 1,
      transition: 'opacity 0.2s',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${note.authorColor}22`,
          border: `2px solid ${note.authorColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: note.authorColor, flexShrink: 0,
        }}>
          {note.author.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{note.author}</div>
          <div style={{ fontSize: 11, color: '#7c85a2' }}>Creada: {fmtTime(note.createdAt)}</div>
        </div>
        <span title={`Prioridad: ${note.priority}`} style={{ fontSize: 16 }}>
          {note.priority === 'alta' ? '🔴' : note.priority === 'media' ? '🟡' : '🟢'}
        </span>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
          fontWeight: 600,
        }}>
          {CATEGORY_LABELS[note.category]}
        </span>
        {note.product && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
            border: '1px solid var(--border)',
          }}>
            📱 {note.product}
          </span>
        )}
        {isDeleted && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(239,68,68,0.12)', color: '#f87171',
            border: '1px solid #ef444455', fontWeight: 600,
          }}>
            🗑 Eliminada
          </span>
        )}
      </div>

      {/* Content */}
      <p style={{
        fontSize: 13, color: '#e2e8f0', lineHeight: 1.6,
        textDecoration: note.resolved || isDeleted ? 'line-through' : 'none',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
      }}>
        {note.content}
      </p>

      {/* Status timestamps */}
      {(note.resolvedAt || note.deletedAt) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {note.resolvedAt && (
            <div style={{ fontSize: 11, color: '#4ade80' }}>
              ✓ Resuelto: {fmtTime(note.resolvedAt)}
            </div>
          )}
          {note.deletedAt && (
            <div style={{ fontSize: 11, color: '#f87171' }}>
              🗑 Eliminado: {fmtTime(note.deletedAt)}
            </div>
          )}
        </div>
      )}

      {/* Actions — hide for deleted notes */}
      {!isDeleted && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button
          onClick={() => onToggle(note.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            background: note.resolved ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${note.resolved ? '#22c55e' : 'var(--border)'}`,
            color: note.resolved ? '#4ade80' : '#7c85a2',
            fontWeight: 500, transition: 'all 0.15s',
          }}
        >
          {note.resolved ? '✓ Resuelto' : 'Marcar resuelto'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: '#7c85a2',
                }}
              >Cancelar</button>
              <button
                onClick={() => onDelete(note.id)}
                style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
                  color: '#f87171', fontWeight: 600,
                }}
              >Confirmar</button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: '#475569', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ef4444'
                e.currentTarget.style.color = '#f87171'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = '#475569'
              }}
            >Eliminar</button>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 18px', flex: '1 1 120px',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#7c85a2', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Main Board ───────────────────────────────────────────────────────────────
export default function NotasBoard({ onNotesChange }: { onNotesChange?: (pending: number) => void }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [author, setAuthor] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all' | 'deleted' | NoteCategory>('pending')

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
      const data: Note[] = await res.json()
      setNotes(data)
      onNotesChange?.(data.filter(n => !n.resolved).length)
    } finally { setLoading(false) }
  }, [onNotesChange])

  useEffect(() => { fetchNotes() }, [fetchNotes])
  useEffect(() => {
    const id = setInterval(fetchNotes, 30_000)
    return () => clearInterval(id)
  }, [fetchNotes])

  const handleSubmit = async (data: { content: string; category: NoteCategory; priority: NotePriority; product: string }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, ...data }),
      })
      if (res.ok) {
        const note: Note = await res.json()
        setNotes(prev => {
          const next = [note, ...prev]
          onNotesChange?.(next.filter(n => !n.resolved).length)
          return next
        })
        setShowForm(false)
      }
    } finally { setSubmitting(false) }
  }

  const handleToggle = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'PATCH' })
    if (res.ok) {
      const updated: Note = await res.json()
      setNotes(prev => {
        const next = prev.map(n => n.id === id ? updated : n)
        onNotesChange?.(next.filter(n => !n.resolved).length)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const updated: Note = await res.json()
      setNotes(prev => {
        const next = prev.map(n => n.id === id ? updated : n)
        onNotesChange?.(next.filter(n => !n.resolved && !n.deleted).length)
        return next
      })
    }
  }

  const active = notes.filter(n => !n.deleted)
  const pending = active.filter(n => !n.resolved)
  const highPriority = active.filter(n => !n.resolved && n.priority === 'alta')
  const resolvedNotes = active.filter(n => n.resolved)
  const deletedNotes = notes.filter(n => n.deleted)

  const filtered = notes.filter(n => {
    if (filter === 'deleted') return !!n.deleted
    if (n.deleted) return false
    if (filter === 'pending') return !n.resolved
    if (filter === 'all') return true
    return n.category === filter
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
            📋 Notas del equipo
          </h2>
          <p style={{ fontSize: 13, color: '#7c85a2', margin: '4px 0 0' }}>
            Pedidos de repuestos, información de reparaciones y notas generales
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 9, fontWeight: 700, fontSize: 14,
            background: '#6366f1', border: 'none', color: '#fff',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Agregar nota
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Pendientes" value={pending.length} color="#818cf8" />
        <Stat label="Alta prioridad" value={highPriority.length} color="#f87171" />
        <Stat label="Resueltas" value={resolvedNotes.length} color="#4ade80" />
        <Stat label="Eliminadas" value={deletedNotes.length} color="#f87171" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#475569', marginRight: 4 }}>Mostrar:</span>
        {([
          ['pending', `Pendientes (${pending.length})`],
          ['all', 'Todas'],
          ['repuesto', '🔧 Repuestos'],
          ['reparacion-cf', '🛠️ Rep. CF'],
          ['reparacion-gremio', '🔩 Rep. gremio'],
          ['general', '📋 General'],
          ['deleted', `🗑 Eliminadas (${deletedNotes.length})`],
        ] as [typeof filter, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${filter === val ? '#6366f1' : 'var(--border)'}`,
              background: filter === val ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
              color: filter === val ? '#818cf8' : '#7c85a2',
              transition: 'all 0.15s',
            }}
          >{label}</button>
        ))}

        {/* Refresh */}
        <button
          onClick={fetchNotes}
          disabled={loading}
          title="Actualizar"
          style={{
            marginLeft: 'auto',
            padding: '5px 12px', borderRadius: 20, fontSize: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: '#7c85a2', cursor: 'pointer',
          }}
        >{loading ? '⟳ Actualizando...' : '↻ Actualizar'}</button>
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px dashed var(--border)', borderRadius: 12, color: '#475569',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: '#7c85a2' }}>
            {filter === 'pending' ? 'No hay notas pendientes' : 'No hay notas en esta categoría'}
          </div>
          {filter === 'pending' && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                marginTop: 16, padding: '8px 20px', borderRadius: 8,
                background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f1',
                color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >+ Agregar la primera nota</button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}>
          {filtered.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add note modal */}
      {showForm && (
        <AddNoteModal
          author={author}
          onAuthorChange={handleAuthorChange}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
          loading={submitting}
        />
      )}

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}
