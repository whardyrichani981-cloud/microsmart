'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Supplier, MergedRow } from '@/lib/types'
import { COLORS } from '@/lib/colors'
import PriceTable from './PriceTable'
import UploadZone from './UploadZone'
import SupplierChips from './SupplierChips'
import CategoryFilters from './CategoryFilters'
import type { AppleCategory } from '@/lib/categories'
import { expandQuery, matchesQuery } from '@/lib/search'
import SupplierColumns from './SupplierColumns'
import NotasBoard from './NotasBoard'
import ListasPreciosView from './ListasPreciosView'
import SettingsModal from './SettingsModal'
import AdminView from './AdminView'
import HomeView from './HomeView'
import IMEIView from './IMEIView'
import PanicAnalyzerView from './sistema/PanicAnalyzerView'
import TurnosView from './sistema/TurnosView'
import StockMainView from './sistema/StockMainView'
import GastosMainView from './sistema/GastosMainView'
import ReportesMainView from './sistema/ReportesMainView'
import VentasMainView from './sistema/VentasMainView'
import ComisionesView from './sistema/ComisionesView'
import ClientesView from './sistema/ClientesView'
import ProveedoresView from './sistema/ProveedoresView'
import OrdenesView from './sistema/OrdenesView'
import ServiciosView from './sistema/ServiciosView'
import VentasEquiposView from './sistema/VentasEquiposView'
import CajaView from './sistema/CajaView'
import CajaDiariaView from './sistema/CajaDiariaView'
import CuentaCorrienteView from './sistema/CuentaCorrienteView'
import MercadoPagoView from './sistema/MercadoPagoView'
import PresupuestosView from './sistema/PresupuestosView'
import ChatSoporteView from './sistema/ChatSoporteView'
import NotaRapidaFloat from './sistema/NotaRapidaFloat'
import GlobalSearch from './GlobalSearch'
import PWAInstaller from './PWAInstaller'
import type { UserRole, Permissions } from '@/lib/roles'
import { SUPERADMIN_PERMISSIONS } from '@/lib/roles'

interface Props {
  initialSuppliers: Supplier[]
  currentUser?: string
  initialDisplayName?: string
  role?: UserRole
  permissions?: Permissions | null
  modulosConfig?: Record<string, boolean> | null
}
export type SortState = { col: string; dir: 1 | -1 }

type NavItem = 'inicio' | 'comparador' | 'proveedores' | 'notas' | 'notasdash' | 'cf' | 'gremio' | 'imei' | 'panic' | 'administracion' | 'agenda' | 'stock' | 'gastos' | 'reportes' | 'ventas' | 'comisiones' | 'clientes' | 'ordenes' | 'servicios' | 'contable' | 'ventas-equipos' | 'caja' | 'presupuestos'

const ALL_NAV: { id: NavItem; label: string; icon: string; permKey?: keyof Permissions; adminOnly?: boolean }[] = [
  { id: 'inicio',         label: 'Inicio',                   icon: '🏠' },
  { id: 'comparador',     label: 'Listas de precio',         icon: '📊', permKey: 'canViewComparador' },
  { id: 'proveedores',    label: 'Proveedores',              icon: '🏢', permKey: 'canViewProveedores' },
  { id: 'notasdash',      label: 'Tareas y Pedidos',         icon: '📋', permKey: 'canViewNotas' },
  { id: 'imei',           label: 'Verificar IMEI',           icon: '🔍', permKey: 'canViewIMEI' },
  { id: 'panic',          label: 'Análisis Panic Full',      icon: '📋', permKey: 'canViewIMEI' },
  { id: 'ordenes',        label: 'Órdenes de trabajo',       icon: '🔧', permKey: 'canViewOrdenes' },
  { id: 'presupuestos',   label: 'Presupuestos',             icon: '📋', permKey: 'canViewOrdenes' },
  { id: 'servicios',      label: 'Servicios',                icon: '🛠', permKey: 'canViewServicios' },
  { id: 'clientes',       label: 'Clientes',                 icon: '👥', permKey: 'canViewClientes' },
  { id: 'agenda',         label: 'Turnos',                   icon: '📅', permKey: 'canViewAgenda' },
  { id: 'stock',          label: 'Stock',                    icon: '📦', permKey: 'canViewStock' },
  { id: 'ventas-equipos', label: 'Venta de equipos',          icon: '📱' },
  { id: 'contable',       label: 'Administración contable',  icon: '📒' },
  { id: 'caja',           label: 'Caja de mostrador',        icon: '🖥️', permKey: 'canViewOrdenes' },
  { id: 'administracion', label: 'Configuración del sistema', icon: '⚙️', adminOnly: true },
]

const NAV_FIXED = new Set<NavItem>(['inicio', 'administracion'])

// Módulos que nunca se pueden desactivar
const PROTECTED_MODULES = new Set(['inicio', 'comparador', 'proveedores', 'administracion', 'contable'])

export default function PriceComparator({
  initialSuppliers, currentUser = '', initialDisplayName = '',
  role = 'employee', permissions = null, modulosConfig = null,
}: Props) {
  const p = permissions ?? SUPERADMIN_PERMISSIONS
  const isSuperAdmin = role === 'superadmin'

  // ── Módulos reactivos — se actualizan en tiempo real cuando el admin cambia toggles ──
  const [modulesCfg, setModulesCfg] = useState<Record<string, boolean> | null>(modulosConfig ?? null)

  // Llamado en tiempo real cuando el admin cambia un toggle (antes de guardar)
  const handleModulosChange = useCallback((config: Record<string, boolean>) => {
    setModulesCfg(config)
  }, [])

  // Llamado después de guardar — refresca desde el servidor para confirmar persistencia
  const handleModulosSaved = useCallback(async (config: Record<string, boolean>) => {
    setModulesCfg(config)
    try {
      const res = await fetch('/api/sistema/modulos', { cache: 'no-store' })
      if (res.ok) setModulesCfg(await res.json())
    } catch { /* ignore */ }
  }, [])

  const NAV = ALL_NAV.filter(item => {
    if (item.adminOnly && !isSuperAdmin) return false
    if (item.permKey && !p[item.permKey]) return false
    // Respetar configuración de módulos (solo para no-protegidos)
    if (modulesCfg && !PROTECTED_MODULES.has(item.id) && modulesCfg[item.id] === false) return false
    return true
  })
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName || currentUser)
  const [showSettings, setShowSettings] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ col: 'name', dir: 1 })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingNotes, setPendingNotes] = useState(0)
  const [ccDeuda, setCcDeuda] = useState(0)
  const [stockAlertas, setStockAlertas] = useState(0)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [navSearch, setNavSearch] = useState<{ nav: 'ordenes' | 'clientes'; term: string } | null>(null)

  const [activeCategories, setActiveCategories] = useState<Set<AppleCategory>>(new Set())
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeNav, setActiveNav] = useState<NavItem>('inicio')
  const [isDark, setIsDark] = useState(false)
  const [contableSubTab, setContableSubTab] = useState<'ventas' | 'gastos' | 'reportes' | 'comisiones' | 'caja-diaria' | 'cuenta-corriente' | 'mercadopago'>('ventas')
  const [viewMode, setViewMode] = useState<'merged' | 'columns'>('columns')
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set())
  const mainRef = useRef<HTMLElement>(null)

  // Reset scroll al inicio cada vez que se cambia de pestaña o sub-pestaña
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [activeNav, contableSubTab])

  // Mobile detection
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Theme: load from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('microsmart-theme')
      const dark = saved === 'dark'
      setIsDark(dark)
      document.documentElement.classList.toggle('dark', dark)
    } catch {}
  }, [])

  // Auto-backup silencioso al abrir el sistema (solo admins)
  // Si pasaron más de 24h desde el último backup, lo dispara en background
  useEffect(() => {
    if (!isSuperAdmin) return
    const check = async () => {
      try {
        const res = await fetch('/api/sistema/backup?list=1')
        if (!res.ok) return
        const { meta } = await res.json() as { meta: { lastBackup: string | null } }
        const lastBackup = meta?.lastBackup ? new Date(meta.lastBackup).getTime() : 0
        const hoursAgo = (Date.now() - lastBackup) / 3_600_000
        if (hoursAgo >= 24) {
          console.log('[backup] Auto-backup triggered — last backup was', Math.round(hoursAgo), 'h ago')
          await fetch('/api/sistema/backup', { method: 'POST' })
        }
      } catch { /* silencioso */ }
    }
    // Correr con un pequeño delay para no bloquear la carga inicial
    const t = setTimeout(check, 8_000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stock alerts — browser notifications on startup
  useEffect(() => {
    const NOTIFIED_KEY = 'ms-stock-notified'
    const run = async () => {
      try {
        const [rep, acc] = await Promise.all([
          fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()),
          fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()),
        ])
        interface StockItemLite { nombre?: string; modelo?: string; color?: string; stock: number; stockMinimo?: number }
        const allItems: StockItemLite[] = [...(rep?.items ?? []), ...(acc?.items ?? [])]

        // Group by name key and accumulate totals
        const map = new Map<string, { label: string; total: number; min: number }>()
        for (const item of allItems) {
          const key = [item.nombre, item.modelo, item.color].filter(Boolean).join('|').toLowerCase()
          const label = [item.nombre, item.modelo, item.color].filter(Boolean).join(' – ')
          if (!map.has(key)) map.set(key, { label, total: 0, min: item.stockMinimo ?? 2 })
          const g = map.get(key)!
          g.total += item.stock
          g.min = Math.max(g.min, item.stockMinimo ?? 2)
        }

        const critical = [...map.values()].filter(g => g.total <= g.min)

        // Read already-notified set
        let notified: string[] = []
        try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]') } catch {}
        const notifiedSet = new Set(notified)

        // Request permission lazily if needed
        if (critical.length > 0 && 'Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission()
        }

        const toNotify = critical.filter(g => !notifiedSet.has(g.label))
        if (toNotify.length === 0) return

        if (Notification.permission === 'granted') {
          if (toNotify.length === 1) {
            new Notification('⚠️ Stock crítico — Microsmart', {
              body: `${toNotify[0].label} está en stock mínimo (${toNotify[0].total} unidad/es).`,
              icon: '/favicon.ico',
            })
          } else {
            new Notification(`⚠️ ${toNotify.length} productos en stock mínimo`, {
              body: toNotify.slice(0, 4).map(g => `• ${g.label} (${g.total})`).join('\n'),
              icon: '/favicon.ico',
            })
          }
        }

        // Mark as notified for this session
        const newNotified = [...notifiedSet, ...toNotify.map(g => g.label)]
        try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(newNotified)) } catch {}
      } catch { /* silencioso */ }
    }
    const t = setTimeout(run, 5_000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ctrl+K → abrir búsqueda global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setGlobalSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleGlobalNavigate = (nav: 'ordenes' | 'clientes', term: string) => {
    setNavSearch({ nav, term })
    setActiveNav(nav)
  }

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    document.documentElement.classList.toggle('dark', newDark)
    try { localStorage.setItem('microsmart-theme', newDark ? 'dark' : 'light') } catch {}
  }

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notes')
        const notes: { resolved: boolean }[] = await res.json()
        setPendingNotes(notes.filter(n => !n.resolved).length)
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

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

  const activeSuppliers = suppliers.filter(s => s.items.length > 0)
  // Gremio has its own dedicated tab — exclude it from the comparador
  const comparadorSuppliers = activeSuppliers.filter(s => s.id !== 'gremio')

  const merged = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>()
    for (const s of comparadorSuppliers) {
      for (const item of s.items) {
        const key = item.name.toLowerCase().trim()
        if (!map.has(key))
          map.set(key, { key, name: item.name, code: item.code, category: item.category, prices: {}, pricesARS: {}, stocks: {} })
        const row = map.get(key)!
        row.prices[s.id] = item.price
        if (item.priceARS) row.pricesARS[s.id] = item.priceARS
        if (item.stock) row.stocks[s.id] = item.stock
      }
    }
    return [...map.values()]
  }, [comparadorSuppliers])

  const rows = useMemo(() => {
    const terms = expandQuery(search)
    let filtered = merged
    if (selectedSupplierIds.size > 0)
      filtered = filtered.filter(r => [...selectedSupplierIds].some(id => r.prices[id] != null))
    if (terms.length) filtered = filtered.filter(r =>
      matchesQuery(r.name, terms) || matchesQuery(r.code, terms))
    if (activeCategories.size > 0)
      filtered = filtered.filter(r => activeCategories.has((r.category ?? 'otros') as AppleCategory))
    return [...filtered].sort((a, b) => {
      if (sort.col === 'name') return sort.dir * a.name.localeCompare(b.name, 'es')
      if (sort.col === 'best') {
        const ba = Math.min(...Object.values(a.prices))
        const bb = Math.min(...Object.values(b.prices))
        return sort.dir * (ba - bb)
      }
      return sort.dir * ((a.prices[sort.col] ?? Infinity) - (b.prices[sort.col] ?? Infinity))
    })
  }, [merged, search, sort, activeCategories, selectedSupplierIds])

  const handleSort = useCallback((col: string) =>
    setSort(s => s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }), [])

  const handleSupplierAdd = useCallback((supplier: Supplier) => {
    const colorIdx = suppliers.length % COLORS.length
    setSuppliers(prev => [...prev, { ...supplier, color: COLORS[colorIdx] }])
  }, [suppliers.length])

  const handleSupplierRemove = useCallback((id: string) =>
    setSuppliers(prev => prev.filter(s => s.id !== id)), [])

  const handleSupplierRename = useCallback((id: string, name: string) =>
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, name } : s)), [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/suppliers')
      const fresh: Supplier[] = await res.json()
      setSuppliers(prev => [...fresh, ...prev.filter(s => s.source === 'upload')])
    } finally { setRefreshing(false) }
  }

  const toggleSupplier = (id: string) => {
    setSelectedSupplierIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNav = (id: NavItem) => {
    setActiveNav(id)
    setNavSearch(null)
    if (id !== 'comparador') setSelectedSupplierIds(new Set())
    if (id === 'contable') setContableSubTab('ventas')
    if (isMobile) setSidebarOpen(false)  // cerrar sidebar al navegar en mobile
  }

  // Exponer handleNav al window para que HomeView (accesos rápidos) pueda navegar
  useEffect(() => {
    ;(window as any).__msNav = (nav: string) => handleNav(nav as NavItem)
    return () => { delete (window as any).__msNav }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Drag-and-drop nav order ────────────────────────────────────────────────
  const [navOrder, setNavOrder] = useState<NavItem[]>([])
  const [dragId,   setDragId]   = useState<NavItem | null>(null)
  const [dropId,   setDropId]   = useState<NavItem | null>(null)

  // Load saved order from localStorage (after hydration)
  useEffect(() => {
    const middle = NAV.filter(i => !NAV_FIXED.has(i.id)).map(i => i.id)
    try {
      const saved = localStorage.getItem('microsmart-nav-order')
      if (saved) {
        const parsed: NavItem[] = JSON.parse(saved)
        const validSet = new Set(middle)
        const filtered = parsed.filter((id): id is NavItem => validSet.has(id))
        const savedSet = new Set(filtered)
        const missing = middle.filter(id => !savedSet.has(id))
        setNavOrder([...filtered, ...missing])
      } else {
        setNavOrder(middle)
      }
    } catch {
      setNavOrder(middle)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist order whenever it changes
  useEffect(() => {
    if (navOrder.length === 0) return
    try { localStorage.setItem('microsmart-nav-order', JSON.stringify(navOrder)) } catch {}
  }, [navOrder])

  const reorderNav = (from: NavItem, to: NavItem) => {
    if (NAV_FIXED.has(from) || NAV_FIXED.has(to) || from === to) return
    setNavOrder(prev => {
      const arr = [...prev]
      const fi = arr.indexOf(from)
      const ti = arr.indexOf(to)
      if (fi === -1 || ti === -1) return prev
      arr.splice(fi, 1)
      arr.splice(ti, 0, from)
      return arr
    })
  }

  // Build ordered nav list: inicio → middle (user order) → administracion
  const navMap = new Map(NAV.map(i => [i.id, i]))
  const orderedNAV = [
    ...(navMap.get('inicio') ? [navMap.get('inicio')!] : []),
    ...(navOrder.length > 0
      ? navOrder.map(id => navMap.get(id)).filter((i): i is typeof NAV[0] => i !== undefined)
      : NAV.filter(i => !NAV_FIXED.has(i.id))
    ),
    ...(navMap.get('administracion') ? [navMap.get('administracion')!] : []),
  ]

  const SIDEBAR_W = sidebarOpen ? 220 : 56

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────
  const Sidebar = (
    <>
    {/* Backdrop for mobile */}
    {isMobile && sidebarOpen && (
      <div onClick={() => setSidebarOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 98, backdropFilter: 'blur(2px)',
      }} />
    )}
    <aside style={{
      width: isMobile ? 260 : SIDEBAR_W,
      minHeight: '100vh',
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      ...(isMobile ? {
        position: 'fixed', top: 0, left: 0, zIndex: 99, height: '100dvh',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.2)' : 'none',
      } : {}),
      borderRight: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        padding: sidebarOpen ? '0 18px' : '0', justifyContent: sidebarOpen ? 'space-between' : 'center',
        borderBottom: '1px solid var(--border-light)', flexShrink: 0,
      }}>
        {sidebarOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #0066CC 0%, #0A84FF 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 2px 8px rgba(0,102,204,0.35)',
            }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>🍎</span>
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Microsmart</div>
              <div style={{ fontWeight: 400, fontSize: 10, letterSpacing: '0.02em', color: 'var(--text-dim)' }}>Especialistas Apple</div>
            </div>
          </div>
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #0066CC 0%, #0A84FF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,102,204,0.35)',
          }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>🍎</span>
          </div>
        )}
        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--surface2)', border: '1px solid var(--border-light)',
            cursor: 'pointer', color: 'var(--text-dim)', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface3)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >◀</button>
        )}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            position: 'absolute', bottom: 72, left: 0, right: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 11, padding: '8px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >▶</button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {orderedNAV.map(item => {
          const isActive = activeNav === item.id
          const isFixed = NAV_FIXED.has(item.id)
          const isDragging = dragId === item.id
          const isDropTarget = dropId === item.id && dragId !== null && !isFixed && dragId !== item.id
          return (
            <div
              key={item.id}
              draggable={!isFixed && sidebarOpen}
              onDragStart={e => {
                setDragId(item.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (!isFixed) setDropId(item.id)
              }}
              onDrop={e => {
                e.preventDefault()
                if (dragId && item.id && !isFixed) reorderNav(dragId, item.id)
                setDragId(null); setDropId(null)
              }}
              onDragEnd={() => { setDragId(null); setDropId(null) }}
              onDragLeave={() => { if (dropId === item.id) setDropId(null) }}
              style={{
                borderTop: isDropTarget ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: isDragging ? 0.3 : 1,
                transition: 'opacity 0.15s, border-color 0.1s',
              }}
            >
              <button
                onClick={() => handleNav(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 9, padding: (sidebarOpen || isMobile) ? '8px 10px 8px 10px' : '9px 0',
                  justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
                  background: isActive && selectedSupplierIds.size === 0
                    ? 'var(--accent-dim)' : 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  cursor: !isFixed && sidebarOpen ? 'grab' : 'pointer',
                  transition: 'all 0.15s',
                  color: isActive && selectedSupplierIds.size === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                  position: 'relative',
                  marginBottom: 2,
                }}
                onMouseEnter={e => {
                  if (!(isActive && selectedSupplierIds.size === 0))
                    e.currentTarget.style.background = 'var(--hover-bg)'
                }}
                onMouseLeave={e => {
                  if (!(isActive && selectedSupplierIds.size === 0))
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                {!isFixed && sidebarOpen && (
                  <span style={{ fontSize: 8, color: 'var(--text-dim)', position: 'absolute', left: 2, lineHeight: 1, letterSpacing: '-1px', opacity: 0.5 }}>⠿</span>
                )}
                <span style={{
                  fontSize: 16, flexShrink: 0, lineHeight: 1,
                  filter: isActive && selectedSupplierIds.size === 0 ? 'none' : 'grayscale(0.3)',
                  transition: 'filter 0.15s',
                }}>{item.icon}</span>
                {(sidebarOpen || isMobile) && (
                  <span style={{
                    fontSize: 13,
                    fontWeight: isActive && selectedSupplierIds.size === 0 ? 600 : 400,
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}>
                    {item.label}
                  </span>
                )}
                {item.id === 'notasdash' && pendingNotes > 0 && (
                  <span style={{
                    background: 'var(--accent)', color: '#FFFFFF',
                    borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    marginLeft: sidebarOpen ? 'auto' : undefined,
                    position: sidebarOpen ? 'relative' : 'absolute',
                    top: sidebarOpen ? undefined : 4, right: sidebarOpen ? undefined : 4,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {pendingNotes}
                  </span>
                )}
                {item.id === 'contable' && ccDeuda > 0 && (
                  <span style={{
                    background: '#f97316', color: '#FFFFFF',
                    borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    marginLeft: sidebarOpen ? 'auto' : undefined,
                    position: sidebarOpen ? 'relative' : 'absolute',
                    top: sidebarOpen ? undefined : 4, right: sidebarOpen ? undefined : 4,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {ccDeuda}
                  </span>
                )}
                {item.id === 'stock' && stockAlertas > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#FFFFFF',
                    borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    marginLeft: sidebarOpen ? 'auto' : undefined,
                    position: sidebarOpen ? 'relative' : 'absolute',
                    top: sidebarOpen ? undefined : 4, right: sidebarOpen ? undefined : 4,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {stockAlertas}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Bottom: theme toggle + logout */}
      <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border-light)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 9, padding: sidebarOpen ? '8px 10px' : '9px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            background: 'transparent', border: 'none', borderRadius: 10,
            cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{isDark ? '☀️' : '🌙'}</span>
          {sidebarOpen && (
            <span style={{ fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap' }}>
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 9, padding: sidebarOpen ? '8px 10px' : '9px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            background: 'transparent', border: 'none', borderRadius: 10,
            cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,59,48,0.07)'
            e.currentTarget.style.color = '#FF3B30'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3H9a2 2 0 0 0-2 2v4h2V5h11v14H9v-4H7v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
          </svg>
          {sidebarOpen && (
            <span style={{ fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap' }}>Cerrar sesión</span>
          )}
        </button>
      </div>
    </aside>
    </>
  )

  // ─── TOP BAR ──────────────────────────────────────────────────────────────
  const TopBar = (
    <header style={{
      height: 56,
      background: 'var(--nav-bg)',
      backdropFilter: 'var(--nav-blur)',
      WebkitBackdropFilter: 'var(--nav-blur)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex', alignItems: 'center',
      padding: isMobile ? '0 12px' : '0 20px',
      gap: isMobile ? 8 : 12, flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* Hamburger — mobile only */}
      {isMobile && (
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          width: 36, height: 36, borderRadius: 8, border: 'none',
          background: 'var(--surface2)', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4, flexShrink: 0,
        }}>
          <span style={{ width: 16, height: 2, background: 'var(--text-primary)', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 16, height: 2, background: 'var(--text-primary)', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 16, height: 2, background: 'var(--text-primary)', borderRadius: 2, display: 'block' }} />
        </button>
      )}
      {/* Search — pill style */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor"
          viewBox="0 0 24 24" style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-dim)', pointerEvents: 'none',
          }}>
          <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
        </svg>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); if (activeNav !== 'comparador') setActiveNav('comparador') }}
          placeholder="Buscar producto, código, modelo..."
          style={{
            width: '100%', padding: '8px 36px 8px 36px',
            background: 'var(--surface2)', border: '1px solid var(--border-light)',
            borderRadius: 999, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border-light)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--surface3)', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12, width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* Global search button — hidden on mobile */}
      <button
        onClick={() => setGlobalSearchOpen(true)}
        title="Búsqueda global (Ctrl+K)"
        style={{
          display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 999, fontSize: 12,
          background: 'var(--surface2)', border: '1px solid var(--border-light)',
          color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'all 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-dim)' }}
      >
        🔍
        <kbd style={{
          fontSize: 10, padding: '1px 5px', borderRadius: 4,
          background: 'var(--surface3)', border: '1px solid var(--border)',
          color: 'var(--text-dim)', fontFamily: 'inherit',
        }}>Ctrl K</kbd>
      </button>

      {/* Date — hidden on mobile */}
      <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', letterSpacing: '-0.01em', display: isMobile ? 'none' : undefined }}>
        {today}
      </div>

      {/* Refresh */}
      <button onClick={handleRefresh} disabled={refreshing} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
        background: 'var(--surface2)', border: '1px solid var(--border-light)',
        color: refreshing ? 'var(--text-dim)' : 'var(--text-secondary)',
        cursor: refreshing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (!refreshing) e.currentTarget.style.borderColor = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor"
          viewBox="0 0 24 24" style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>
          <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
        </svg>
        {refreshing ? 'Actualizando...' : 'Actualizar'}
      </button>

      {/* Notes btn — hidden on mobile */}
      <button onClick={() => setActiveNav('notasdash')} style={{
        display: isMobile ? 'none' : 'flex', position: 'relative', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
        background: activeNav === 'notasdash' ? 'var(--accent-dim)' : 'var(--surface2)',
        border: `1px solid ${activeNav === 'notasdash' ? 'var(--accent)' : 'var(--border-light)'}`,
        color: activeNav === 'notasdash' ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}>
        📋 Notas
        {pendingNotes > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: 'var(--accent)', color: '#FFFFFF', borderRadius: 99,
            fontSize: 9, fontWeight: 700, padding: '1px 5px',
            border: '2px solid var(--nav-bg)',
          }}>{pendingNotes}</span>
        )}
      </button>

      {/* Current user + settings */}
      {displayName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowSettings(true)}
            title="Configuración"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px 5px 5px', borderRadius: 999,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,204,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
          >
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0066CC, #0A84FF)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#FFFFFF',
              flexShrink: 0,
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{displayName}</span>
          </button>
        </div>
      )}
    </header>
  )

  // ─── CONTENT VIEWS ────────────────────────────────────────────────────────
  const MAX_SELECTED = 4
  const visibleSuppliers = selectedSupplierIds.size > 0
    ? comparadorSuppliers.filter(s => selectedSupplierIds.has(s.id))
    : comparadorSuppliers

  const handleToggleSupplier = (id: string) => {
    setSelectedSupplierIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      if (next.size >= MAX_SELECTED) return prev   // ya hay 4
      next.add(id)
      return next
    })
  }

  const ComparadorView = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Error banners */}
      {suppliers.filter(s => s.error).map(s => (
        <div key={s.id} style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5',
        }}>
          <strong>{s.name}:</strong> No se pudo cargar ({s.error}).
        </div>
      ))}

      {/* Chips de selección de proveedor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {comparadorSuppliers.map(s => {
            const isSelected = selectedSupplierIds.has(s.id)
            const isDisabled = !isSelected && selectedSupplierIds.size >= MAX_SELECTED
            return (
              <button
                key={s.id}
                onClick={() => handleToggleSupplier(s.id)}
                disabled={isDisabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px', borderRadius: 20, cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                  border: `2px solid ${isSelected ? s.color.border : '#333'}`,
                  background: isSelected ? s.color.bg : 'transparent',
                  color: isSelected ? s.color.text : '#676767',
                  opacity: isDisabled ? 0.35 : 1,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isSelected ? s.color.border : '#555', flexShrink: 0,
                }} />
                {s.name}
                {isSelected && (
                  <span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>
                )}
              </button>
            )
          })}
          {selectedSupplierIds.size > 0 && (
            <button
              onClick={() => setSelectedSupplierIds(new Set())}
              style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid #333',
                background: 'none', color: '#676767', fontSize: 12, cursor: 'pointer',
              }}
            >Limpiar</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {selectedSupplierIds.size === 0
            ? `Mostrando todos los proveedores · Seleccioná hasta ${MAX_SELECTED} para filtrar`
            : `${selectedSupplierIds.size} de ${MAX_SELECTED} seleccionados`}
        </div>
      </div>

      {/* Controls row: category filters + view toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {visibleSuppliers.length > 0 && merged.length > 0 && (
            <CategoryFilters rows={merged} active={activeCategories} onChange={setActiveCategories} />
          )}
        </div>

        {/* View toggle */}
        {visibleSuppliers.length > 0 && (
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            {([
              { id: 'columns', label: '☰ Por proveedor' },
              { id: 'merged',  label: '⊞ Comparar' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setViewMode(opt.id)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: viewMode === opt.id ? '#F5C400' : 'var(--surface2)',
                  color: viewMode === opt.id ? '#0c0d0f' : '#676767',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content by view mode */}
      {viewMode === 'columns' ? (
        <SupplierColumns
          suppliers={visibleSuppliers}
          search={search}
          activeCategories={activeCategories}
        />
      ) : (
        <PriceTable rows={rows} suppliers={visibleSuppliers} sort={sort} onSort={handleSort} search={search} />
      )}
    </div>
  )


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {Sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: isMobile ? '100%' : undefined }}>
        {TopBar}

        <main ref={mainRef} style={{ flex: 1, padding: isMobile ? 12 : 20, overflow: 'auto' }}>
          {activeNav === 'inicio' && (
            <HomeView key="inicio" displayName={displayName || currentUser} currentUser={currentUser} />
          )}
          {activeNav === 'comparador' && (
            <ListasPreciosView key="listas-precios" />
          )}
          {activeNav === 'proveedores' && <ProveedoresView key="proveedores" />}
          {activeNav === 'notasdash' && (
            <NotasBoard key="notasdash" onNotesChange={setPendingNotes} currentUserName={displayName || undefined} isSuperAdmin={isSuperAdmin} role={role} />
          )}
          {activeNav === 'imei' && <IMEIView key="imei" />}
          {activeNav === 'panic' && <PanicAnalyzerView key="panic" />}
          {activeNav === 'ordenes' && <OrdenesView key={`ordenes-${navSearch?.nav === 'ordenes' ? navSearch.term : ''}`} initialSearch={navSearch?.nav === 'ordenes' ? navSearch.term : ''} />}
          {activeNav === 'presupuestos' && <PresupuestosView key="presupuestos" />}
          {activeNav === 'servicios' && <ServiciosView key="servicios" />}
          {activeNav === 'agenda' && <TurnosView key="agenda" />}
          {activeNav === 'stock' && <StockMainView key="stock" onAlertCountChange={setStockAlertas} />}
          {activeNav === 'comisiones' && <ComisionesView key="comisiones" />}
          {activeNav === 'clientes' && <ClientesView key={`clientes-${navSearch?.nav === 'clientes' ? navSearch.term : ''}`} initialSearch={navSearch?.nav === 'clientes' ? navSearch.term : ''} />}
          {activeNav === 'contable' && (
            <div key="contable">
              {/* Sub-pestañas: Ventas / Gastos / Reportes */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
                {([
                  { id: 'ventas'      as const, label: '💵 Ventas',       show: p.canViewVentas      && (modulesCfg ? modulesCfg['ventas']      !== false : true) },
                  { id: 'gastos'      as const, label: '🧾 Gastos',       show: p.canViewGastos      && (modulesCfg ? modulesCfg['gastos']      !== false : true) },
                  { id: 'comisiones'  as const, label: '👤 Comisiones',   show: p.canViewComisiones  && (modulesCfg ? modulesCfg['comisiones']  !== false : true) },
                  { id: 'reportes'    as const, label: '📊 Reportes',     show: p.canViewReportes    && (modulesCfg ? modulesCfg['reportes']    !== false : true) },
                  { id: 'caja-diaria'       as const, label: '🏧 Caja Diaria',       show: true },
                  { id: 'cuenta-corriente' as const, label: '💳 Cuenta Corriente', show: true },
                  { id: 'mercadopago'      as const, label: '💳 MercadoPago',       show: true },
                ] as const).filter(t => t.show).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setContableSubTab(tab.id)}
                    style={{
                      padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                      fontWeight: contableSubTab === tab.id ? 700 : 500,
                      background: 'none', marginBottom: -1,
                      borderBottom: contableSubTab === tab.id ? '2px solid #a78bfa' : '2px solid transparent',
                      color: contableSubTab === tab.id ? '#a78bfa' : '#8A8A8A',
                      transition: 'all 0.15s',
                    }}
                  >{tab.label}</button>
                ))}
              </div>
              {contableSubTab === 'ventas'      && <VentasMainView key="ventas" />}
              {contableSubTab === 'gastos'      && <GastosMainView key="gastos" />}
              {contableSubTab === 'comisiones'  && <ComisionesView key="comisiones" />}
              {contableSubTab === 'reportes'    && <ReportesMainView key="reportes" />}
              {contableSubTab === 'caja-diaria'       && <CajaDiariaView key="caja-diaria" currentUser={displayName || currentUser} role={role} />}
              {contableSubTab === 'cuenta-corriente'  && <CuentaCorrienteView key="cuenta-corriente" />}
              {contableSubTab === 'mercadopago'       && <MercadoPagoView key="mercadopago" />}
            </div>
          )}
          {activeNav === 'ventas-equipos' && <VentasEquiposView key="ventas-equipos" />}
          {activeNav === 'caja' && <CajaView key="caja" currentUser={displayName || currentUser} role={role} />}
          {activeNav === 'administracion' && <AdminView key="administracion" onModulosChange={handleModulosChange} onModulosSaved={handleModulosSaved} />}
        </main>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          currentUser={currentUser}
          displayName={displayName}
          role={role}
          onNameChange={setDisplayName}
          onClose={() => setShowSettings(false)}
        />
      )}

      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={handleGlobalNavigate}
      />

      <NotaRapidaFloat />

<style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
