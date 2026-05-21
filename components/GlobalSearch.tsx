'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { matchesAny } from '@/lib/search'

interface OrdenResult {
  type: 'orden'
  id: string
  nOrden: number
  nombreCliente: string
  modeloEquipo: string
  estado: string
  telefonoCliente?: string
}

interface ClienteResult {
  type: 'cliente'
  id: string
  nombre: string
  telefono?: string
  email?: string
  dni?: string
}

type Result = OrdenResult | ClienteResult

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (nav: 'ordenes' | 'clientes', search: string) => void
}

const ESTADO_COLOR: Record<string, string> = {
  'Entrada': '#60a5fa',
  'Técnico Saddi': '#a78bfa',
  'Laboratorio': '#f472b6',
  'Salida de laboratorio': '#fb923c',
  'Salida': '#4ade80',
  'Entregado': '#8A8A8A',
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    `<mark style="background:rgba(0,132,255,0.25);color:inherit;border-radius:3px;padding:0 1px">${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  )
}

export default function GlobalSearch({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const cacheRef = useRef<{ ordenes: OrdenResult[]; clientes: ClienteResult[] } | null>(null)

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Load data once on first open
  const loadData = useCallback(async () => {
    if (cacheRef.current) return
    setLoading(true)
    try {
      const [ordenesRes, clientesRes] = await Promise.all([
        fetch('/api/sistema/ordenes').then(r => r.json()),
        fetch('/api/sistema/clientes').then(r => r.json()),
      ])

      const ordenesRaw: any[] = ordenesRes?.items ?? (Array.isArray(ordenesRes) ? ordenesRes : [])
      const clientesRaw: any[] = clientesRes?.items ?? clientesRes?.personas ?? (Array.isArray(clientesRes) ? clientesRes : [])

      const ordenes: OrdenResult[] = ordenesRaw.map(o => ({
        type: 'orden',
        id: o.id,
        nOrden: o.nOrden,
        nombreCliente: o.nombreCliente ?? '',
        modeloEquipo: o.modeloEquipo ?? '',
        estado: o.estado ?? '',
        telefonoCliente: o.telefonoCliente,
      }))

      const clientes: ClienteResult[] = clientesRaw.map((c: any) => ({
        type: 'cliente',
        id: c.id,
        nombre: c.nombre ?? c.name ?? '',
        telefono: c.telefono,
        email: c.email,
        dni: c.dni,
      }))

      cacheRef.current = { ordenes, clientes }
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  // Filter on query change
  useEffect(() => {
    if (!query.trim() || !cacheRef.current) {
      setResults([])
      setSelectedIdx(0)
      return
    }
    const q = query.toLowerCase().trim()
    const { ordenes, clientes } = cacheRef.current

    const matchOrdenes = ordenes.filter(o =>
      matchesAny([o.nombreCliente, o.modeloEquipo], q) ||
      String(o.nOrden).includes(q) ||
      (o.telefonoCliente ?? '').includes(q)
    ).slice(0, 6)

    const matchClientes = clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.dni ?? '').includes(q)
    ).slice(0, 4)

    setResults([...matchOrdenes, ...matchClientes])
    setSelectedIdx(0)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleSelect(results[selectedIdx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, selectedIdx])

  const handleSelect = (r: Result) => {
    if (r.type === 'orden') {
      onNavigate('ordenes', String(r.nOrden))
    } else {
      onNavigate('clientes', r.nombre)
    }
    onClose()
  }

  if (!open) return null

  const ordenResults = results.filter((r): r is OrdenResult => r.type === 'orden')
  const clienteResults = results.filter((r): r is ClienteResult => r.type === 'cliente')
  let globalIdx = 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        zIndex: 901, width: '100%', maxWidth: 580,
        borderRadius: 16, overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
      }}>
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: query && results.length > 0 ? '1px solid var(--border)' : 'none',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
            viewBox="0 0 24 24" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
            <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar orden, cliente, modelo, teléfono..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--text-primary)',
              caretColor: 'var(--accent)',
            }}
          />
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Cargando…</span>
          )}
          <kbd style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 5,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results */}
        {query.trim() && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {results.length === 0 && !loading && (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                Sin resultados para <strong>"{query}"</strong>
              </div>
            )}

            {/* Órdenes */}
            {ordenResults.length > 0 && (
              <div>
                <div style={{
                  padding: '8px 18px 4px',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  🔧 Órdenes de trabajo
                </div>
                {ordenResults.map(r => {
                  const idx = globalIdx++
                  const isSelected = idx === selectedIdx
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => handleSelect(r)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 18px', border: 'none', cursor: 'pointer',
                        background: isSelected ? 'var(--accent-dim)' : 'transparent',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                    >
                      {/* Número */}
                      <div style={{
                        width: 44, height: 32, borderRadius: 8, flexShrink: 0,
                        background: 'var(--surface2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        color: ESTADO_COLOR[r.estado] ?? 'var(--text-secondary)',
                      }}>
                        #{r.nOrden}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: highlight(r.nombreCliente, query) }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}
                          dangerouslySetInnerHTML={{ __html: highlight(r.modeloEquipo, query) }}
                        />
                      </div>
                      {/* Estado */}
                      <span style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700, flexShrink: 0,
                        background: `${ESTADO_COLOR[r.estado] ?? '#8A8A8A'}18`,
                        color: ESTADO_COLOR[r.estado] ?? '#8A8A8A',
                      }}>
                        {r.estado}
                      </span>
                      {/* Arrow */}
                      <span style={{ color: 'var(--text-dim)', fontSize: 14, flexShrink: 0 }}>→</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Clientes */}
            {clienteResults.length > 0 && (
              <div style={{ borderTop: ordenResults.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  padding: '8px 18px 4px',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  👥 Clientes
                </div>
                {clienteResults.map(r => {
                  const idx = globalIdx++
                  const isSelected = idx === selectedIdx
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => handleSelect(r)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 18px', border: 'none', cursor: 'pointer',
                        background: isSelected ? 'var(--accent-dim)' : 'transparent',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #0066CC, #0A84FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: '#fff',
                      }}>
                        {r.nombre.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: highlight(r.nombre, query) }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                          {[r.telefono, r.email].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-dim)', fontSize: 14, flexShrink: 0 }}>→</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Footer hint */}
            {results.length > 0 && (
              <div style={{
                padding: '8px 18px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 16, alignItems: 'center',
              }}>
                {[['↑↓', 'navegar'], ['↵', 'abrir'], ['Esc', 'cerrar']].map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <kbd style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: 'var(--text-dim)',
                    }}>{key}</kbd>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state — no query yet */}
        {!query.trim() && (
          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '🔢', text: 'Número de orden', example: 'ej: 142' },
              { icon: '👤', text: 'Nombre del cliente', example: 'ej: García' },
              { icon: '📱', text: 'Modelo de equipo', example: 'ej: iPhone 15' },
              { icon: '📞', text: 'Teléfono', example: 'ej: 1165...' },
            ].map(hint => (
              <div key={hint.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, width: 24, textAlign: 'center', flexShrink: 0 }}>{hint.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{hint.text}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>{hint.example}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
