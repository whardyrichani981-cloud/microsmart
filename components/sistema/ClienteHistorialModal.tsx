'use client'

import { useState, useEffect } from 'react'
import type { Orden } from '@/lib/sistema-types'
import { C } from './shared'

const ESTADO_COLOR: Record<string, string> = {
  'Entrada': '#60a5fa',
  'Técnico Saddi': '#a78bfa',
  'Laboratorio': '#f472b6',
  'Salida de laboratorio': '#fb923c',
  'Salida': '#4ade80',
  'Entregado': '#8A8A8A',
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '—' }
}

function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

interface Props {
  nombreCliente: string
  telefonoCliente?: string
  onClose: () => void
}

export default function ClienteHistorialModal({ nombreCliente, telefonoCliente, onClose }: Props) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sistema/ordenes')
      .then(r => r.json())
      .then((data: { items?: Orden[] } | Orden[]) => {
        const list: Orden[] = Array.isArray(data) ? data : (data.items ?? [])
        // Match por nombre (case-insensitive) o teléfono
        const nombre = nombreCliente.toLowerCase().trim()
        const tel = telefonoCliente?.replace(/\D/g, '') ?? ''
        const matches = list.filter(o => {
          const matchNombre = o.nombreCliente.toLowerCase().trim() === nombre
          const matchTel = tel && o.telefonoCliente?.replace(/\D/g, '') === tel
          return matchNombre || matchTel
        })
        // Más reciente primero
        matches.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        setOrdenes(matches)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [nombreCliente, telefonoCliente])

  const totalGastado = ordenes
    .filter(o => o.estado === 'Entregado')
    .reduce((s, o) => s + (o.montoCobrado ?? 0), 0)

  const entregadas = ordenes.filter(o => o.estado === 'Entregado').length
  const activas = ordenes.filter(o => o.estado !== 'Entregado').length

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel lateral derecho */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 520, zIndex: 801,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #0066CC, #0A84FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff',
            }}>
              {nombreCliente.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                {nombreCliente}
              </div>
              {telefonoCliente && (
                <div style={{ fontSize: 12, color: C.muted }}>📞 {telefonoCliente}</div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* KPIs rápidos */}
          {!loading && ordenes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
              {[
                { label: 'Órdenes', value: String(ordenes.length), color: '#60a5fa' },
                { label: 'Entregadas', value: String(entregadas), color: '#4ade80' },
                { label: 'En proceso', value: String(activas), color: '#fb923c' },
              ].map(k => (
                <div key={k.label} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: `${k.color}12`, border: `1px solid ${k.color}30`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginTop: 1 }}>{k.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          )}
          {!loading && totalGastado > 0 && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>TOTAL HISTÓRICO (entregadas)</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#4ade80' }}>{fmtARS(totalGastado)}</span>
            </div>
          )}
        </div>

        {/* Lista de órdenes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted, fontSize: 14 }}>
              Cargando historial…
            </div>
          )}

          {!loading && ordenes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Sin órdenes anteriores
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                Este cliente todavía no tiene órdenes registradas en el sistema.
              </div>
            </div>
          )}

          {!loading && ordenes.map((o, i) => {
            const color = ESTADO_COLOR[o.estado] ?? '#8A8A8A'
            const monto = o.montoCobrado ?? 0
            const isFirst = i === 0
            return (
              <div key={o.id} style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `1px solid ${isFirst ? color + '40' : 'var(--border)'}`,
                background: isFirst ? `${color}08` : 'var(--surface2)',
                marginBottom: 8,
                position: 'relative',
              }}>
                {isFirst && (
                  <div style={{
                    position: 'absolute', top: 10, right: 12,
                    fontSize: 9, fontWeight: 700, color: color,
                    background: `${color}18`, padding: '2px 8px', borderRadius: 20,
                    letterSpacing: '0.06em',
                  }}>MÁS RECIENTE</div>
                )}

                {/* Fila 1: N° orden + estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>
                    #{String(o.nOrden).padStart(4, '0')}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                    background: `${color}18`, color,
                  }}>{o.estado}</span>
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
                    {fmtDate(o.fecha)}
                  </span>
                </div>

                {/* Fila 2: Modelo + servicio */}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {o.modeloEquipo || '—'}
                </div>
                {o.tipoServicio && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    🔧 {o.tipoServicio}
                  </div>
                )}
                {o.descripcionFalla && (
                  <div style={{
                    fontSize: 11, color: C.muted, lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {o.descripcionFalla}
                  </div>
                )}

                {/* Fila 3: Monto */}
                {monto > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>
                      {fmtARS(monto)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
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
