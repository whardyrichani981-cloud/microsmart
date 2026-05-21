'use client'
import { useState, useEffect, useCallback } from 'react'
import { fmtARS, C } from './shared'
import type { CuentaCorrienteItem, MetodoPago } from '@/lib/sistema-types'

const COLOR = '#f97316'

type BalanceRow = {
  clienteId?: string
  clienteNombre: string
  clienteTipo: string
  clienteTelefono?: string
  saldoPendiente: number
  cargosCount: number
  ultimaActividad: string
}

function fmtDate(iso: string) {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}
function fmtDateTime(iso: string) {
  try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

// ── Panel de detalle de un cliente ────────────────────────────────────────────
function ClienteDetalle({
  cliente, onBack, onRefresh,
}: { cliente: BalanceRow; onBack: () => void; onRefresh: () => void }) {
  const [items, setItems] = useState<CuentaCorrienteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagoModal, setPagoModal] = useState<CuentaCorrienteItem | null>(null)
  const [montoPago, setMontoPago] = useState(0)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [pagando, setPagando] = useState(false)
  const [cancelModal, setCancelModal] = useState<CuentaCorrienteItem | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    const param = cliente.clienteId
      ? `clienteId=${encodeURIComponent(cliente.clienteId)}`
      : `clienteNombre=${encodeURIComponent(cliente.clienteNombre)}`
    fetch(`/api/sistema/cuenta-corriente?${param}`)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cliente.clienteId, cliente.clienteNombre])

  useEffect(() => { load() }, [load])

  const cargos = items.filter(i => i.tipo === 'cargo').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const pagos  = items.filter(i => i.tipo === 'pago').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const saldoTotal = cargos.filter(c => c.estado !== 'cancelado').reduce((s, c) => s + c.saldoPendiente, 0)

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const abrirPago = (cargo: CuentaCorrienteItem) => {
    setMontoPago(cargo.saldoPendiente)
    setMetodoPago('Efectivo')
    setPagoModal(cargo)
  }

  const confirmarPago = async () => {
    if (!pagoModal || montoPago <= 0) return
    setPagando(true)
    try {
      const res = await fetch('/api/sistema/cuenta-corriente', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pagoModal.id, montoPago, metodoPago }),
      })
      if (!res.ok) throw new Error('Error al registrar pago')
      setPagoModal(null)
      load()
      onRefresh()
    } catch (e) { alert(String(e)) }
    finally { setPagando(false) }
  }

  const cancelarCargo = async (cargo: CuentaCorrienteItem) => {
    await fetch('/api/sistema/cuenta-corriente', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cargo.id, estado: 'cancelado', saldoPendiente: 0 }),
    })
    setCancelModal(null)
    load()
    onRefresh()
  }

  const estadoBadge = (c: CuentaCorrienteItem) => {
    const cfg = {
      pendiente: { label: 'Pendiente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
      parcial:   { label: 'Parcial',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
      pagado:    { label: 'Pagado',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
      cancelado: { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
    }[c.estado] ?? { label: c.estado, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
        {cfg.label}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
          ← Volver
        </button>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {cliente.clienteTipo === 'empresa' ? '🏢' : '👤'}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{cliente.clienteNombre}</div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {cliente.clienteTipo === 'empresa' ? 'Empresa / Gremio' : 'Cliente final'}
            {cliente.clienteTelefono && ` · ${cliente.clienteTelefono}`}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>SALDO PENDIENTE</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: saldoTotal > 0 ? '#f97316' : '#4ade80' }}>
            {fmtARS(saldoTotal)}
          </div>
        </div>
      </div>

      {/* Órdenes de servicio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Órdenes de servicio</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{cargos.length} cargo{cargos.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.muted, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>Cargando…</div>
        ) : cargos.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.muted, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>Sin cargos</div>
        ) : (
          cargos.map(c => {
            const s = c.snapshotOrden
            const expanded = expandedIds.has(c.id)
            const pendiente = c.saldoPendiente > 0 && c.estado !== 'cancelado'
            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--surface)', border: `1px solid ${pendiente ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: pendiente ? '0 0 0 1px rgba(249,115,22,0.1)' : 'none',
                }}
              >
                {/* Cabecera de la tarjeta — siempre visible */}
                <div
                  onClick={() => toggleExpand(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', cursor: 'pointer',
                    background: expanded ? 'rgba(249,115,22,0.04)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  {/* Ícono de la orden */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: pendiente ? 'rgba(249,115,22,0.12)' : 'rgba(74,222,128,0.10)',
                    border: `1px solid ${pendiente ? 'rgba(249,115,22,0.3)' : 'rgba(74,222,128,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  }}>
                    📱
                  </div>

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {c.referenciaNum && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: COLOR, background: 'rgba(249,115,22,0.12)', padding: '1px 8px', borderRadius: 6 }}>
                          Orden #{c.referenciaNum}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {s?.modeloEquipo ?? c.concepto}
                      </span>
                      {s?.tipoServicio && (
                        <span style={{ fontSize: 11, color: C.muted, background: 'var(--surface2)', padding: '1px 7px', borderRadius: 5 }}>
                          {s.tipoServicio}
                        </span>
                      )}
                      {estadoBadge(c)}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>📅 {fmtDate(c.fecha)}</span>
                      {s?.tecnico && <span style={{ fontSize: 11, color: C.muted }}>🔧 {s.tecnico}</span>}
                      {s?.descripcionFalla && (
                        <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          "{s.descripcionFalla.trim()}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Montos */}
                  <div style={{ display: 'flex', gap: 20, flexShrink: 0, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>Saldo</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: pendiente ? '#f97316' : '#4ade80' }}>
                        {fmtARS(c.saldoPendiente)}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: C.muted, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
                  </div>
                </div>

                {/* Panel expandido — detalles de la orden */}
                {expanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Detalles de la orden de servicio */}
                    {s && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {[
                          { label: 'Equipo',        value: s.modeloEquipo,    icon: '📱' },
                          { label: 'Tipo servicio',  value: s.tipoServicio,    icon: '🔧' },
                          { label: 'Tipo cliente',   value: s.tipo,            icon: '👤' },
                          { label: 'Técnico',        value: s.tecnico,         icon: '👨‍🔧' },
                          s.proveedor   ? { label: 'Proveedor',    value: s.proveedor,    icon: '🏪' } : null,
                          s.tipoRepuesto ? { label: 'Repuesto',    value: s.tipoRepuesto, icon: '🔩' } : null,
                          s.costoRepuestos > 0 ? { label: 'Costo repuestos', value: fmtARS(s.costoRepuestos), icon: '💰' } : null,
                          s.comisionTecnico > 0 ? { label: 'Comisión técnico', value: fmtARS(s.comisionTecnico), icon: '💵' } : null,
                          s.comisionVendedora > 0 ? { label: 'Comisión vendedora', value: fmtARS(s.comisionVendedora), icon: '💵' } : null,
                        ].filter(Boolean).map((item, idx) => item && (
                          <div key={idx} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.icon} {item.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Descripción de falla */}
                    {s?.descripcionFalla?.trim() && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Descripción de falla</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{s.descripcionFalla}</div>
                      </div>
                    )}

                    {/* Notas */}
                    {s?.notas?.trim() && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)' }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notas</div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{s.notas}</div>
                      </div>
                    )}

                    {/* Resumen de montos */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--row-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700 }}>TOTAL ORIGINAL</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtARS(c.monto)}</div>
                      </div>
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700 }}>PAGADO</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#4ade80' }}>{fmtARS(c.montoPagado)}</div>
                      </div>
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: pendiente ? 'rgba(249,115,22,0.08)' : 'rgba(74,222,128,0.06)', border: `1px solid ${pendiente ? 'rgba(249,115,22,0.25)' : 'rgba(74,222,128,0.2)'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 700 }}>SALDO</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: pendiente ? '#f97316' : '#4ade80' }}>{fmtARS(c.saldoPendiente)}</div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {c.saldoPendiente > 0 && c.estado !== 'cancelado' && (
                        <button
                          onClick={() => abrirPago(c)}
                          style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          💰 Cobrar {fmtARS(c.saldoPendiente)}
                        </button>
                      )}
                      {c.estado !== 'cancelado' && c.estado !== 'pagado' && (
                        <button
                          onClick={() => setCancelModal(c)}
                          style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancelar deuda
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Historial de pagos */}
      {pagos.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>💳</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Historial de pagos</span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</span>
          </div>
          {pagos.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 18px', gap: 12,
              background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
              borderBottom: i < pagos.length - 1 ? '1px solid var(--row-border)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.concepto}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{fmtDateTime(p.createdAt)}</div>
              </div>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#4ade80' }}>+{fmtARS(p.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal pago */}
      {pagoModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={() => !pagando && setPagoModal(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 380, borderRadius: 16,
            background: 'var(--surface)', border: `1px solid ${COLOR}44`,
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          }}>
            <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--row-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>💰</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Registrar cobro</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{pagoModal.concepto}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Saldo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <span style={{ fontSize: 12, color: C.muted }}>Saldo pendiente</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#f97316' }}>{fmtARS(pagoModal.saldoPendiente)}</span>
              </div>
              {/* Monto */}
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Monto a cobrar</label>
                <input
                  type="number"
                  value={montoPago}
                  onChange={e => setMontoPago(Number(e.target.value))}
                  max={pagoModal.saldoPendiente}
                  min={1}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
                {montoPago < pagoModal.saldoPendiente && montoPago > 0 && (
                  <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>
                    Pago parcial · Quedará pendiente {fmtARS(pagoModal.saldoPendiente - montoPago)}
                  </div>
                )}
              </div>
              {/* Método */}
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Método de pago</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito'] as MetodoPago[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${metodoPago === m ? '#4ade80' : 'var(--border)'}`,
                        background: metodoPago === m ? 'rgba(74,222,128,0.15)' : 'var(--hover-bg)',
                        color: metodoPago === m ? '#4ade80' : 'var(--text-secondary)',
                      }}
                    >{m}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', fontSize: 11, color: '#4ade80' }}>
                ✓ Se generará una VentaCaja por {fmtARS(montoPago)} y quedará registrado en la caja del día
              </div>
            </div>
            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
              <button onClick={() => setPagoModal(null)} disabled={pagando} style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: C.muted, fontSize: 13, fontWeight: 600 }}>
                Cancelar
              </button>
              <button
                onClick={confirmarPago}
                disabled={pagando || montoPago <= 0 || montoPago > pagoModal.saldoPendiente}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: (pagando || montoPago <= 0) ? 0.6 : 1,
                }}
              >
                {pagando
                  ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Registrando...</>
                  : `💰 Cobrar ${fmtARS(montoPago)}`
                }
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal cancelar cargo */}
      {cancelModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={() => setCancelModal(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 340, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)', padding: '24px 22px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Cancelar cargo</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
              ¿Cancelar la deuda de <strong>{fmtARS(cancelModal.saldoPendiente)}</strong> de <strong>{cancelModal.concepto}</strong>? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => cancelarCargo(cancelModal)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Sí, cancelar deuda</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────────
export default function CuentaCorrienteView() {
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<BalanceRow | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/sistema/cuenta-corriente?balances=1')
      .then(r => r.json())
      .then(d => setBalances(d.balances ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = balances.filter(b =>
    b.clienteNombre.toLowerCase().includes(search.toLowerCase())
  )
  const totalDeuda = balances.reduce((s, b) => s + b.saldoPendiente, 0)
  const clientesConDeuda = balances.length

  if (clienteSeleccionado) {
    return (
      <ClienteDetalle
        cliente={clienteSeleccionado}
        onBack={() => { setClienteSeleccionado(null); load() }}
        onRefresh={load}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Cuenta Corriente</div>
            <div style={{ fontSize: 12, color: C.muted }}>Deudas pendientes por cliente</div>
          </div>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>DEUDA TOTAL</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: COLOR }}>{fmtARS(totalDeuda)}</div>
          <div style={{ fontSize: 12, color: C.muted }}>pendiente de cobro</div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>CLIENTES CON DEUDA</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fbbf24' }}>{clientesConDeuda}</div>
          <div style={{ fontSize: 12, color: C.muted }}>con saldo pendiente</div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>PROMEDIO POR CLIENTE</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#4ade80' }}>{fmtARS(clientesConDeuda > 0 ? totalDeuda / clientesConDeuda : 0)}</div>
          <div style={{ fontSize: 12, color: C.muted }}>deuda promedio</div>
        </div>
      </div>

      {/* Buscador */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Buscar cliente…"
        style={{
          padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
        }}
      />

      {/* Lista de clientes */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search ? 'Sin resultados' : 'Sin deudas pendientes'}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {search ? 'Probá con otro nombre' : 'Todos los clientes están al día'}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px auto',
            padding: '9px 18px', background: 'var(--surface2)',
            fontSize: 11, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Cliente</span>
            <span>Tipo</span>
            <span style={{ textAlign: 'right' }}>Órdenes</span>
            <span style={{ textAlign: 'right' }}>Saldo</span>
            <span />
          </div>
          {filtered.map((b, i) => (
            <div
              key={b.clienteId ?? b.clienteNombre}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px auto',
                padding: '13px 18px', alignItems: 'center', gap: 12,
                background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--row-border)' : 'none',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
              onClick={() => setClienteSeleccionado(b)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(249,115,22,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)')}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {b.clienteTipo === 'empresa' ? '🏢' : '👤'} {b.clienteNombre}
                </div>
                {b.clienteTelefono && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{b.clienteTelefono}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {b.clienteTipo === 'empresa' ? 'Empresa' : 'Persona'}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: C.muted }}>
                {b.cargosCount} {b.cargosCount === 1 ? 'orden' : 'órdenes'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: 'monospace', fontWeight: 800, fontSize: 15,
                  color: '#f97316',
                }}>
                  {fmtARS(b.saldoPendiente)}
                </span>
              </div>
              <div>
                <button
                  onClick={e => { e.stopPropagation(); setClienteSeleccionado(b) }}
                  style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${COLOR}`, background: 'transparent', color: COLOR, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Ver →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
