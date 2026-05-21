'use client'
import { useState, useEffect, useCallback } from 'react'
import type { MPMovimiento } from '@/lib/sistema-types'

const COLOR = '#00bcff'   // MP blue
const COLOR2 = '#009ee3'

interface MPCuentaUI {
  id: string
  nombre: string
  accessToken: string  // masked
  createdAt: string
}

const TIPO_BADGE: Record<MPMovimiento['tipo'], { label: string; color: string; bg: string }> = {
  transferencia:   { label: 'Transferencia', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  tarjeta_credito: { label: 'Tarjeta Crédito', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  tarjeta_debito:  { label: 'Tarjeta Débito',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  qr:              { label: 'QR',               color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  otro:            { label: 'Otro',             color: '#8A8A8A', bg: 'rgba(255,255,255,0.06)' },
}

function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ── Add account modal ─────────────────────────────────────────────────────────
function AddCuentaModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [nombre, setNombre]       = useState('')
  const [token, setToken]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showToken, setShowToken] = useState(false)

  const save = async () => {
    if (!nombre.trim() || !token.trim()) { setError('Completá todos los campos'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/sistema/mercadopago/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), accessToken: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al agregar cuenta'); return }
      onAdded()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: 460, maxWidth: '92vw', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3' }}>➕ Agregar cuenta MercadoPago</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        {/* Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8A8A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Nombre de la cuenta *
            </label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cuenta principal, Rony, Local..."
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#E5E5E3', fontSize: 14, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8A8A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Access Token de Producción *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={token} onChange={e => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="APP_USR-..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 40px 10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#E5E5E3', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
              />
              <button onClick={() => setShowToken(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 14 }}>
                {showToken ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#484848', lineHeight: 1.6 }}>
              Obtenelo en{' '}
              <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noopener noreferrer" style={{ color: COLOR, textDecoration: 'none' }}>
                MP Developers → Tu aplicación → Credenciales de Producción
              </a>
              . Usá el token que empieza con <code style={{ color: '#a78bfa' }}>APP_USR-</code>
            </div>
          </div>
          {error && <div style={{ fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444440', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>
        {/* Footer */}
        <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#8A8A8A', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
          <button onClick={save} disabled={saving || !nombre.trim() || !token.trim()}
            style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: saving || !nombre.trim() || !token.trim() ? '#333' : COLOR, color: saving || !nombre.trim() || !token.trim() ? '#555' : '#000', fontSize: 13, fontWeight: 700, cursor: saving || !nombre.trim() || !token.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
            {saving ? '⏳ Verificando...' : '✓ Agregar cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function MercadoPagoView() {
  const [cuentas, setCuentas]         = useState<MPCuentaUI[]>([])
  const [activeCuenta, setActive]     = useState<string | null>(null)
  const [showAdd, setShowAdd]         = useState(false)

  // Filters
  const [tipoFiltro, setTipoFiltro]   = useState<'all' | 'transferencia' | 'tarjeta'>('all')
  const [desde, setDesde]             = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [hasta, setHasta]             = useState(() => new Date().toISOString().slice(0, 10))

  // Movements
  const [movimientos, setMovimientos] = useState<MPMovimiento[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Deleting
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const loadCuentas = useCallback(async () => {
    const res = await fetch('/api/sistema/mercadopago/cuentas', { cache: 'no-store' })
    if (res.ok) {
      const data: MPCuentaUI[] = await res.json()
      setCuentas(data)
      if (data.length && !activeCuenta) setActive(data[0].id)
    }
  }, [activeCuenta])

  useEffect(() => { loadCuentas() }, [loadCuentas])

  const loadMovimientos = useCallback(async (cuentaId: string) => {
    setLoading(true); setError(''); setMovimientos([]); setPage(1)
    try {
      const params = new URLSearchParams({ cuentaId, desde, hasta })
      if (tipoFiltro !== 'all') params.set('tipo', tipoFiltro)
      const res = await fetch(`/api/sistema/mercadopago/movimientos?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al cargar movimientos'); return }
      setMovimientos(data.movimientos ?? [])
      setLastUpdate(new Date())
    } catch (e) {
      setError(`Error de red: ${String(e)}`)
    } finally { setLoading(false) }
  }, [desde, hasta, tipoFiltro])

  // Auto-load when active account changes
  useEffect(() => {
    if (activeCuenta) loadMovimientos(activeCuenta)
  }, [activeCuenta, loadMovimientos])

  const deleteCuenta = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta de MercadoPago?')) return
    setDeletingId(id)
    await fetch('/api/sistema/mercadopago/cuentas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setDeletingId(null)
    if (activeCuenta === id) setActive(null)
    await loadCuentas()
  }

  // Totals
  const totalBruto = movimientos.reduce((s, m) => s + m.monto, 0)
  const totalNeto  = movimientos.reduce((s, m) => s + m.montoNeto, 0)
  const comision   = totalBruto - totalNeto

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}18`, border: `1.5px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E5E5E3', margin: 0 }}>MercadoPago</h2>
          </div>
          <div style={{ fontSize: 13, color: '#8A8A8A', marginLeft: 46 }}>
            Pagos y transferencias recibidas
            {lastUpdate && <span style={{ marginLeft: 8, color: '#484848' }}>· actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: `1px solid ${COLOR}50`, background: `${COLOR}10`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = `${COLOR}1e` }}
          onMouseLeave={e => { e.currentTarget.style.background = `${COLOR}10` }}>
          ＋ Agregar cuenta
        </button>
      </div>

      {/* ── Account tabs ───────────────────────────────────────────────────── */}
      {cuentas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#676767' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#E5E5E3', marginBottom: 8 }}>No hay cuentas configuradas</div>
          <div style={{ fontSize: 13, marginBottom: 24, color: '#8A8A8A', maxWidth: 360, margin: '0 auto 24px' }}>
            Agregá tu cuenta de MercadoPago para ver las transferencias y pagos recibidos.
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: COLOR, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ＋ Agregar primera cuenta
          </button>
        </div>
      ) : (
        <>
          {/* Tabs bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
            {cuentas.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: -1 }}>
                <button
                  onClick={() => setActive(c.id)}
                  style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeCuenta === c.id ? 700 : 500, color: activeCuenta === c.id ? COLOR : '#8A8A8A', borderBottom: activeCuenta === c.id ? `2px solid ${COLOR}` : '2px solid transparent', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  💳 {c.nombre}
                </button>
                <button onClick={() => deleteCuenta(c.id)} disabled={deletingId === c.id}
                  style={{ marginBottom: activeCuenta === c.id ? 2 : 0, width: 18, height: 18, borderRadius: '50%', border: '1px solid transparent', background: 'transparent', color: '#484848', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484848' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── Filters bar ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Type filter */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {([
                { id: 'all' as const,           label: 'Todos' },
                { id: 'transferencia' as const,  label: '↗ Transferencias' },
                { id: 'tarjeta' as const,        label: '💳 Tarjetas' },
              ]).map(f => (
                <button key={f.id} onClick={() => setTipoFiltro(f.id)}
                  style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', background: tipoFiltro === f.id ? COLOR : 'var(--surface2)', color: tipoFiltro === f.id ? '#000' : '#8A8A8A', whiteSpace: 'nowrap' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#676767' }}>Desde</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#E5E5E3', fontSize: 12, outline: 'none' }} />
              <span style={{ fontSize: 12, color: '#676767' }}>hasta</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#E5E5E3', fontSize: 12, outline: 'none' }} />
            </div>

            {/* Refresh */}
            <button onClick={() => activeCuenta && loadMovimientos(activeCuenta)} disabled={loading}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${COLOR}40`, background: 'transparent', color: loading ? '#484848' : COLOR, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
              {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
            </button>
          </div>

          {/* ── Summary cards ─────────────────────────────────────────────────── */}
          {movimientos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Pagos recibidos', value: movimientos.length.toString(), sub: 'en el período', color: COLOR },
                { label: 'Total bruto', value: fmtARS(totalBruto), sub: 'antes de comisiones', color: '#4ade80' },
                { label: 'Total neto', value: fmtARS(totalNeto), sub: 'después de comisiones', color: '#4ade80' },
                { label: 'Comisión MP', value: fmtARS(comision), sub: `${totalBruto > 0 ? ((comision / totalBruto) * 100).toFixed(1) : '0'}% del total`, color: '#f87171' },
              ].map(card => (
                <div key={card.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#676767', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: card.color, marginBottom: 2 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#484848' }}>{card.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────────────── */}
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444440', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              ❌ {error}
            </div>
          )}

          {/* ── Movements table ───────────────────────────────────────────────── */}
          {!loading && !error && movimientos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#676767', fontSize: 14 }}>
              Sin pagos en el período seleccionado
            </div>
          )}

          {movimientos.length > 0 && (() => {
            const totalPages = Math.ceil(movimientos.length / PAGE_SIZE)
            const paginated  = movimientos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            return (
              <>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {['Fecha', 'Tipo', 'Pagador', 'Descripción', 'Cuotas', 'Bruto', 'Neto'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Bruto' || h === 'Neto' ? 'right' : 'left', color: '#676767', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((m, i) => {
                        const badge   = TIPO_BADGE[m.tipo] ?? TIPO_BADGE.otro
                        const cuotas  = m.cuotas && m.cuotas > 1 ? m.cuotas : null
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                            <td style={{ padding: '9px 12px', color: '#8A8A8A', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(m.fecha)}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: badge.bg, color: badge.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {badge.label}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', color: '#E5E5E3', fontWeight: 500, maxWidth: 200 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pagadorNombre}</div>
                              {m.pagadorEmail && <div style={{ fontSize: 11, color: '#676767', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pagadorEmail}</div>}
                            </td>
                            <td style={{ padding: '9px 12px', color: '#676767', maxWidth: 220 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion || '—'}</div>
                            </td>

                            {/* ── Cuotas ── */}
                            <td style={{ padding: '9px 12px' }}>
                              {cuotas ? (
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  background: 'rgba(124,58,237,0.12)',
                                  border: '1px solid rgba(167,139,250,0.25)',
                                  borderRadius: 8, padding: '5px 10px',
                                }}>
                                  <span style={{
                                    fontSize: 13, fontWeight: 800, color: '#a78bfa',
                                    lineHeight: 1,
                                  }}>
                                    {cuotas}x
                                  </span>
                                  <div style={{ width: 1, height: 14, background: 'rgba(167,139,250,0.25)' }} />
                                  <span style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 500, whiteSpace: 'nowrap', lineHeight: 1 }}>
                                    {fmtARS(m.monto / cuotas)}<span style={{ color: '#7c3aed', fontWeight: 700 }}>/c</span>
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#484848', fontSize: 12 }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#4ade80', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {fmtARS(m.monto)}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmtARS(m.montoNeto)}</span>
                              {m.monto !== m.montoNeto && (
                                <div style={{ fontSize: 10, color: '#f87171' }}>-{fmtARS(m.monto - m.montoNeto)}</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Paginación ── */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#676767' }}>
                      Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, movimientos.length)} de {movimientos.length} pagos
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button onClick={() => setPage(1)} disabled={page === 1}
                        style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: page === 1 ? '#484848' : '#8A8A8A', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                        «
                      </button>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: page === 1 ? '#484848' : '#8A8A8A', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                        ‹ Anterior
                      </button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let p: number
                        if (totalPages <= 7) { p = i + 1 }
                        else if (page <= 4) { p = i + 1 }
                        else if (page >= totalPages - 3) { p = totalPages - 6 + i }
                        else { p = page - 3 + i }
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${page === p ? COLOR : 'var(--border)'}`, background: page === p ? COLOR : 'var(--surface2)', color: page === p ? '#000' : '#8A8A8A', cursor: 'pointer', fontSize: 12, fontWeight: page === p ? 700 : 400, minWidth: 34 }}>
                            {p}
                          </button>
                        )
                      })}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: page === totalPages ? '#484848' : '#8A8A8A', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                        Siguiente ›
                      </button>
                      <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                        style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: page === totalPages ? '#484848' : '#8A8A8A', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}

      {/* ── Add account modal ─────────────────────────────────────────────── */}
      {showAdd && (
        <AddCuentaModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { loadCuentas() }}
        />
      )}
    </div>
  )
}
