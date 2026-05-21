'use client'
import { useState, useEffect, useRef } from 'react'

const NOTE_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#c084fc', '#fb923c']
const STORAGE_KEY  = 'microsmart-notas-rapidas'
const POS_KEY      = 'microsmart-notas-pos'
const BTN_SIZE     = 44
const PANEL_W      = 290
const PANEL_MAX_H  = 440
const muted        = 'var(--text-secondary)'

interface Nota { id: string; texto: string; fecha: string; color: string }
interface Pos  { x: number; y: number }

function defaultPos(): Pos {
  if (typeof window === 'undefined') return { x: 24, y: 500 }
  return { x: 24, y: window.innerHeight - BTN_SIZE - 24 }
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Pos
      // Clamp to current viewport in case screen size changed
      return {
        x: Math.max(0, Math.min(window.innerWidth  - BTN_SIZE, p.x)),
        y: Math.max(0, Math.min(window.innerHeight - BTN_SIZE, p.y)),
      }
    }
  } catch { /* ignore */ }
  return defaultPos()
}

export default function NotaRapidaFloat() {
  const [pos, setPos]       = useState<Pos | null>(null)   // null = not mounted yet (SSR safe)
  const [open, setOpen]     = useState(false)
  const [notas, setNotas]   = useState<Nota[]>([])
  const [draft, setDraft]   = useState('')
  const [color, setColor]   = useState(NOTE_COLORS[0])
  const textareaRef         = useRef<HTMLTextAreaElement>(null)
  const dragState           = useRef<{
    startMX: number; startMY: number
    startPX: number; startPY: number
    moved: boolean
  } | null>(null)

  // Hydrate position + notes from localStorage
  useEffect(() => {
    setPos(loadPos())
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setNotas(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const persistNotas = (updated: Nota[]) => {
    setNotas(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
  }

  const persistPos = (p: Pos) => {
    setPos(p)
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
  }

  const addNota = () => {
    const txt = draft.trim()
    if (!txt) return
    persistNotas([{ id: `${Date.now()}`, texto: txt, fecha: new Date().toISOString(), color }, ...notas])
    setDraft('')
    setColor(NOTE_COLORS[(NOTE_COLORS.indexOf(color) + 1) % NOTE_COLORS.length])
  }

  const deleteNota = (id: string) => persistNotas(notas.filter(n => n.id !== id))

  useEffect(() => { if (open) setTimeout(() => textareaRef.current?.focus(), 60) }, [open])

  // ── Drag handling ────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      startMX: e.clientX, startMY: e.clientY,
      startPX: pos.x,     startPY: pos.y,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragState.current
    if (!d) return
    const dx = e.clientX - d.startMX
    const dy = e.clientY - d.startMY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    if (!d.moved) return
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - BTN_SIZE, d.startPX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - BTN_SIZE, d.startPY + dy)),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragState.current
    if (!d) return
    dragState.current = null
    if (!d.moved) {
      // It was a tap/click — toggle panel
      setOpen(p => !p)
    } else {
      // Save final clamped position
      const dx = e.clientX - d.startMX
      const dy = e.clientY - d.startMY
      persistPos({
        x: Math.max(0, Math.min(window.innerWidth  - BTN_SIZE, d.startPX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - BTN_SIZE, d.startPY + dy)),
      })
    }
  }

  // ── Panel position: try to open above-right; clamp to viewport ──────────────
  const panelStyle = (): React.CSSProperties => {
    if (!pos) return { display: 'none' }
    let left = pos.x
    let top  = pos.y - PANEL_MAX_H - 8
    // If would clip off top, show below button instead
    if (top < 8) top = pos.y + BTN_SIZE + 8
    // If would clip off right, shift left
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - PANEL_W - 8
    // Final clamp
    left = Math.max(8, left)
    top  = Math.max(8, Math.min(window.innerHeight - 100, top))
    return { position: 'fixed', top, left, zIndex: 849, width: PANEL_W, maxHeight: PANEL_MAX_H }
  }

  const fmtFecha = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
        + ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  // Don't render until we know the position (avoids SSR flash)
  if (!pos) return null

  return (
    <>
      {/* ── Botón flotante draggable ── */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Notas rápidas (arrastrar para mover)"
        style={{
          position: 'fixed',
          left: pos.x,
          top:  pos.y,
          zIndex: 850,
          width: BTN_SIZE, height: BTN_SIZE, borderRadius: '50%',
          background: open ? '#1f2937' : 'var(--surface)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.28)',
          cursor: 'grab',
          fontSize: open ? 18 : 19,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.18s, box-shadow 0.18s',
          color: open ? '#fff' : 'var(--text-primary)',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {open ? '×' : '📝'}
        {!open && notas.length > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 17, height: 17, borderRadius: 9,
            background: '#f97316', color: '#fff',
            fontSize: 9, fontWeight: 800, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>{notas.length}</span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div style={{
          ...panelStyle(),
          borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: '0 10px 36px rgba(0,0,0,0.38)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '11px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📝 Notas rápidas</span>
            {notas.length > 0 && (
              <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Input area */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNota() } }}
              placeholder="Escribí algo… (Enter guarda)"
              rows={2}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, resize: 'none',
                border: `1.5px solid ${color}55`,
                background: `${color}0e`,
                color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.45,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {NOTE_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width: 14, height: 14, borderRadius: '50%', background: c,
                    border: color === c ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 1.5px ${c}` : 'none',
                    cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0,
                  }} />
                ))}
              </div>
              <button onClick={addNota} disabled={!draft.trim()} style={{
                padding: '4px 13px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700,
                background: draft.trim() ? color : 'var(--border)',
                color: draft.trim() ? '#000' : muted,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.12s',
              }}>Guardar</button>
            </div>
          </div>

          {/* Notes list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '22px 10px', color: muted, fontSize: 11 }}>
                Sin notas todavía.<br />Escribí algo arriba y presioná Enter.
              </div>
            ) : notas.map(n => (
              <div key={n.id} style={{
                padding: '8px 10px', borderRadius: 9,
                background: `${n.color}12`, border: `1px solid ${n.color}35`,
                position: 'relative',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.45, whiteSpace: 'pre-wrap', paddingRight: 18 }}>
                  {n.texto}
                </div>
                <div style={{ fontSize: 10, color: muted, marginTop: 4 }}>{fmtFecha(n.fecha)}</div>
                <button onClick={() => deleteNota(n.id)} style={{
                  position: 'absolute', top: 5, right: 6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'transparent', border: 'none',
                  color: muted, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
