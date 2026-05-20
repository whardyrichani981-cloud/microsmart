'use client'

import { useState, lazy, Suspense, useEffect } from 'react'

const OrdenesView    = lazy(() => import('./sistema/OrdenesView'))
const ClientesView   = lazy(() => import('./sistema/ClientesView'))
const ProveedoresView = lazy(() => import('./sistema/ProveedoresView'))
const ComisionesView = lazy(() => import('./sistema/ComisionesView'))
const GastosMainView = lazy(() => import('./sistema/GastosMainView'))
const StockMainView  = lazy(() => import('./sistema/StockMainView'))
const TipoCambioView = lazy(() => import('./sistema/TipoCambioView'))
const VentasCSFView  = lazy(() => import('./sistema/VentasCSFView'))
const VentasGremioView = lazy(() => import('./sistema/VentasGremioView'))
const VentasEquiposView = lazy(() => import('./sistema/VentasEquiposView'))
const DashboardView  = lazy(() => import('./sistema/DashboardView'))
const ChatSoporteView = lazy(() => import('./sistema/ChatSoporteView'))
const GarantiasView  = lazy(() => import('./sistema/GarantiasView'))

type SectionId =
  | 'ordenes'
  | 'clientes'
  | 'proveedores'
  | 'comisiones'
  | 'gastos'
  | 'stock'
  | 'tipo-cambio'
  | 'ventas-csf'
  | 'ventas-gremio'
  | 'ventas-equipos'
  | 'dashboard'
  | 'chat'
  | 'garantias'

interface NavItem { id: SectionId; label: string; icon: string; desc?: string }
interface NavGroup { group: string; icon: string; color: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    group: 'Centro de Servicios', icon: '🔧', color: '#4ade80',
    items: [
      { id: 'ordenes',   label: 'Órdenes de trabajo', icon: '📋', desc: 'Seguimiento y flujo de reparaciones' },
      { id: 'garantias', label: 'Garantías',           icon: '🛡️', desc: 'Órdenes con garantía vigente' },
      { id: 'chat',      label: 'Chat & Soporte',      icon: '💬', desc: 'Mensajes de clientes · Telegram' },
    ],
  },
  {
    group: 'Agenda', icon: '📇', color: '#60a5fa',
    items: [
      { id: 'clientes', label: 'Clientes', icon: '👥', desc: 'Personas (B2C) y Empresas (B2B)' },
      { id: 'proveedores', label: 'Proveedores', icon: '🏪', desc: 'Registro de proveedores' },
    ],
  },
  {
    group: 'Ventas Equipos', icon: '📱', color: '#f97316',
    items: [
      { id: 'ventas-equipos', label: 'Stock de equipos', icon: '📱', desc: 'Equipos usados en stock' },
    ],
  },
  {
    group: 'Finanzas', icon: '💰', color: '#F5C400',
    items: [
      { id: 'gastos', label: 'Gastos', icon: '🧾', desc: 'Control de egresos' },
      { id: 'stock', label: 'Stock', icon: '📦', desc: 'Inventario de repuestos' },
      { id: 'comisiones', label: 'Comisiones', icon: '👥', desc: 'Ronald · Sharon · Saddi' },
      { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: '💱', desc: 'Cotización USD/ARS' },
    ],
  },
  {
    group: 'Reportes', icon: '📊', color: '#a78bfa',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', desc: 'Resumen general' },
    ],
  },
  {
    group: 'Archivo', icon: '🗃️', color: '#676767',
    items: [
      { id: 'ventas-csf', label: 'Ventas B2C (CSF)', icon: '📂', desc: 'Historial de reparaciones B2C' },
      { id: 'ventas-gremio', label: 'Ventas B2B (Gremio)', icon: '📂', desc: 'Historial de servicios B2B' },
    ],
  },
]

const ALL_ITEMS = NAV.flatMap(g => g.items)

function groupOf(id: SectionId) {
  return NAV.find(g => g.items.some(i => i.id === id))
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#8A8A8A', fontSize: 13 }}>
      Cargando…
    </div>
  )
}

function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'ordenes':       return <OrdenesView />
    case 'clientes':      return <ClientesView />
    case 'proveedores':   return <ProveedoresView />
    case 'comisiones':    return <ComisionesView />
    case 'gastos':        return <GastosMainView />
    case 'stock':         return <StockMainView />
    case 'tipo-cambio':   return <TipoCambioView />
    case 'ventas-csf':     return <VentasCSFView />
    case 'ventas-gremio':  return <VentasGremioView />
    case 'ventas-equipos': return <VentasEquiposView />
    case 'dashboard':      return <DashboardView />
    case 'chat':           return <ChatSoporteView />
    case 'garantias':      return <GarantiasView />
  }
}

export default function SistemaView() {
  const [activeId, setActiveId] = useState<SectionId>('ordenes')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(NAV.map(g => [g.group, g.group !== 'Archivo']))
  )
  const [stockAlerts, setStockAlerts] = useState(0)

  useEffect(() => {
    const check = () => {
      Promise.all([
        fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()).catch(() => ({ items: [] })),
      ]).then(([rep, acc]) => {
        const all = [...(rep?.items ?? []), ...(acc?.items ?? [])]
        const map = new Map<string, { total: number; min: number }>()
        for (const item of all) {
          const k = `${item.tipo}|||${item.repuesto?.toLowerCase()}|||${item.modelo?.toLowerCase()}`
          if (!map.has(k)) map.set(k, { total: 0, min: item.stockMinimo ?? 2 })
          const g = map.get(k)!
          g.total += item.stock ?? 0
          g.min = Math.max(g.min, item.stockMinimo ?? 2)
        }
        setStockAlerts([...map.values()].filter(g => g.total <= g.min).length)
      })
    }
    check()
    const t = setInterval(check, 60000) // recheck every minute
    return () => clearInterval(t)
  }, [])

  const activeItem = ALL_ITEMS.find(i => i.id === activeId)!
  const activeGroup = groupOf(activeId)

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 96px)', overflow: 'hidden' }}>

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div style={{
        width: 224, flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        borderRadius: '10px 0 0 10px',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>🔧</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E3' }}>Sistema</div>
              <div style={{ fontSize: 10, color: '#676767' }}>Microsmart v2</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '8px 0', flex: 1 }}>
          {NAV.map(group => {
            const isExpanded = expanded[group.group] !== false
            return (
              <div key={group.group}>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [group.group]: !isExpanded }))}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{group.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#676767', flex: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {group.group}
                  </span>
                  <span style={{ fontSize: 10, color: '#484848' }}>{isExpanded ? '▾' : '▸'}</span>
                </button>

                {isExpanded && group.items.map(item => {
                  const isActive = activeId === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 16px 7px 28px',
                        background: isActive ? `${group.color}14` : 'none',
                        border: 'none', borderLeft: isActive ? `2px solid ${group.color}` : '2px solid transparent',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
                    >
                      <span style={{ fontSize: 13 }}>{item.icon}</span>
                      <span style={{
                        fontSize: 12, fontWeight: isActive ? 600 : 400,
                        color: isActive ? group.color : '#8A8A8A',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }}>{item.label}</span>
                      {item.id === 'stock' && stockAlerts > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          background: '#ef4444', color: '#fff',
                          padding: '1px 5px', borderRadius: 8, lineHeight: '15px', flexShrink: 0,
                        }}>{stockAlerts}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 18px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          borderLeft: `3px solid ${activeGroup?.color ?? '#4ade80'}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, marginRight: 10 }}>{activeItem.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E5E5E3' }}>{activeItem.label}</div>
            {activeItem.desc && <div style={{ fontSize: 11, color: '#676767', marginTop: 1 }}>{activeItem.desc}</div>}
          </div>
        </div>

        {/* View content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <Suspense fallback={<Spinner />}>
            <SectionContent id={activeId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
