'use client'
import { useState, useEffect } from 'react'
import VentasCSFView from './VentasCSFView'
import VentasGremioView from './VentasGremioView'
import { fmtARS, C, inputSt } from './shared'
import type { VentaCaja, VentaCSF, VentaGremio } from '@/lib/sistema-types'

const COLOR_CSF      = '#4ade80'
const COLOR_GREMIO   = '#34d399'
const COLOR_EMPRESAS = '#60a5fa'

const TABS = [
  { id: 'csf'      as const, label: '📋 Cliente Final',  color: COLOR_CSF      },
  { id: 'gremio'   as const, label: '🏢 Gremio',         color: COLOR_GREMIO   },
  { id: 'empresas' as const, label: '🏛️ Empresas',       color: COLOR_EMPRESAS },
]

// ── Resumen combinado (CSF legacy + Caja Mostrador) ──────────────────────────
function ResumenCombinado({ tipo, color }: { tipo: 'csf' | 'gremio'; color: string }) {
  const [totalCaja, setTotalCaja] = useState(0)
  const [countCaja, setCountCaja] = useState(0)
  const [totalLegacy, setTotalLegacy] = useState(0)
  const [countLegacy, setCountLegacy] = useState(0)

  useEffect(() => {
    // Ventas caja mostrador
    fetch('/api/sistema/ventas-caja')
      .then(r => r.json())
      .then((d: { items: VentaCaja[] }) => {
        const items = (d.items ?? []).filter(v =>
          tipo === 'gremio' ? v.tipoCliente === 'gremio'
            : v.tipoCliente === 'clienteFinal' || (!v.tipoCliente && v.tipoFactura !== 'A')
        )
        setTotalCaja(items.reduce((s, v) => s + v.total, 0))
        setCountCaja(items.length)
      }).catch(() => {})

    // Ventas legacy (CSF o Gremio)
    const url = tipo === 'gremio' ? '/api/sistema/ventas-gremio' : '/api/sistema/ventas-csf'
    fetch(url)
      .then(r => r.json())
      .then((d: (VentaCSF | VentaGremio)[]) => {
        const items = Array.isArray(d) ? d : []
        const total = items.reduce((s, v) => s + ('ticket' in v ? (v as VentaCSF).ticket : (v as VentaGremio).equivARS), 0)
        setTotalLegacy(total)
        setCountLegacy(items.length)
      }).catch(() => {})
  }, [tipo])

  const totalCombinado = totalCaja + totalLegacy
  const countCombinado = countCaja + countLegacy
  if (countCombinado === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 12,
      background: `${color}08`, border: `1px solid ${color}25`, marginBottom: 4,
      alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color, flex: 1, minWidth: 120 }}>
        📊 Total combinado: {fmtARS(totalCombinado)}
      </span>
      <span style={{ fontSize: 12, color: C.muted }}>{countCombinado} venta{countCombinado !== 1 ? 's' : ''} en total</span>
      <span style={{ fontSize: 11, color: C.muted }}>
        ({countLegacy} orden{countLegacy !== 1 ? 'es' : ''} {fmtARS(totalLegacy)} + {countCaja} caja {fmtARS(totalCaja)})
      </span>
    </div>
  )
}

// ── Tabla de ventas de caja mostrador ─────────────────────────────────────────
function VentasCajaView({
  tipo,
  color,
  titulo,
  subtitulo,
}: {
  tipo: 'csf' | 'gremio' | 'empresas'
  color: string
  titulo: string
  subtitulo: string
}) {
  const [ventas, setVentas] = useState<VentaCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; sub?: string; onConfirm: () => void
  } | null>(null)

  const loadVentas = () => {
    setLoading(true)
    fetch('/api/sistema/ventas-caja')
      .then(r => r.json())
      .then((d: { items: VentaCaja[] }) => {
        const all = (d.items ?? []).slice().reverse()
        // Clasificación por tipoCliente (campo nuevo); si no existe, retrocompatibilidad por tipoFactura
        const filtered = tipo === 'empresas'
          ? all.filter(v => v.tipoCliente === 'empresa' || (!v.tipoCliente && v.tipoFactura === 'A'))
          : tipo === 'gremio'
          ? all.filter(v => v.tipoCliente === 'gremio')
          : all.filter(v => v.tipoCliente === 'clienteFinal' || (!v.tipoCliente && v.tipoFactura !== 'A'))
        setVentas(filtered)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadVentas() }, [tipo])

  const pedirEliminar = (v: VentaCaja) => {
    setConfirmModal({
      title: 'Eliminar venta',
      message: `¿Eliminar la venta #${String(v.nVenta).padStart(5, '0')} por ${fmtARS(v.total)}?`,
      sub: 'Esta acción no se puede deshacer.',
      onConfirm: () => eliminarVenta(v),
    })
  }

  const eliminarVenta = async (v: VentaCaja) => {
    setDeletingId(v.id)
    try {
      await fetch('/api/sistema/ventas-caja', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id }),
      })
      loadVentas()
    } catch { /* silencioso */ }
    finally { setDeletingId(null) }
  }

  const q = search.toLowerCase()
  const filtered = ventas.filter(v =>
    !q ||
    String(v.nVenta).includes(q) ||
    (v.clienteNombre ?? '').toLowerCase().includes(q) ||
    v.metodoPago.toLowerCase().includes(q) ||
    v.items.some(i => i.nombre.toLowerCase().includes(q))
  )
  const totalFiltrado = filtered.reduce((s, v) => s + v.total, 0)

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header — solo si hay título */}
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1.5px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖥️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12, color: C.muted }}>{subtitulo}</div>}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Cargando…</div>
      ) : ventas.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          No hay ventas registradas en esta categoría.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar por N° venta, cliente, producto…"
              style={{ ...inputSt, flex: 1 }}
            />
            <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
              {filtered.length} venta{filtered.length !== 1 ? 's' : ''} · <b style={{ color }}>{fmtARS(totalFiltrado)}</b>
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin resultados para la búsqueda.</div>
          ) : (
            <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['N° Venta', 'Fecha', 'Cliente', 'Productos', 'Método', 'Total', 'Factura', ''].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => (
                    <tr key={v.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color }}>#{String(v.nVenta).padStart(5, '0')}</td>
                      <td style={{ padding: '10px 14px', color: C.muted }}>{v.fecha} {v.hora}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{v.clienteNombre || <span style={{ color: C.muted }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', color: C.muted, maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.items.map(it => `${it.nombre} ×${it.cantidad}`).join(', ')}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: C.muted }}>{v.metodoPago}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmtARS(v.total)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {v.tipoFactura
                          ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: `${color}18`, color, fontWeight: 700 }}>Factura {v.tipoFactura}</span>
                          : <span style={{ fontSize: 10, color: C.muted }}>Sin factura</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => pedirEliminar(v)}
                          disabled={deletingId === v.id}
                          style={{
                            padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                            cursor: deletingId === v.id ? 'not-allowed' : 'pointer',
                            fontSize: 11, fontWeight: 600, opacity: deletingId === v.id ? 0.5 : 1,
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                        >
                          {deletingId === v.id ? '…' : '🗑 Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal de confirmación */}
      {confirmModal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, backdropFilter: 'blur(2px)' }}
            onClick={() => setConfirmModal(null)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 2001, width: 360, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)', overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--row-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🗑</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{confirmModal.title}</div>
            </div>
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{confirmModal.message}</div>
              {confirmModal.sub && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 20 }}>{confirmModal.sub}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >Cancelar</button>
                <button
                  onClick={() => { confirmModal.onConfirm(); setConfirmModal(null) }}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >Eliminar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Vista "Empresas": solo ventas de caja con Factura A ───────────────────────
function EmpresasView() {
  return (
    <VentasCajaView
      tipo="empresas"
      color={COLOR_EMPRESAS}
      titulo="Ventas a Empresas"
      subtitulo="Ventas de mostrador con Factura A"
    />
  )
}

export default function VentasMainView() {
  const [tab, setTab] = useState<'csf' | 'gremio' | 'empresas'>('csf')
  const activeColor = TABS.find(t => t.id === tab)?.color ?? COLOR_CSF

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none',
              color: tab === t.id ? t.color : 'var(--text-secondary)',
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'csf' && (
        <>
          <ResumenCombinado tipo="csf" color={COLOR_CSF} />
          <VentasCSFView />
          {/* Ventas de mostrador cliente final (sin factura o Factura B) */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                🖥️ VENTAS DE CAJA MOSTRADOR — CLIENTE FINAL
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <VentasCajaView
              tipo="csf"
              color={COLOR_CSF}
              titulo=""
              subtitulo=""
            />
          </div>
        </>
      )}
      {tab === 'gremio' && (
        <>
          <ResumenCombinado tipo="gremio" color={COLOR_GREMIO} />
          <VentasGremioView />
          {/* Ventas de mostrador a clientes gremio */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                🖥️ VENTAS DE CAJA MOSTRADOR — GREMIO
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <VentasCajaView tipo="gremio" color={COLOR_GREMIO} titulo="" subtitulo="" />
          </div>
        </>
      )}
      {tab === 'empresas' && <EmpresasView />}
    </div>
  )
}
