'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Note, NoteCategory, NotePriority } from '@/lib/notes'
import { CATEGORY_LABELS, CATEGORY_COLORS, PRIORITY_COLORS } from '@/lib/notes'

const APPLE_DEVICES_BY_CATEGORY: { label: string; icon: string; models: string[] }[] = [
  {
    label: 'iPhone', icon: '📱',
    models: [
      'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Air', 'iPhone 17',
      'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      'iPhone SE 3', 'iPhone SE 2', 'iPhone SE 1',
      'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      'iPhone 8 Plus', 'iPhone 8',
      'iPhone 7 Plus', 'iPhone 7',
    ],
  },
  {
    label: 'iPad', icon: '📲',
    models: [
      // iPad Pro
      'iPad Pro 13" (M4)', 'iPad Pro 11" (M4)',
      'iPad Pro 12.9" (6ta gen)', 'iPad Pro 11" (4ta gen)',
      'iPad Pro 12.9" (5ta gen)', 'iPad Pro 11" (3ra gen)',
      'iPad Pro 12.9" (4ta gen)', 'iPad Pro 11" (2da gen)',
      'iPad Pro 12.9" (3ra gen)', 'iPad Pro 11" (1ra gen)',
      'iPad Pro 12.9" (2da gen)', 'iPad Pro 12.9" (1ra gen)',
      'iPad Pro 10.5"', 'iPad Pro 9.7"',
      // iPad Air
      'iPad Air M2', 'iPad Air 5', 'iPad Air 4',
      'iPad Air 3', 'iPad Air 2', 'iPad Air 1',
      // iPad Mini
      'iPad Mini 6', 'iPad Mini 5', 'iPad Mini 4',
      'iPad Mini 3', 'iPad Mini 2',
      // iPad estándar
      'iPad 10', 'iPad 9', 'iPad 8', 'iPad 7', 'iPad 6', 'iPad 5',
    ],
  },
  {
    label: 'Apple Watch', icon: '⌚',
    models: [
      'Apple Watch Ultra 2', 'Apple Watch Ultra',
      'Apple Watch Series 10',
      'Apple Watch Series 9', 'Apple Watch Series 8', 'Apple Watch Series 7',
      'Apple Watch Series 6', 'Apple Watch Series 5', 'Apple Watch Series 4',
      'Apple Watch Series 3',
      'Apple Watch SE 2', 'Apple Watch SE',
    ],
  },
  {
    label: 'Mac', icon: '💻',
    models: [
      // MacBook Pro 16"
      'MacBook Pro 16" M3 Max', 'MacBook Pro 16" M3 Pro', 'MacBook Pro 16" M3',
      'MacBook Pro 16" M2 Max', 'MacBook Pro 16" M2 Pro',
      'MacBook Pro 16" M1 Max', 'MacBook Pro 16" M1 Pro',
      'MacBook Pro 16" 2019', 'MacBook Pro 16" 2020',
      // MacBook Pro 15"
      'MacBook Pro 15" 2019', 'MacBook Pro 15" 2018',
      'MacBook Pro 15" 2017', 'MacBook Pro 15" 2016', 'MacBook Pro 15" 2015',
      // MacBook Pro 14"
      'MacBook Pro 14" M3 Max', 'MacBook Pro 14" M3 Pro', 'MacBook Pro 14" M3',
      'MacBook Pro 14" M2 Max', 'MacBook Pro 14" M2 Pro',
      'MacBook Pro 14" M1 Max', 'MacBook Pro 14" M1 Pro',
      // MacBook Pro 13"
      'MacBook Pro 13" M2', 'MacBook Pro 13" M1',
      'MacBook Pro 13" 2020', 'MacBook Pro 13" 2019',
      'MacBook Pro 13" 2018', 'MacBook Pro 13" 2017',
      'MacBook Pro 13" 2016', 'MacBook Pro 13" 2015',
      // MacBook Air
      'MacBook Air 15" M3', 'MacBook Air 13" M3',
      'MacBook Air 15" M2', 'MacBook Air 13" M2',
      'MacBook Air M1',
      'MacBook Air 2020', 'MacBook Air 2019', 'MacBook Air 2018',
      'MacBook Air 2017', 'MacBook Air 2015',
      // MacBook 12"
      'MacBook 12" 2019', 'MacBook 12" 2018',
      'MacBook 12" 2017', 'MacBook 12" 2016', 'MacBook 12" 2015',
      // iMac
      'iMac 24" M3', 'iMac 24" M1',
      'iMac 27" 2020', 'iMac 27" 2019', 'iMac 27" 2017',
      'iMac 21.5" 2019', 'iMac 21.5" 2017',
      'iMac 21.5" 2015', 'iMac 27" 2015',
      // Mac mini
      'Mac mini M2 Pro', 'Mac mini M2',
      'Mac mini M1', 'Mac mini 2020', 'Mac mini 2018',
    ],
  },
]

// ─── Apple Device Dropdown ───────────────────────────────────────────────────
function AppleDeviceDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, color: '#E5E5E3', fontSize: 13, outline: 'none',
    width: '100%', padding: '8px 12px', boxSizing: 'border-box', cursor: 'pointer',
  }

  const q = search.toLowerCase()
  const filtered = APPLE_DEVICES_BY_CATEGORY.map(cat => ({
    ...cat,
    models: cat.models.filter(m => m.toLowerCase().includes(q)),
  })).filter(cat => cat.models.length > 0)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        readOnly
        value={value}
        onClick={() => setOpen(o => !o)}
        placeholder="Seleccionar modelo..."
        style={{ ...inputStyle, caretColor: 'transparent' }}
      />
      {value && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#484848', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '0 2px',
          }}
        >×</button>
      )}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
          zIndex: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxHeight: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search inside dropdown */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar modelo..."
              style={{
                ...inputStyle, cursor: 'text', fontSize: 12,
                padding: '6px 10px', borderRadius: 6,
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Category list */}
          <div style={{ overflowY: 'auto', padding: '6px 0' }}>
            {filtered.map(cat => (
              <div key={cat.label}>
                <div style={{
                  padding: '6px 12px 3px',
                  fontSize: 11, fontWeight: 700, color: '#F5C400',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {cat.icon} {cat.label}
                </div>
                {cat.models.map(model => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => { onChange(model); setOpen(false); setSearch('') }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 14px 7px 24px', fontSize: 13,
                      background: value === model ? 'rgba(245,196,0,0.10)' : 'transparent',
                      color: value === model ? '#F5C400' : '#E5E5E3',
                      border: 'none', cursor: 'pointer',
                      fontWeight: value === model ? 600 : 400,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (value !== model) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (value !== model) e.currentTarget.style.background = 'transparent' }}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#484848', fontSize: 13 }}>
                Sin resultados
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Note Modal ──────────────────────────────────────────────────────────
function AddNoteModal({
  solicitadoPor,
  availableUsers,
  onSubmit,
  onClose,
  loading,
}: {
  solicitadoPor: string
  availableUsers: string[]
  onSubmit: (data: { content: string; category: NoteCategory; priority: NotePriority; product: string; reminderAt?: string; responsable: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<NoteCategory>('repuesto')
  const [priority, setPriority] = useState<NotePriority>('media')
  const [product, setProduct] = useState('')
  const [responsable, setResponsable] = useState(solicitadoPor)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderDate, setReminderDate] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30, 0, 0)
    return now.toISOString().slice(0, 16)
  })
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  const submit = () => {
    if (!content.trim() || !responsable.trim()) return
    const reminderAt = reminderEnabled && reminderDate
      ? new Date(reminderDate).toISOString()
      : undefined
    onSubmit({ content, category, priority, product, reminderAt, responsable })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: '#E5E5E3',
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
            <div style={{ fontWeight: 700, fontSize: 17, color: '#E5E5E3' }}>Agregar nota</div>
            <div style={{ fontSize: 12, color: '#676767', marginTop: 2 }}>Completá los campos y guardá</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#676767', fontSize: 18, cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* Solicitado por + Responsable */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>Solicitado por</label>
            <div style={{ ...inputStyle, background: 'rgba(255,255,255,0.04)', color: '#8A8A8A', cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#F5C40022', border: '1.5px solid #F5C40066', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#F5C400', flexShrink: 0 }}>
                {solicitadoPor.slice(0, 2).toUpperCase()}
              </span>
              {solicitadoPor}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>Responsable</label>
            <select
              value={responsable}
              onChange={e => setResponsable(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {availableUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category + Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>Tipo</label>
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
            <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>Prioridad</label>
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
          <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>
            Equipo Apple <span style={{ color: '#484848' }}>(opcional)</span>
          </label>
          <AppleDeviceDropdown value={product} onChange={setProduct} />
        </div>

        {/* Reminder */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 8 }}>
            Recordatorio
          </label>
          <div style={{
            border: `1px solid ${reminderEnabled ? '#F5C400' : 'var(--border)'}`,
            borderRadius: 8, overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}>
            {/* Toggle row */}
            <div
              onClick={() => setReminderEnabled(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', cursor: 'pointer',
                background: reminderEnabled ? 'rgba(245,196,0,0.07)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>⏰</span>
                <span style={{ fontSize: 13, color: reminderEnabled ? '#F5C400' : '#676767' }}>
                  {reminderEnabled ? 'Recordatorio activado' : 'Agregar recordatorio'}
                </span>
              </div>
              {/* toggle switch */}
              <div style={{
                width: 36, height: 20, borderRadius: 10,
                background: reminderEnabled ? '#F5C400' : '#2E2E2E',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 2,
                  left: reminderEnabled ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </div>
            </div>
            {/* Datetime picker */}
            {reminderEnabled && (
              <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#676767', padding: '8px 0 6px' }}>
                  Fecha y hora del recordatorio
                </div>
                <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{
                    ...inputStyle,
                    colorScheme: 'dark',
                    cursor: 'pointer',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#676767', display: 'block', marginBottom: 5 }}>Descripción</label>
          <textarea
            ref={textRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit() }}
            placeholder="Describí el pedido o la información..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: 11, color: '#484848', marginTop: 3 }}>Ctrl+Enter para guardar</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: '#676767', cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            onClick={submit}
            disabled={loading || !content.trim() || !responsable.trim()}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
              background: loading || !content.trim() || !responsable.trim() ? 'var(--surface2)' : '#F5C400',
              border: 'none',
              color: loading || !content.trim() || !responsable.trim() ? '#484848' : '#0c0d0f',
              cursor: loading || !content.trim() || !responsable.trim() ? 'not-allowed' : 'pointer',
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
  note, onToggle, onDelete, onPermanentDelete, isSuperAdmin, currentUserName, isAdmin,
}: {
  note: Note
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onPermanentDelete?: (id: string) => void
  isSuperAdmin?: boolean
  currentUserName?: string
  isAdmin?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPerm, setConfirmPerm] = useState(false)
  const cat = CATEGORY_COLORS[note.category]
  const isDeleted = !!note.deleted

  const borderColor = isDeleted ? '#ef4444' : note.resolved ? '#22c55e' : cat.border
  const topColor   = isDeleted ? '#ef4444' : note.resolved ? '#22c55e' : cat.border

  // Only the responsable (or admin) can mark it done
  const canToggle = isAdmin || isSuperAdmin || !note.responsable || currentUserName === note.responsable

  const solicitante = note.solicitadoPor ?? note.author
  const responsable = note.responsable

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
          {/* Solicitado por → Responsable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#8A8A8A' }}>{solicitante}</span>
            {responsable && responsable !== solicitante && (
              <>
                <span style={{ fontSize: 11, color: '#484848' }}>→</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: currentUserName === responsable ? '#F5C400' : '#E5E5E3',
                }}>
                  {responsable}
                  {currentUserName === responsable && (
                    <span style={{ fontSize: 10, color: '#F5C400', marginLeft: 3 }}>(tú)</span>
                  )}
                </span>
              </>
            )}
            {responsable && responsable === solicitante && (
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: currentUserName === responsable ? '#F5C400' : '#E5E5E3',
              }}>
                {currentUserName === responsable && (
                  <span style={{ fontSize: 10, color: '#F5C400', marginLeft: 3 }}>(tú)</span>
                )}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#676767' }}>Creada: {fmtTime(note.createdAt)}</div>
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
            background: 'rgba(255,255,255,0.05)', color: '#8A8A8A',
            border: '1px solid var(--border)',
          }}>
            📱 {note.product}
          </span>
        )}
        {note.reminderAt && !note.resolved && !note.deleted && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(250,204,21,0.1)', color: '#fbbf24',
            border: '1px solid rgba(250,204,21,0.3)',
          }}>
            ⏰ {new Date(note.reminderAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
        fontSize: 13, color: '#E5E5E3', lineHeight: 1.6,
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
              ✓ Completado {note.resolvedBy ? `por ${note.resolvedBy}` : ''}: {fmtTime(note.resolvedAt)}
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
          onClick={() => canToggle ? onToggle(note.id) : undefined}
          title={!canToggle ? 'Solo el responsable puede marcar como completado' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '5px 12px', borderRadius: 7,
            cursor: canToggle ? 'pointer' : 'not-allowed',
            background: note.resolved ? 'rgba(34,197,94,0.12)' : canToggle ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${note.resolved ? '#22c55e' : canToggle ? 'var(--border)' : 'var(--border)'}`,
            color: note.resolved ? '#4ade80' : canToggle ? '#676767' : '#333',
            fontWeight: 500, transition: 'all 0.15s', opacity: canToggle ? 1 : 0.45,
          }}
        >
          {note.resolved ? '✓ Completado' : canToggle ? 'Marcar resuelto' : '🔒 Solo responsable'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: '#676767',
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
                color: '#484848', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ef4444'
                e.currentTarget.style.color = '#f87171'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = '#484848'
              }}
            >Eliminar</button>
          )}
        </div>
      </div>
      )}

      {/* Permanent delete — only for deleted notes, only for superadmin */}
      {isDeleted && isSuperAdmin && onPermanentDelete && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          {confirmPerm ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setConfirmPerm(false)}
                style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)', color: '#676767',
                }}
              >Cancelar</button>
              <button
                onClick={() => onPermanentDelete(note.id)}
                style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                  background: '#ef4444', border: 'none',
                  color: '#fff', fontWeight: 700,
                }}
              >Sí, eliminar para siempre</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPerm(true)}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', border: '1px solid #ef444466',
                color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              }}
            >🗑 Eliminar definitivamente</button>
          )}
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
      <div style={{ fontSize: 12, color: '#676767', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Main Board ───────────────────────────────────────────────────────────────
export default function NotasBoard({
  onNotesChange,
  currentUserName,
  isSuperAdmin,
  role,
}: {
  onNotesChange?: (pending: number) => void
  currentUserName?: string
  isSuperAdmin?: boolean
  role?: string
}) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [author, setAuthor] = useState('')
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'all' | 'deleted' | NoteCategory>('pending')
  const [availableUsers, setAvailableUsers] = useState<string[]>([])
  const firedReminders = useRef<Set<string>>(new Set())

  const isAdmin = isSuperAdmin || role === 'admin' || role === 'superadmin'

  useEffect(() => {
    if (currentUserName) {
      setAuthor(currentUserName)
    } else {
      const saved = localStorage.getItem('ms-author')
      if (saved) setAuthor(saved)
    }
  }, [currentUserName])

  // Load system users for responsable dropdown
  useEffect(() => {
    fetch('/api/sistema/usuarios')
      .then(r => r.json())
      .then((users: { displayName: string; role: string }[]) => {
        setAvailableUsers(users.map(u => u.displayName))
      })
      .catch(() => {})
  }, [])

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setNotifPermission(Notification.permission)
  }, [])

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  // Load already-fired reminder IDs from localStorage so reloads don't re-fire
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ms-fired-reminders') ?? '[]') as string[]
      saved.forEach(id => firedReminders.current.add(id))
    } catch { /* ignore */ }
  }, [])

  // Check reminders every 15 seconds
  useEffect(() => {
    const check = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      notes.forEach(note => {
        if (!note.reminderAt || note.resolved || note.deleted) return
        if (firedReminders.current.has(note.id)) return
        const due = new Date(note.reminderAt).getTime()
        // Fire within a 5-minute window after the due time
        if (now >= due && now < due + 5 * 60 * 1000) {
          firedReminders.current.add(note.id)
          // Persist to localStorage so reloads don't re-fire
          try {
            const saved = JSON.parse(localStorage.getItem('ms-fired-reminders') ?? '[]') as string[]
            localStorage.setItem('ms-fired-reminders', JSON.stringify([...saved, note.id]))
          } catch { /* ignore */ }
          const n = new Notification(`⏰ Recordatorio — ${note.author}`, {
            body: `${note.product ? `[${note.product}] ` : ''}${note.content}`,
            icon: '/favicon.ico',
            tag: note.id,
            requireInteraction: true,
          })
          n.onclick = () => { window.focus(); n.close() }
        }
      })
    }
    check()
    const id = setInterval(check, 15_000)
    return () => clearInterval(id)
  }, [notes])

  // Sync pending count to parent — always after notes state settles, never inside a setState updater
  useEffect(() => {
    onNotesChange?.(notes.filter(n => !n.resolved && !n.deleted).length)
  }, [notes, onNotesChange])

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes')
      const data: Note[] = await res.json()
      setNotes(data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])
  useEffect(() => {
    const id = setInterval(fetchNotes, 30_000)
    return () => clearInterval(id)
  }, [fetchNotes])

  const handleSubmit = async (data: { content: string; category: NoteCategory; priority: NotePriority; product: string; reminderAt?: string; responsable: string }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          ...data,
          solicitadoPor: author,
          responsable: data.responsable,
        }),
      })
      if (res.ok) {
        const note: Note = await res.json()
        setNotes(prev => [note, ...prev])
        setShowForm(false)
      }
    } finally { setSubmitting(false) }
  }

  const handleToggle = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedBy: currentUserName ?? author }),
    })
    if (res.ok) {
      const updated: Note = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const updated: Note = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
    }
  }

  const handlePermanentDelete = async (id: string) => {
    const res = await fetch(`/api/notes/${id}/permanent`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== id))
    }
  }

  // Visibility: admins see all; others only see notes they requested or are responsible for
  const visibleNotes = notes.filter(n => {
    if (isAdmin) return true
    if (!author) return true  // no user identity yet — show all (graceful fallback)
    const isResponsable = n.responsable === author
    const isSolicitante = (n.solicitadoPor ?? n.author) === author
    return isResponsable || isSolicitante
  })

  const active = visibleNotes.filter(n => !n.deleted)
  const pending = active.filter(n => !n.resolved)
  const highPriority = active.filter(n => !n.resolved && n.priority === 'alta')
  const resolvedNotes = active.filter(n => n.resolved)
  const deletedNotes = visibleNotes.filter(n => n.deleted)

  const filtered = visibleNotes.filter(n => {
    if (filter === 'deleted') return !!n.deleted
    if (n.deleted) return false
    if (filter === 'pending') return !n.resolved
    if (filter === 'resolved') return !!n.resolved
    if (filter === 'all') return true
    return n.category === filter && !n.resolved
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E5E5E3', margin: 0 }}>
            📋 Notas del equipo
          </h2>
          <p style={{ fontSize: 13, color: '#676767', margin: '4px 0 0' }}>
            Pedidos de repuestos, información de reparaciones y notas generales
          </p>
          {/* Notification permission banner */}
          {'Notification' in (typeof window !== 'undefined' ? window : {}) && notifPermission !== 'granted' && (
            <div style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8, fontSize: 12,
              background: notifPermission === 'denied'
                ? 'rgba(239,68,68,0.1)' : 'rgba(250,204,21,0.08)',
              border: `1px solid ${notifPermission === 'denied' ? '#ef444455' : 'rgba(250,204,21,0.3)'}`,
              color: notifPermission === 'denied' ? '#f87171' : '#fbbf24',
            }}>
              {notifPermission === 'denied' ? (
                <>⚠️ Notificaciones bloqueadas — habilitá los permisos en la configuración del navegador</>
              ) : (
                <>
                  🔔 Activá notificaciones para recibir recordatorios
                  <button
                    onClick={requestNotifPermission}
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: 'none',
                      background: '#fbbf24', color: '#1e1b2e',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >Activar</button>
                </>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 9, fontWeight: 700, fontSize: 14,
            background: '#F5C400', border: 'none', color: '#0c0d0f',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(245,196,0,0.30)',
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
        <Stat label="Pendientes" value={pending.length} color="#F5C400" />
        <Stat label="Alta prioridad" value={highPriority.length} color="#f87171" />
        <Stat label="Resueltas" value={resolvedNotes.length} color="#4ade80" />
        <Stat label="Eliminadas" value={deletedNotes.length} color="#f87171" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#484848', marginRight: 4 }}>Mostrar:</span>
        {([
          ['pending', `Pendientes (${pending.length})`],
          ['resolved', `✓ Resueltas (${resolvedNotes.length})`],
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
              border: `1px solid ${filter === val ? (val === 'resolved' ? '#22c55e' : '#F5C400') : 'var(--border)'}`,
              background: filter === val ? (val === 'resolved' ? 'rgba(34,197,94,0.10)' : 'rgba(245,196,0,0.10)') : 'var(--surface)',
              color: filter === val ? (val === 'resolved' ? '#4ade80' : '#F5C400') : '#676767',
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
            color: '#676767', cursor: 'pointer',
          }}
        >{loading ? '⟳ Actualizando...' : '↻ Actualizar'}</button>
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px dashed var(--border)', borderRadius: 12, color: '#484848',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: '#676767' }}>
            {filter === 'pending' ? 'No hay notas pendientes' : filter === 'resolved' ? 'No hay tareas resueltas todavía' : 'No hay notas en esta categoría'}
          </div>
          {filter === 'pending' && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                marginTop: 16, padding: '8px 20px', borderRadius: 8,
                background: 'rgba(245,196,0,0.10)', border: '1px solid #F5C400',
                color: '#F5C400', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
              onPermanentDelete={handlePermanentDelete}
              isSuperAdmin={isSuperAdmin}
              currentUserName={author}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Add note modal */}
      {showForm && (
        <AddNoteModal
          solicitadoPor={author || 'Usuario'}
          availableUsers={availableUsers.length > 0 ? availableUsers : (author ? [author] : ['Usuario'])}
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
