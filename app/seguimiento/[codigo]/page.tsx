import Link from 'next/link'
import { getOrdenByCodigo, getEstadosOrden } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Seguimiento de orden — Microsmart' }

function formatDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function maskImei(imei: string) {
  if (!imei || imei.length < 5) return imei || '—'
  return `*****${imei.slice(-4)}`
}

function getEstadoColor(estado: string): string {
  const map: Record<string, string> = {
    'Entrada': '#3b82f6',
    'Técnico Saddi': '#8b5cf6',
    'Laboratorio': '#f59e0b',
    'Salida de laboratorio': '#f97316',
    'Salida': '#10b981',
    'Entregado': '#6b7280',
  }
  return map[estado] ?? '#6b7280'
}

function getEstadoLabel(estado: string): string {
  return estado
}

export default async function SeguimientoOrdenPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const orden = getOrdenByCodigo(codigo)

  if (!orden) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>
        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Microsmart</span>
          <Link href="/seguimiento" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
            ← Nueva consulta
          </Link>
        </header>
        <main style={{ maxWidth: 500, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔍</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 10 }}>Orden no encontrada</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>
            No encontramos ninguna orden con el código <strong style={{ color: '#111', fontFamily: 'monospace' }}>{codigo.toUpperCase()}</strong>.<br />
            Verificá que lo hayas ingresado correctamente.
          </p>
          <Link
            href="/seguimiento"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: '#111',
              color: '#fff',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Intentar de nuevo
          </Link>
        </main>
      </div>
    )
  }

  // Build public data
  const nameParts = (orden.nombreCliente ?? '').split(' ')
  const nombrePublico = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : nameParts[0] ?? '—'

  const estadoColor = getEstadoColor(orden.estado)
  const isListo = orden.estado === 'Salida' || orden.estado === 'Salida de laboratorio' || orden.estado === 'Entregado'
  const isEntregado = orden.estado === 'Entregado'

  const notasPublicas = (orden.notasLista ?? [])
    .filter(n => n.visibilidad === 'publica')

  // ── Fases públicas simplificadas (4 pasos visibles al cliente) ──────────────
  const FASES_PUBLICAS = [
    { label: 'Ingresado',    icon: '📥', desc: 'Tu equipo fue recibido' },
    { label: 'En reparación', icon: '🔧', desc: 'Nuestro técnico está trabajando en tu equipo' },
    { label: 'Laboratorio',  icon: '🔬', desc: 'Tu equipo está en el laboratorio de diagnóstico' },
    { label: 'Listo',        icon: '✅', desc: 'Tu equipo está listo para retirar' },
  ]

  function getFaseActual(estado: string): number {
    if (estado === 'Entrada') return 0
    if (estado === 'Laboratorio') return 2
    if (estado === 'Salida de laboratorio' || estado === 'Salida' || estado === 'Entregado') return 3
    // cualquier otro estado (técnicos, etapas personalizadas) → En reparación
    return 1
  }

  const faseActual = getFaseActual(orden.estado)

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Microsmart</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', display: 'none' }}>Seguimiento de reparaciones</span>
          <Link href="/seguimiento" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
            ← Nueva consulta
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px 60px' }}>
        {/* Listo banner */}
        {isListo && !isEntregado && faseActual === 3 && (
          <div style={{
            background: '#d1fae5',
            border: '1.5px solid #6ee7b7',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#065f46' }}>¡Tu equipo está listo para retirar!</div>
              <div style={{ fontSize: 13, color: '#047857', marginTop: 2 }}>Podés pasar a buscarlo cuando quieras.</div>
            </div>
          </div>
        )}

        {/* Order header */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '24px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Orden de trabajo
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: '-0.5px' }}>
                #{orden.nOrden}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Ingreso: {formatDate(orden.fecha)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: `${estadoColor}18`,
                  border: `1.5px solid ${estadoColor}55`,
                  color: estadoColor,
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor, display: 'inline-block' }} />
                {getEstadoLabel(orden.estado)}
              </div>
              {orden.prioridad === 'Urgente' && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                  marginTop: 6, fontSize: 12, fontWeight: 700, color: '#ef4444',
                }}>
                  ⚡ Urgente
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status timeline — 4 fases públicas */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '24px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
            Progreso de reparación
          </div>

          {/* Barra de progreso */}
          <div style={{ position: 'relative', marginBottom: 24 }}>
            {/* Línea de fondo */}
            <div style={{
              position: 'absolute', top: 18, left: '12.5%', right: '12.5%',
              height: 4, background: '#e5e7eb', borderRadius: 2, zIndex: 0,
            }} />
            {/* Línea de progreso */}
            <div style={{
              position: 'absolute', top: 18, left: '12.5%',
              width: faseActual === 0 ? '0%'
                : faseActual === 1 ? '33.3%'
                : faseActual === 2 ? '66.6%'
                : '75%',
              height: 4, background: '#10b981', borderRadius: 2, zIndex: 0,
              transition: 'width 0.4s ease',
            }} />
            {/* Pasos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              {FASES_PUBLICAS.map((fase, i) => {
                const isDone = i < faseActual
                const isCurrent = i === faseActual
                const dotColor = isCurrent ? '#3b82f6' : isDone ? '#10b981' : '#e5e7eb'
                const textColor = isCurrent ? '#3b82f6' : isDone ? '#374151' : '#9ca3af'
                return (
                  <div key={fase.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                    {/* Círculo */}
                    <div style={{
                      width: isCurrent ? 38 : 32,
                      height: isCurrent ? 38 : 32,
                      borderRadius: '50%',
                      background: isCurrent ? '#3b82f6' : isDone ? '#10b981' : '#f9fafb',
                      border: `3px solid ${dotColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isCurrent ? 16 : 13,
                      boxShadow: isCurrent ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {isDone
                        ? <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>
                        : <span>{fase.icon}</span>}
                    </div>
                    {/* Etiqueta */}
                    <div style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 800 : 500,
                      color: textColor,
                      textAlign: 'center',
                      lineHeight: 1.3,
                      maxWidth: 80,
                    }}>
                      {fase.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Descripción del estado actual */}
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{FASES_PUBLICAS[faseActual].icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>{FASES_PUBLICAS[faseActual].label}</div>
              <div style={{ fontSize: 12, color: '#0284c7', marginTop: 2 }}>{FASES_PUBLICAS[faseActual].desc}</div>
            </div>
          </div>
        </div>

        {/* Two info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          {/* Equipo */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            padding: '20px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              Equipo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Categoría</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{orden.categoriaDispositivo ?? 'iPhone'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Modelo</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{orden.modeloEquipo || '—'}</div>
              </div>
              {orden.imei && (
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>IMEI / Serie</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{maskImei(orden.imei)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            padding: '20px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              Cliente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Nombre</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{nombrePublico}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Tipo</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{orden.tipo}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Fecha de ingreso</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatDate(orden.fecha)}</div>
              </div>
              {orden.fechaEntrega && (
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Entrega estimada</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatDate(orden.fechaEntrega)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Public notes */}
        {notasPublicas.length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              Notas del técnico
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notasPublicas.map((nota, i) => (
                <div key={i} style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 13, color: '#111', lineHeight: 1.5, marginBottom: 6 }}>{nota.texto}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                    {nota.area && <span>{nota.area}</span>}
                    <span>{formatDateTime(nota.fecha)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracking code display */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>Tu código de seguimiento</div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.12em', color: '#111' }}>
              {orden.codigoSeguimiento}
            </div>
          </div>
          <div style={{ fontSize: 24 }}>🔐</div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
        Microsmart © 2025
      </footer>
    </div>
  )
}
