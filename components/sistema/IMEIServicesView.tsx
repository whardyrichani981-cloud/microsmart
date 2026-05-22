'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DHRUService {
  service: string
  name: string
  type?: string
  rate?: string
  min?: string
  max?: string
  dripfeed?: boolean
  refill?: boolean
  cancel?: boolean
  category?: string
  // A veces la respuesta trae otros campos
  [key: string]: unknown
}

interface Order {
  id: string
  imei: string
  service: string
  serviceName: string
  status: string
  createdAt: string
  result?: unknown
}

// ─── Keywords Apple para filtrar ──────────────────────────────────────────────
const APPLE_KEYWORDS = [
  'iphone', 'ipad', 'apple', 'ios', 'fmi', 'find my', 'icloud', 'mdm',
  'activation lock', 'bypass', 'carrier unlock', 'at&t', 't-mobile',
  'verizon', 'sprint', 'cricket', 'imei', 'gsm'
]

function isAppleService(s: DHRUService): boolean {
  const text = (s.name + ' ' + (s.category ?? '') + ' ' + (s.type ?? '')).toLowerCase()
  return APPLE_KEYWORDS.some(k => text.includes(k))
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#6b7280',
  error: '#ef4444',
  partial: '#f97316',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status?.toLowerCase()] ?? '#6b7280'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
      background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'capitalize',
    }}>
      {status || 'Desconocido'}
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function IMEIServicesView() {
  const [services, setServices] = useState<DHRUService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [servicesError, setServicesError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [showAll, setShowAll] = useState(false)

  const [selectedService, setSelectedService] = useState<DHRUService | null>(null)
  const [imei, setImei] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [orders, setOrders] = useState<Order[]>([])
  const [checkingOrder, setCheckingOrder] = useState<string | null>(null)

  // ── Cargar servicios ──────────────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    setLoadingServices(true)
    setServicesError(null)
    try {
      const res = await fetch('/api/imei/services')
      const data = await res.json() as { ok?: boolean; services?: unknown; error?: string }
      if (!res.ok || data.error) {
        setServicesError(data.error ?? 'Error al cargar servicios')
      } else {
        const list = Array.isArray(data.services)
          ? (data.services as DHRUService[])
          : []
        setServices(list)
      }
    } catch (e) {
      setServicesError(String(e))
    } finally {
      setLoadingServices(false)
    }
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  // ── Filtrar servicios ─────────────────────────────────────────────────────
  const displayed = services.filter(s => {
    const passApple = showAll ? true : isAppleService(s)
    const passText = filterText.trim()
      ? (s.name + ' ' + (s.category ?? '')).toLowerCase().includes(filterText.toLowerCase())
      : true
    return passApple && passText
  })

  // ── Enviar orden ──────────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (!selectedService || !imei.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/imei/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: selectedService.service, imei: imei.trim() }),
      })
      const data = await res.json() as { ok?: boolean; result?: { order?: string; [k: string]: unknown }; error?: string }

      if (!res.ok || data.error) {
        setSubmitError(data.error ?? 'Error al enviar orden')
      } else {
        const orderId = String((data.result as Record<string, unknown>)?.order ?? Date.now())
        const newOrder: Order = {
          id: orderId,
          imei: imei.trim(),
          service: selectedService.service,
          serviceName: selectedService.name,
          status: 'pending',
          createdAt: new Date().toLocaleString('es-AR'),
        }
        setOrders(prev => [newOrder, ...prev])
        setImei('')
        setSelectedService(null)
      }
    } catch (e) {
      setSubmitError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Verificar estado de orden ─────────────────────────────────────────────
  const checkStatus = async (orderId: string) => {
    setCheckingOrder(orderId)
    try {
      const res = await fetch(`/api/imei/status?order=${orderId}`)
      const data = await res.json() as { ok?: boolean; result?: { status?: string; [k: string]: unknown }; error?: string }
      if (res.ok && data.ok) {
        const status = String((data.result as Record<string, unknown>)?.status ?? 'unknown')
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status, result: data.result } : o
        ))
      }
    } catch { /* silencioso */ }
    setCheckingOrder(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          📱 Servicios IMEI
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
          Envío de servicios IMEI vía team-saul.com — los pedidos se procesan desde tu cuenta.
        </p>
      </div>

      {/* ── Panel de envío de orden ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface2)', borderRadius: 14,
        border: '1px solid var(--border)', padding: '20px 22px', marginBottom: 28,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
          Nueva orden
        </div>

        {/* Servicio seleccionado */}
        {selectedService ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                Servicio #{selectedService.service}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
                {selectedService.name}
              </div>
              {selectedService.rate && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Precio: ${selectedService.rate}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedService(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', fontSize: 18, lineHeight: 1,
              }}
            >×</button>
          </div>
        ) : (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: 'var(--surface)', border: '1px dashed var(--border)',
            fontSize: 13, color: 'var(--text-dim)',
          }}>
            ↓ Seleccioná un servicio de la lista de abajo
          </div>
        )}

        {/* IMEI input */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
              IMEI del dispositivo
            </label>
            <input
              type="text"
              value={imei}
              onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="353123456789012"
              maxLength={16}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', borderRadius: 8, fontSize: 14,
                background: 'var(--surface)', border: '1px solid var(--border-light)',
                color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '0.05em',
              }}
            />
          </div>
          <button
            onClick={submitOrder}
            disabled={!selectedService || imei.length < 14 || submitting}
            style={{
              padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
              background: selectedService && imei.length >= 14 && !submitting
                ? 'var(--accent)' : 'var(--surface)',
              color: selectedService && imei.length >= 14 && !submitting
                ? '#fff' : 'var(--text-dim)',
              border: 'none', cursor: selectedService && imei.length >= 14 && !submitting
                ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {submitting ? (
              <>
                <span style={{
                  width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Enviando...
              </>
            ) : '🚀 Enviar orden'}
          </button>
        </div>

        {submitError && (
          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 8,
            background: '#fee2e2', border: '1px solid #fca5a5',
            color: '#991b1b', fontSize: 12,
          }}>
            ⚠️ {submitError}
          </div>
        )}
      </div>

      {/* ── Órdenes enviadas ──────────────────────────────────────────────── */}
      {orders.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            📋 Órdenes enviadas esta sesión
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(order => (
              <div key={order.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
                      #{order.id}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
                    {order.serviceName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'monospace' }}>
                    IMEI: {order.imei} &nbsp;·&nbsp; {order.createdAt}
                  </div>
                </div>
                <button
                  onClick={() => checkStatus(order.id)}
                  disabled={checkingOrder === order.id}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--surface)', border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {checkingOrder === order.id ? '...' : '🔄 Verificar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista de servicios ────────────────────────────────────────────── */}
      <div>
        {/* Barra de filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-dim)', fontSize: 14, pointerEvents: 'none',
            }}>🔍</span>
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Buscar servicio..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13,
                background: 'var(--surface2)', border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: showAll ? 'var(--surface2)' : 'var(--accent-dim)',
              border: `1px solid ${showAll ? 'var(--border-light)' : 'var(--accent)'}`,
              color: showAll ? 'var(--text-secondary)' : 'var(--accent)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {showAll ? '🍎 Solo Apple' : '🌐 Ver todos'}
          </button>
          <button
            onClick={loadServices}
            disabled={loadingServices}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12,
              background: 'var(--surface2)', border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {loadingServices ? '...' : '↺'}
          </button>
        </div>

        {/* Error de carga */}
        {servicesError && (
          <div style={{
            padding: '14px 18px', borderRadius: 10, marginBottom: 16,
            background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Error al cargar servicios</div>
            <div>{servicesError}</div>
            {servicesError.includes('API key') && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff5', borderRadius: 6 }}>
                <strong>¿Cómo configurar?</strong> Obtené tu API Key en team-saul.com →{' '}
                <em>Panel → Configuración → API</em> y agrega{' '}
                <code style={{ fontFamily: 'monospace', fontSize: 12 }}>TEAM_SAUL_API_KEY=tu_key</code>{' '}
                en el archivo <code style={{ fontFamily: 'monospace', fontSize: 12 }}>.env.local</code>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingServices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                height: 56, borderRadius: 10,
                background: 'var(--surface2)', opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {/* Contador */}
        {!loadingServices && services.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            Mostrando {displayed.length} de {services.length} servicios{!showAll ? ' (filtrado Apple/iPhone)' : ''}
          </div>
        )}

        {/* Lista de servicios */}
        {!loadingServices && displayed.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 480, overflowY: 'auto',
            borderRadius: 10, border: '1px solid var(--border)',
          }}>
            {displayed.map((s, i) => (
              <button
                key={s.service + i}
                onClick={() => setSelectedService(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', border: 'none', textAlign: 'left',
                  background: selectedService?.service === s.service
                    ? 'var(--accent-dim)' : i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  cursor: 'pointer',
                  borderLeft: selectedService?.service === s.service
                    ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{
                  width: 42, height: 22, borderRadius: 4, flexShrink: 0,
                  background: 'var(--surface2)', border: '1px solid var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                }}>
                  #{s.service}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: selectedService?.service === s.service ? 'var(--accent)' : 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {s.name}
                  </div>
                  {s.category && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
                      {s.category}
                    </div>
                  )}
                </div>
                {s.rate && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    ${s.rate}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {!loadingServices && !servicesError && services.length > 0 && displayed.length === 0 && (
          <div style={{
            padding: '32px', textAlign: 'center',
            color: 'var(--text-dim)', fontSize: 14,
          }}>
            No se encontraron servicios con ese filtro.
          </div>
        )}

        {/* Sin servicios */}
        {!loadingServices && !servicesError && services.length === 0 && (
          <div style={{
            padding: '40px', textAlign: 'center',
            color: 'var(--text-dim)', fontSize: 14,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
            <div>Configurá el <strong>TEAM_SAUL_API_KEY</strong> para ver los servicios disponibles.</div>
          </div>
        )}
      </div>
    </div>
  )
}
