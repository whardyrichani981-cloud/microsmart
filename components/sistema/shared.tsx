'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Formatters ───────────────────────────────────────────────────────────────
export function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
export function fmtUSD(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
export function fmtNum(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}
export function today() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Colors ───────────────────────────────────────────────────────────────────
export const C = {
  green: '#22C55E', red: '#FF3B30', yellow: '#0066CC',
  blue: '#007AFF', purple: '#5856D6', orange: '#F59E0B', teal: '#34C759',
  surface: 'var(--surface)', surface2: 'var(--surface2)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  dim: 'var(--text-dim)',
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string
  onClose: () => void
  onSubmit: () => void
  submitLabel?: string
  submitting?: boolean
  submitColor?: string
  children: React.ReactNode
  width?: number
}
export function Modal({ title, onClose, onSubmit, submitLabel = 'Guardar', submitting, submitColor, children, width = 560 }: ModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div style={{ width, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 60px var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface2)' }}>
          {children}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, background: 'var(--surface)' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
          <button onClick={onSubmit} disabled={submitting} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: submitColor ?? C.yellow, color: '#FFFFFF', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  required?: boolean
  calc?: boolean       // campos calculados automáticamente
  children: React.ReactNode
  col?: number
}
export function Field({ label, required, calc, children, col }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: col ? `span ${col}` : undefined }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: calc ? '#16a34a' : C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{required && <span style={{ color: C.red }}>*</span>}
        {calc && <span style={{ fontSize: 9, background: 'rgba(22,163,74,0.10)', color: '#16a34a', padding: '1px 5px', borderRadius: 4, border: '1px solid rgba(22,163,74,0.25)' }}>AUTO</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Searchable Select ───────────────────────────────────────────────────────
interface SearchableSelectProps {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  emptyOption?: string
}
export function SearchableSelect({ value, onChange, options, placeholder = 'Buscar...', emptyOption }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Expand common abbreviations so "iphone" also matches "iph", and vice versa
  const expandSearch = (q: string) => {
    const lower = q.toLowerCase().trim()
    const aliases: Record<string, string[]> = {
      iphone: ['iphone', 'iph'], iph: ['iph', 'iphone'],
      ipad: ['ipad'], watch: ['watch', 'apple watch'],
      macbook: ['macbook', 'mac book', 'mbp', 'mba'],
      pantalla: ['pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'display', 'incell'],
      modulo:   ['modulo', 'módulo', 'pantalla', 'lcd', 'oled', 'display', 'incell'],
      módulo:   ['modulo', 'módulo', 'pantalla', 'lcd', 'oled', 'display', 'incell'],
      lcd:      ['lcd', 'pantalla', 'modulo', 'módulo', 'oled', 'display', 'incell'],
      oled:     ['oled', 'pantalla', 'modulo', 'módulo', 'lcd', 'display', 'incell'],
      display:  ['display', 'pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'incell'],
      incell:   ['incell', 'pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'display'],
      bateria: ['bateria', 'bat', 'battery'], camara: ['camara', 'cam', 'camera'],
    }
    const terms = aliases[lower] ?? [lower]
    return terms
  }
  const filtered = options.filter(o => {
    if (!query) return true
    const lower = o.toLowerCase()
    return expandSearch(query).some(t => lower.includes(t))
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const select = (opt: string) => {
    onChange(opt)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => { setOpen(o => !o); setQuery('') }}
        style={{
          ...inputSt, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || (emptyOption ?? placeholder)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, marginLeft: 6 }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px var(--shadow)',
          maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              style={{ ...inputSt, padding: '5px 10px', fontSize: 12 }}
            />
          </div>
          {/* Options */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {emptyOption && (
              <div
                onClick={() => select('')}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                  color: 'var(--text-secondary)', fontStyle: 'italic',
                  background: !value ? 'rgba(0,102,204,0.05)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = !value ? 'rgba(0,102,204,0.05)' : 'transparent'}
              >
                {emptyOption}
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center' }}>Sin resultados</div>
            ) : filtered.map(opt => (
              <div
                key={opt}
                onClick={() => select(opt)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                  color: opt === value ? '#0066CC' : 'var(--text-primary)',
                  background: opt === value ? 'rgba(0,102,204,0.08)' : 'transparent',
                  fontWeight: opt === value ? 600 : 400,
                }}
                onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (opt !== value) e.currentTarget.style.background = 'transparent' }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AutoCap input ────────────────────────────────────────────────────────────
export function AutoCapInput({ onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      autoCapitalize="sentences"
      {...props}
      onChange={e => {
        const v = e.target.value
        if (v.length > 0) e.target.value = v.charAt(0).toUpperCase() + v.slice(1)
        onChange?.(e)
      }}
    />
  )
}

export const inputSt: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
}
export const calcSt: React.CSSProperties = {
  ...inputSt, background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.22)',
  color: '#16a34a', fontWeight: 700, fontFamily: 'monospace',
}
export const selectSt: React.CSSProperties = { ...inputSt }

// ─── Grid form layout ─────────────────────────────────────────────────────────
export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
export function SectionDivider({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: color ?? C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ─── Page header ─────────────────────────────────────────────────────────────
interface PageHeaderProps {
  icon: string; title: string; desc?: string; color?: string
  count?: number; onNew?: () => void; newLabel?: string
  extra?: React.ReactNode
}
export function PageHeader({ icon, title, desc, color, count, onNew, newLabel = 'Nuevo', extra }: PageHeaderProps) {
  const ac = color ?? C.yellow
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ac}15`, border: `1.5px solid ${ac}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {title}
            {count !== undefined && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: `${ac}15`, color: ac, border: `1px solid ${ac}25` }}>{count}</span>}
          </div>
          {desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      {extra}
      {onNew && (
        <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: ac, color: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0, boxShadow: `0 2px 8px ${ac}30` }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {newLabel}
        </button>
      )}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
interface Col<T extends object> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number | string
}
interface TableProps<T extends object> {
  cols: Col<T>[]
  data: T[]
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  keyField?: keyof T
  emptyMsg?: string
  accentColor?: string
}
export function DataTable<T extends object>({ cols, data, onEdit, onDelete, keyField = 'id' as keyof T, emptyMsg = 'Sin registros', accentColor }: TableProps<T>) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '9px 12px', textAlign: c.align ?? 'left', color: C.muted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', width: c.width }}>
                {c.label}
              </th>
            ))}
            {(onEdit || onDelete) && <th style={{ width: 70, borderBottom: '1px solid var(--border)' }} />}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={cols.length + 1} style={{ padding: '32px 16px', textAlign: 'center', color: C.dim, fontSize: 13 }}>{emptyMsg}</td></tr>
          ) : data.map((row, i) => (
            <tr key={String((row as Record<keyof T, unknown>)[keyField])}
              style={{ borderBottom: i < data.length - 1 ? '1px solid var(--row-border)' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {cols.map(c => (
                <td key={c.key} style={{ padding: '8px 12px', color: C.text, textAlign: c.align ?? 'left', verticalAlign: 'middle' }}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  {onEdit && <button onClick={() => onEdit(row)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = accentColor ?? C.yellow} onMouseLeave={e => e.currentTarget.style.color = C.muted}>✏️</button>}
                  {onDelete && <button onClick={() => { if (confirm('¿Eliminar este registro?')) onDelete(row) }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = C.red} onMouseLeave={e => e.currentTarget.style.color = C.muted}>🗑️</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function KPICard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: string }) {
  const ac = color ?? C.yellow
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${ac}30`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: '0 1px 4px var(--shadow)' }}>
      {icon && (
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ac}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: ac, fontFamily: 'monospace' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: `${color}14`, color, border: `1px solid ${color}28`, whiteSpace: 'nowrap' }}>{label}</span>
}

// ─── DictateButton ────────────────────────────────────────────────────────────
// Botón de micrófono para dictar texto. Usa la Web Speech API del navegador.
// onResult recibe el texto reconocido para que el padre lo agregue al campo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

export function DictateButton({ onResult, lang = 'es-AR' }: { onResult: (text: string) => void; lang?: string }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<AnySpeechRecognition>(null)

  const toggle = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Tu navegador no soporta reconocimiento de voz.\nUsá Google Chrome o Microsoft Edge.')
      return
    }
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: AnySpeechRecognition = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript
      onResult(text)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Detener dictado (hablá ahora)' : 'Dictar por voz'}
      style={{
        padding: '0 10px',
        height: 34,
        borderRadius: 7,
        border: `1px solid ${listening ? '#FF3B30' : 'var(--border)'}`,
        background: listening ? 'rgba(255,59,48,0.08)' : 'var(--surface2)',
        color: listening ? '#FF3B30' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 15,
        flexShrink: 0,
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        animation: listening ? 'mic-pulse 1s ease-in-out infinite' : 'none',
      }}
    >
      {listening ? '🔴' : '🎤'}
    </button>
  )
}

// ─── useApi hook ──────────────────────────────────────────────────────────────
export function useApi<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(url, { signal: abortRef.current.signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message ?? 'Error de red')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    return () => { abortRef.current?.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refresh }
}
