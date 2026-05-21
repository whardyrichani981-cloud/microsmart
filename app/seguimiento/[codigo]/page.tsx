'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'

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
  estadosWorkflow: string[]
  notasPublicas: { texto: string; fecha: string; area?: string }[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}
function fmtDateTime(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
function maskImei(imei: string) {
  if (!imei || imei.length < 5) return imei || '—'
  return `*****${imei.slice(-4)}`
}

const ESTADO_COLORS: Record<string, string> = {
  'Entrada': '#3b82f6',
  'Laboratorio': '#f59e0b',
  'Salida de laboratorio': '#f97316',
  'Salida': '#10b981',
  'Entregado': '#6b7280',
}
function estadoColor(estado: string) {
  // handle technician states and custom states
  if (ESTADO_COLORS[estado]) return ESTADO_COLORS[estado]
  if (estado.toLowerCase().includes('técnico') || estado.toLowerCase().includes('tecnico')) return '#8b5cf6'
  if (estado.toLowerCase().includes('salida') || estado.toLowerCase().includes('listo')) return '#10b981'
  if (estado.toLowerCase().includes('entregado')) return '#6b7280'
  return '#3b82f6'
}

const FASES = [
  { label: 'Ingresado',     icon: '📥', desc: 'Tu equipo fue recibido correctamente' },
  { label: 'En reparación', icon: '🔧', desc: 'Nuestro técnico está trabajando en tu equipo' },
  { label: 'Laboratorio',   icon: '🔬', desc: 'Tu equipo está en el laboratorio de diagnóstico' },
  { label: 'Listo',         icon: '✅', desc: '¡Tu equipo está listo para retirar!' },
]

function getFase(estado: string): number {
  if (estado === 'Entrada') return 0
  if (estado === 'Laboratorio') return 2
  if (estado === 'Salida de laboratorio' || estado === 'Salida' || estado === 'Entregado') return 3
  return 1
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SeguimientoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params)
  const [data, setData] = useState<SeguimientoData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seguimiento/${encodeURIComponent(codigo)}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); setLoading(false); return }
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch { /* network error — keep old data */ }
    finally { setLoading(false) }
  }, [codigo])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/seguimiento/${codigo}`
    : `/seguimiento/${codigo}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const shareWhatsApp = () => {
    const text = data
      ? `Hola! Podés seguir el estado de tu reparación en:\n${trackingUrl}\n\nOrden #${data.nOrden} · ${data.modeloEquipo}`
      : `Seguí tu reparación: ${trackingUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⟳</div>
          <div style={{ fontSize: 14 }}>Cargando...</div>
        </div>
      </div>
    )
  }

  // ── Not found ──
  if (notFound || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Microsmart</span>
          <Link href="/seguimiento" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>← Nueva consulta</Link>
        </header>
        <main style={{ maxWidth: 500, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔍</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 10 }}>Orden no encontrada</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>
            No encontramos ninguna orden con el código <strong style={{ color: '#111', fontFamily: 'monospace' }}>{codigo.toUpperCase()}</strong>.<br />
            Verificá que lo hayas ingresado correctamente.
          </p>
          <Link href="/seguimiento" style={{ display: 'inline-block', padding: '12px 28px', background: '#111', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
            Intentar de nuevo
          </Link>
        </main>
      </div>
    )
  }

  const fase = getFase(data.estado)
  const color = estadoColor(data.estado)
  const isListo = fase === 3 && data.estado !== 'Entregado'
  const isEntregado = data.estado === 'Entregado'

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>
      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Microsmart</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              Actualizado: {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Link href="/seguimiento" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
            ← Nueva consulta
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* ── Banner: Listo para retirar ── */}
        {isListo && (
          <div style={{
            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
            border: '1.5px solid #6ee7b7',
            borderRadius: 14, padding: '18px 22px',
            marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 32 }}>✅</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#065f46' }}>¡Tu equipo está listo para retirar!</div>
              <div style={{ fontSize: 13, color: '#047857', marginTop: 3 }}>Podés pasar a buscarlo cuando quieras. ¡Te esperamos!</div>
            </div>
          </div>
        )}

        {/* ── Banner: Entregado ── */}
        {isEntregado && (
          <div style={{
            background: '#f9fafb', border: '1.5px solid #e5e7eb',
            borderRadius: 14, padding: '16px 20px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>Equipo entregado</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Esta reparación fue completada. ¡Gracias por confiar en Microsmart!</div>
            </div>
          </div>
        )}

        {/* ── Card principal: nro de orden + estado ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '22px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Orden de trabajo
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: '-0.5px' }}>
                #{data.nOrden}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Ingreso: {fmtDate(data.fecha)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 999,
                background: `${color}15`, border: `1.5px solid ${color}55`,
                color: color, fontSize: 14, fontWeight: 800,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', animation: data.estado !== 'Entregado' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                {data.estado}
              </div>
              {data.prioridad === 'Urgente' && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚡ Urgente
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Progress timeline ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '22px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
            Progreso de reparación
          </div>

          {/* Bar */}
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <div style={{ position: 'absolute', top: 18, left: '12.5%', right: '12.5%', height: 4, background: '#e5e7eb', borderRadius: 2, zIndex: 0 }} />
            <div style={{
              position: 'absolute', top: 18, left: '12.5%',
              width: fase === 0 ? '0%' : fase === 1 ? '33.3%' : fase === 2 ? '66.6%' : '75%',
              height: 4, background: '#10b981', borderRadius: 2, zIndex: 0,
              transition: 'width 0.5s ease',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              {FASES.map((f, i) => {
                const done = i < fase
                const current = i === fase
                return (
                  <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{
                      width: current ? 40 : 32, height: current ? 40 : 32,
                      borderRadius: '50%',
                      background: current ? '#3b82f6' : done ? '#10b981' : '#f9fafb',
                      border: `3px solid ${current ? '#3b82f6' : done ? '#10b981' : '#e5e7eb'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: current ? 16 : 13,
                      boxShadow: current ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {done
                        ? <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>✓</span>
                        : f.icon}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: current ? 800 : 500, color: current ? '#3b82f6' : done ? '#374151' : '#9ca3af', textAlign: 'center', lineHeight: 1.3, maxWidth: 70 }}>
                      {f.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Estado actual desc */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{FASES[fase].icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>{FASES[fase].label}</div>
              <div style={{ fontSize: 12, color: '#0284c7', marginTop: 2 }}>{FASES[fase].desc}</div>
            </div>
          </div>
        </div>

        {/* ── Info cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 }}>
          {/* Equipo */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Equipo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label="Modelo" value={data.modeloEquipo || '—'} large />
              <InfoRow label="Categoría" value={data.categoriaDispositivo ?? 'iPhone'} />
              {data.fechaEntrega && <InfoRow label="Entrega estimada" value={fmtDate(data.fechaEntrega)} />}
            </div>
          </div>

          {/* Cliente */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Cliente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label="Nombre" value={data.nombrePublico} large />
              <InfoRow label="Ingreso" value={fmtDate(data.fecha)} />
              <InfoRow label="Tipo" value={data.tipo} />
            </div>
          </div>
        </div>

        {/* ── Notas públicas ── */}
        {data.notasPublicas.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              💬 Notas del técnico
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.notasPublicas.map((nota, i) => (
                <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, color: '#111', lineHeight: 1.55, marginBottom: 6 }}>{nota.texto}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                    {nota.area && <span>{nota.area}</span>}
                    <span>{fmtDateTime(nota.fecha)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Código + Acciones ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>Tu código de seguimiento</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.12em', color: '#111' }}>
                {data.codigoSeguimiento}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Copiar link */}
              <button
                onClick={copyLink}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: copied ? '#f0fdf4' : '#f9fafb',
                  border: `1.5px solid ${copied ? '#86efac' : '#e5e7eb'}`,
                  color: copied ? '#16a34a' : '#374151',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ Copiado' : '🔗 Copiar link'}
              </button>
              {/* Compartir WhatsApp */}
              <button
                onClick={shareWhatsApp}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: '#25d366', border: 'none',
                  color: '#fff', cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Compartir
              </button>
            </div>
          </div>
        </div>

        {/* Auto-refresh hint */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          Esta página se actualiza automáticamente cada 60 segundos
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '20px 24px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
        Microsmart · Reparaciones Apple
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

function InfoRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: large ? 16 : 13, fontWeight: large ? 800 : 600, color: '#111' }}>{value}</div>
    </div>
  )
}
