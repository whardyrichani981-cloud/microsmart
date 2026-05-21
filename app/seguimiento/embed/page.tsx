'use client'

/**
 * /seguimiento/embed
 *
 * Versión embebible para insertar como iframe en la web del negocio.
 * Sin header ni footer — se adapta al diseño de cualquier sitio externo.
 *
 * Embed code:
 * <iframe
 *   src="https://TU-DOMINIO/seguimiento/embed"
 *   width="100%" height="620"
 *   style="border:none; border-radius:16px;"
 *   allow="clipboard-write"
 * ></iframe>
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface SeguimientoData {
  nOrden: string
  codigoSeguimiento: string
  fecha: string
  estado: string
  prioridad: string
  modeloEquipo: string
  categoriaDispositivo: string
  nombrePublico: string
  fechaEntrega?: string
  tipo: string
  notasPublicas: { texto: string; fecha: string; area?: string }[]
}

const FASES = [
  { label: 'Ingresado',     icon: '📥' },
  { label: 'En reparación', icon: '🔧' },
  { label: 'Laboratorio',   icon: '🔬' },
  { label: 'Listo',         icon: '✅' },
]

function getFase(estado: string): number {
  if (estado === 'Entrada') return 0
  if (estado === 'Laboratorio') return 2
  if (['Salida de laboratorio', 'Salida', 'Entregado'].includes(estado)) return 3
  return 1
}

const ESTADO_COLORS: Record<string, string> = {
  'Entrada': '#3b82f6',
  'Laboratorio': '#f59e0b',
  'Salida de laboratorio': '#f97316',
  'Salida': '#10b981',
  'Entregado': '#6b7280',
}
function estadoColor(estado: string) {
  if (ESTADO_COLORS[estado]) return ESTADO_COLORS[estado]
  if (/técnico|tecnico/i.test(estado)) return '#8b5cf6'
  if (/salida|listo/i.test(estado)) return '#10b981'
  if (/entregado/i.test(estado)) return '#6b7280'
  return '#3b82f6'
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

type View = 'search' | 'result'

export default function SeguimientoEmbedPage() {
  const [view, setView] = useState<View>('search')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [data, setData] = useState<SeguimientoData | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Notify parent of height changes so the iframe can resize dynamically
  const notifyHeight = useCallback(() => {
    if (typeof window === 'undefined') return
    const h = document.body.scrollHeight
    window.parent?.postMessage({ type: 'microsmart-resize', height: h }, '*')
  }, [])

  useEffect(() => { notifyHeight() }, [view, data, notifyHeight])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = codigo.trim().toUpperCase()
    if (!clean) { setError('Ingresá tu código de seguimiento'); return }
    setSearching(true)
    setError('')
    try {
      const res = await fetch(`/api/seguimiento/${encodeURIComponent(clean)}`)
      if (res.status === 404) {
        setError('Código no encontrado. Verificá que esté bien escrito.')
        return
      }
      const json = await res.json()
      setData(json)
      setView('result')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  const reset = () => {
    setView('search')
    setData(null)
    setCodigo('')
    setError('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const shareWhatsApp = () => {
    if (!data) return
    const url = `${window.location.origin}/seguimiento/${data.codigoSeguimiento}`
    const text = `Hola! Podés seguir el estado de tu reparación acá:\n${url}\n\nOrden #${data.nOrden} · ${data.modeloEquipo}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const copyLink = async () => {
    if (!data) return
    const url = `${window.location.origin}/seguimiento/${data.codigoSeguimiento}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── SHARED STYLES ───────────────────────────────────────────────────────────
  const base: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#111',
    background: 'transparent',
    padding: '8px 4px 24px',
    boxSizing: 'border-box',
    width: '100%',
  }

  // ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
  if (view === 'search') {
    return (
      <div style={base}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
            border: '1.5px solid #bae6fd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>🔍</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px', color: '#111', letterSpacing: '-0.3px' }}>
            Seguí tu reparación
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Ingresá el código que recibiste al dejar tu equipo
          </p>
        </div>

        <form onSubmit={search}>
          <div style={{
            border: `2px solid ${error ? '#fca5a5' : '#e5e7eb'}`,
            borderRadius: 14, overflow: 'hidden',
            background: '#fff',
            boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.08)' : '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔐</span>
              <input
                ref={inputRef}
                value={codigo}
                onChange={e => { setCodigo(e.target.value.toUpperCase()); setError('') }}
                placeholder="Ej: MS-2024-ABC1"
                autoFocus
                autoComplete="off"
                maxLength={30}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: 18, fontWeight: 700,
                  fontFamily: 'monospace', letterSpacing: '0.08em',
                  color: '#111', background: 'transparent',
                  padding: '12px 0', minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={searching || !codigo.trim()}
                style={{
                  padding: '13px 22px', margin: '4px',
                  borderRadius: 10, fontWeight: 700, fontSize: 14,
                  background: searching || !codigo.trim() ? '#f3f4f6' : '#111',
                  border: 'none',
                  color: searching || !codigo.trim() ? '#9ca3af' : '#fff',
                  cursor: searching || !codigo.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {searching ? '⟳' : 'Consultar →'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, fontSize: 13, color: '#b91c1c',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              ⚠️ {error}
            </div>
          )}
        </form>

        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: '#f9fafb', border: '1px solid #f3f4f6',
          borderRadius: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#374151', display: 'block', marginBottom: 4 }}>¿Dónde está mi código?</strong>
          📄 En el comprobante que te dimos al dejar el equipo.<br />
          💬 También podés consultarnos directamente.
        </div>
      </div>
    )
  }

  // ─── RESULT VIEW ─────────────────────────────────────────────────────────────
  if (!data) return null

  const fase = getFase(data.estado)
  const color = estadoColor(data.estado)
  const isListo = fase === 3 && data.estado !== 'Entregado'
  const isEntregado = data.estado === 'Entregado'

  return (
    <div style={base}>

      {/* Volver */}
      <button
        onClick={reset}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#6b7280', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 0 16px', fontFamily: 'inherit',
        }}
      >
        ← Nueva consulta
      </button>

      {/* Banner listo */}
      {isListo && (
        <div style={{
          background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
          border: '1.5px solid #6ee7b7', borderRadius: 14,
          padding: '16px 18px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#065f46' }}>¡Tu equipo está listo para retirar!</div>
            <div style={{ fontSize: 13, color: '#047857', marginTop: 2 }}>Podés pasar a buscarlo cuando quieras.</div>
          </div>
        </div>
      )}

      {/* Banner entregado */}
      {isEntregado && (
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14,
          padding: '14px 18px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 26 }}>🎉</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Equipo entregado</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>Esta reparación fue completada. ¡Gracias!</div>
          </div>
        </div>
      )}

      {/* Orden + estado */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
        padding: '18px', marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Orden</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#111', letterSpacing: '-0.5px' }}>#{data.nOrden}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            {data.modeloEquipo} · Ingreso: {fmtDate(data.fecha)}
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '8px 14px', borderRadius: 999,
          background: `${color}15`, border: `1.5px solid ${color}55`,
          color, fontSize: 13, fontWeight: 800,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {data.estado}
        </div>
      </div>

      {/* Progreso */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>Progreso</div>
        <div style={{ position: 'relative' }}>
          {/* línea fondo */}
          <div style={{ position: 'absolute', top: 16, left: '12.5%', right: '12.5%', height: 3, background: '#e5e7eb', borderRadius: 2 }} />
          {/* línea progreso */}
          <div style={{
            position: 'absolute', top: 16, left: '12.5%',
            width: fase === 0 ? '0%' : fase === 1 ? '33.3%' : fase === 2 ? '66.6%' : '75%',
            height: 3, background: '#10b981', borderRadius: 2, transition: 'width 0.4s',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 8 }}>
            {FASES.map((f, i) => {
              const done = i < fase
              const current = i === fase
              return (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{
                    width: current ? 36 : 30, height: current ? 36 : 30,
                    borderRadius: '50%',
                    background: current ? '#3b82f6' : done ? '#10b981' : '#f9fafb',
                    border: `2.5px solid ${current ? '#3b82f6' : done ? '#10b981' : '#e5e7eb'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: current ? 15 : 12,
                    boxShadow: current ? '0 0 0 4px rgba(59,130,246,0.12)' : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {done ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>✓</span> : f.icon}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: current ? 800 : 500,
                    color: current ? '#3b82f6' : done ? '#374151' : '#9ca3af',
                    textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {f.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Notas públicas */}
      {data.notasPublicas.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            💬 Notas del técnico
          </div>
          {data.notasPublicas.map((n, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', marginBottom: i < data.notasPublicas.length - 1 ? 8 : 0 }}>
              <div style={{ fontSize: 13, color: '#111', lineHeight: 1.5 }}>{n.texto}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>{n.area && `${n.area} · `}{fmtDate(n.fecha)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones: compartir */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={copyLink}
          style={{
            flex: 1, minWidth: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: copied ? '#f0fdf4' : '#f9fafb',
            border: `1.5px solid ${copied ? '#86efac' : '#e5e7eb'}`,
            color: copied ? '#16a34a' : '#374151',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copiado' : '🔗 Copiar link'}
        </button>
        <button
          onClick={shareWhatsApp}
          style={{
            flex: 1, minWidth: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: '#25d366', border: 'none',
            color: '#fff', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Compartir
        </button>
      </div>
    </div>
  )
}
