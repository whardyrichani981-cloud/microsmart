'use client'

import { useState, lazy, Suspense, useEffect } from 'react'
import {
  IconLogo, IconOrders, IconUsers, IconInv, IconStats,
  IconCheck, IconPhone, IconTag, IconWrench, IconClock,
  IconChevDown, IconChev, IconMoon, IconSun, IconTrend,
} from './sistema/MSIcons'

const OrdenesView        = lazy(() => import('./sistema/OrdenesView'))
const ClientesView       = lazy(() => import('./sistema/ClientesView'))
const ProveedoresView    = lazy(() => import('./sistema/ProveedoresView'))
const ComisionesView     = lazy(() => import('./sistema/ComisionesView'))
const GastosMainView     = lazy(() => import('./sistema/GastosMainView'))
const StockMainView      = lazy(() => import('./sistema/StockMainView'))
const TipoCambioView     = lazy(() => import('./sistema/TipoCambioView'))
const VentasCSFView      = lazy(() => import('./sistema/VentasCSFView'))
const VentasGremioView   = lazy(() => import('./sistema/VentasGremioView'))
const VentasEquiposView  = lazy(() => import('./sistema/VentasEquiposView'))
const DashboardView      = lazy(() => import('./sistema/DashboardView'))
const ChatSoporteView    = lazy(() => import('./sistema/ChatSoporteView'))
const GarantiasView      = lazy(() => import('./sistema/GarantiasView'))
const CajaDiariaView     = lazy(() => import('./sistema/CajaDiariaView'))
const CuentaCorrienteView = lazy(() => import('./sistema/CuentaCorrienteView'))
const MercadoPagoView    = lazy(() => import('./sistema/MercadoPagoView'))

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
  | 'caja-diaria'
  | 'cuenta-corriente'
  | 'mercadopago'

interface NavItem {
  id: SectionId
  label: string
  Icon: React.ComponentType<{ size?: number }>
  desc?: string
}
interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    group: 'Centro de Servicios',
    items: [
      { id: 'ordenes',   label: 'Órdenes de trabajo', Icon: IconOrders, desc: 'Seguimiento y flujo de reparaciones' },
      { id: 'garantias', label: 'Garantías',           Icon: IconCheck,  desc: 'Órdenes con garantía vigente' },
      { id: 'chat',      label: 'Chat & Soporte',      Icon: IconPhone,  desc: 'Mensajes de clientes · Telegram' },
    ],
  },
  {
    group: 'Agenda',
    items: [
      { id: 'clientes',    label: 'Clientes',     Icon: IconUsers,  desc: 'Personas (B2C) y Empresas (B2B)' },
      { id: 'proveedores', label: 'Proveedores',  Icon: IconInv,    desc: 'Registro de proveedores' },
    ],
  },
  {
    group: 'Ventas Equipos',
    items: [
      { id: 'ventas-equipos', label: 'Stock de equipos', Icon: IconPhone, desc: 'Equipos usados en stock' },
    ],
  },
  {
    group: 'Administración',
    items: [
      { id: 'caja-diaria',       label: 'Caja Diaria',       Icon: IconWrench,  desc: 'Resumen y cierre de caja por día' },
      { id: 'cuenta-corriente',  label: 'Cuenta Corriente',  Icon: IconTrend,   desc: 'Deudas pendientes por cliente' },
      { id: 'mercadopago',       label: 'MercadoPago',       Icon: IconTag,     desc: 'Transferencias y pagos recibidos' },
      { id: 'gastos',            label: 'Gastos',            Icon: IconTag,     desc: 'Control de egresos' },
      { id: 'stock',             label: 'Stock',             Icon: IconInv,     desc: 'Inventario de repuestos' },
      { id: 'comisiones',        label: 'Comisiones',        Icon: IconUsers,   desc: 'Ronald · Sharon · Saddi' },
      { id: 'tipo-cambio',       label: 'Tipo de Cambio',    Icon: IconClock,   desc: 'Cotización USD/ARS' },
    ],
  },
  {
    group: 'Reportes',
    items: [
      { id: 'dashboard', label: 'Dashboard', Icon: IconStats, desc: 'Resumen general' },
    ],
  },
  {
    group: 'Archivo',
    items: [
      { id: 'ventas-csf',    label: 'Ventas B2C (CSF)',    Icon: IconOrders, desc: 'Historial de reparaciones B2C' },
      { id: 'ventas-gremio', label: 'Ventas B2B (Gremio)', Icon: IconOrders, desc: 'Historial de servicios B2B' },
    ],
  },
]

const ALL_ITEMS = NAV.flatMap(g => g.items)

function groupOf(id: SectionId) {
  return NAV.find(g => g.items.some(i => i.id === id))
}

function Spinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 200, color: 'var(--ms-text-3)', fontSize: 13,
    }}>
      Cargando…
    </div>
  )
}

function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'ordenes':           return <OrdenesView />
    case 'clientes':          return <ClientesView />
    case 'proveedores':       return <ProveedoresView />
    case 'comisiones':        return <ComisionesView />
    case 'gastos':            return <GastosMainView />
    case 'stock':             return <StockMainView />
    case 'tipo-cambio':       return <TipoCambioView />
    case 'ventas-csf':        return <VentasCSFView />
    case 'ventas-gremio':     return <VentasGremioView />
    case 'ventas-equipos':    return <VentasEquiposView />
    case 'dashboard':         return <DashboardView />
    case 'chat':              return <ChatSoporteView />
    case 'garantias':         return <GarantiasView />
    case 'caja-diaria':       return <CajaDiariaView />
    case 'cuenta-corriente':  return <CuentaCorrienteView />
    case 'mercadopago':       return <MercadoPagoView />
  }
}

export default function SistemaView() {
  const [activeId, setActiveId]     = useState<SectionId>('ordenes')
  const [expanded, setExpanded]     = useState<Record<string, boolean>>(
    Object.fromEntries(NAV.map(g => [g.group, g.group !== 'Archivo']))
  )
  const [stockAlerts, setStockAlerts] = useState({ agotado: 0, bajo: 0 })
  const [ccDeuda, setCcDeuda]         = useState(0)
  const [isDark, setIsDark]           = useState(false)

  // Detectar dark mode actual
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Toggle dark mode
  function toggleDark() {
    document.documentElement.classList.toggle('dark')
    setIsDark(d => !d)
  }

  // Stock alerts
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
        const groups = [...map.values()]
        setStockAlerts({
          agotado: groups.filter(g => g.total === 0).length,
          bajo: groups.filter(g => g.total > 0 && g.total <= g.min).length,
        })
      })
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [])

  // Cuenta corriente deuda
  useEffect(() => {
    const checkCC = () => {
      fetch('/api/sistema/cuenta-corriente?balances=1')
        .then(r => r.json())
        .then(d => setCcDeuda((d.balances ?? []).length))
        .catch(() => {})
    }
    checkCC()
    const t = setInterval(checkCC, 120_000)
    return () => clearInterval(t)
  }, [])

  const activeItem  = ALL_ITEMS.find(i => i.id === activeId)!
  const activeGroup = groupOf(activeId)

  return (
    <div
      className="ms-app"
      style={{ display: 'flex', height: 'calc(100vh - 96px)', overflow: 'hidden' }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside style={{
        width: 232, flexShrink: 0,
        background: 'var(--ms-surface)',
        borderRight: '0.5px solid var(--ms-border)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 12px',
        height: '100%', overflowY: 'auto',
      }}>
        {/* Logo + nombre */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '4px 10px 16px',
          borderBottom: '0.5px solid var(--ms-border)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--ms-text)', color: 'var(--ms-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconLogo size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ms-text)' }}>
              Microsmart
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ms-text-3)' }}>
              Palermo · Plan Pro
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1 }}>
          {NAV.map(group => {
            const isExpanded = expanded[group.group] !== false
            return (
              <div key={group.group} style={{ marginBottom: 2 }}>
                {/* Group header */}
                <button
                  onClick={() => setExpanded(e => ({ ...e, [group.group]: !isExpanded }))}
                  style={{
                    appearance: 'none', border: 0, background: 'transparent',
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', cursor: 'pointer',
                    marginBottom: 2,
                  }}
                >
                  <span style={{
                    flex: 1, fontSize: 10.5, fontWeight: 600,
                    color: 'var(--ms-text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                    textAlign: 'left',
                  }}>
                    {group.group}
                  </span>
                  <span style={{ color: 'var(--ms-text-3)', display: 'flex' }}>
                    {isExpanded
                      ? <IconChevDown size={13} />
                      : <IconChev size={13} style={{ transform: 'rotate(0deg)' }} />
                    }
                  </span>
                </button>

                {/* Group items */}
                {isExpanded && group.items.map(item => {
                  const isActive = activeId === item.id
                  const hasStockBadge = item.id === 'stock' && (stockAlerts.agotado > 0 || stockAlerts.bajo > 0)
                  const hasCCBadge   = item.id === 'cuenta-corriente' && ccDeuda > 0

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      style={{
                        appearance: 'none', border: 0,
                        background: isActive ? 'var(--ms-surface-2)' : 'transparent',
                        padding: '8px 10px', borderRadius: 8,
                        display: 'flex', alignItems: 'center', gap: 10,
                        color: isActive ? 'var(--ms-text)' : 'var(--ms-text-2)',
                        fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                        width: '100%', cursor: 'pointer',
                        marginBottom: 1,
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = 'var(--ms-surface-2)'
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <item.Icon size={17} />
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>

                      {/* Badges */}
                      {hasCCBadge && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: 'var(--ms-warn-soft)', color: 'var(--ms-warn)',
                          padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                        }}>
                          {ccDeuda}
                        </span>
                      )}
                      {hasStockBadge && (
                        <span className="badge-pulse" style={{
                          fontSize: 10, fontWeight: 700,
                          background: stockAlerts.agotado > 0 ? 'var(--ms-danger-soft)' : 'var(--ms-warn-soft)',
                          color: stockAlerts.agotado > 0 ? 'var(--ms-danger)' : 'var(--ms-warn)',
                          padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                        }}>
                          {stockAlerts.agotado > 0 ? `${stockAlerts.agotado} sin` : `${stockAlerts.bajo} bajo`}
                        </span>
                      )}
                    </button>
                  )
                })}

                <div style={{ height: 8 }} />
              </div>
            )
          })}
        </nav>

        {/* Footer: avatar + dark mode toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 10, borderRadius: 10,
          background: 'var(--ms-surface-2)',
          marginTop: 4,
        }}>
          <div className="ms-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
            MS
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ms-text)' }}>Microsmart</div>
            <div style={{ fontSize: 10.5, color: 'var(--ms-text-3)' }}>Sistema de gestión</div>
          </div>
          <button
            onClick={toggleDark}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            style={{
              appearance: 'none', border: '0.5px solid var(--ms-border)',
              background: 'var(--ms-surface)', color: 'var(--ms-text-2)',
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {isDark ? <IconSun size={14} /> : <IconMoon size={14} />}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--ms-bg)', display: 'flex', flexDirection: 'column' }}>
        {/* PageHeader */}
        <div style={{
          padding: '16px 28px 14px',
          borderBottom: '0.5px solid var(--ms-border)',
          background: 'var(--ms-surface)',
          display: 'flex', alignItems: 'flex-end', gap: 16,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div className="ms-eyebrow" style={{ marginBottom: 4 }}>
              {activeGroup?.group}
            </div>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 700,
              letterSpacing: '-0.02em', color: 'var(--ms-text)',
            }}>
              {activeItem?.label}
            </h1>
          </div>
        </div>

        {/* Lazy-loaded view */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Suspense fallback={<Spinner />}>
            <SectionContent id={activeId} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
