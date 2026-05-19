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
import GremioView from './GremioView'
import CFView from './CFView'
import SettingsModal from './SettingsModal'
import AdminView from './AdminView'
import HomeView from './HomeView'
import IMEIView from './IMEIView'
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

type NavItem = 'inicio' | 'comparador' | 'proveedores' | 'notas' | 'notasdash' | 'cf' | 'gremio' | 'imei' | 'administracion' | 'agenda' | 'stock' | 'gastos' | 'reportes' | 'ventas' | 'comisiones' | 'clientes' | 'ordenes' | 'servicios' | 'contable'

const ALL_NAV: { id: NavItem; label: string; icon: string; permKey?: keyof Permissions; adminOnly?: boolean }[] = [
  { id: 'inicio',         label: 'Inicio',                   icon: '🏠' },
  { id: 'comparador',     label: 'Listas de precio',         icon: '📊', permKey: 'canViewComparador' },
  { id: 'proveedores',    label: 'Proveedores',              icon: '🏢', permKey: 'canViewProveedores' },
  { id: 'notasdash',      label: 'Tareas y Pedidos',         icon: '📋', permKey: 'canViewNotas' },
  { id: 'imei',           label: 'Verificar IMEI',           icon: '🔍', permKey: 'canViewIMEI' },
  { id: 'ordenes',        label: 'Órdenes de trabajo',       icon: '🔧', permKey: 'canViewOrdenes' },
  { id: 'servicios',      label: 'Servicios',                icon: '🛠', permKey: 'canViewServicios' },
  { id: 'clientes',       label: 'Clientes',                 icon: '👥', permKey: 'canViewClientes' },
  { id: 'agenda',         label: 'Turnos',                   icon: '📅', permKey: 'canViewAgenda' },
  { id: 'stock',          label: 'Stock',                    icon: '📦', permKey: 'canViewStock' },
  { id: 'contable',       label: 'Administración contable',  icon: '📒' },
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
  const NAV = ALL_NAV.filter(item => {
    if (item.adminOnly && !isSuperAdmin) return false
    if (item.permKey && !p[item.permKey]) return false
    // Respetar configuración de módulos (solo para no-protegidos)
    if (modulosConfig && !PROTECTED_MODULES.has(item.id) && modulosConfig[item.id] === false) return false
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
  const [activeCategories, setActiveCategories] = useState<Set<AppleCategory>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeNav, setActiveNav] = useState<NavItem>('inicio')
  const [isDark, setIsDark] = useState(false)
  const [comparadorSubTab, setComparadorSubTab] = useState<'comparador' | 'gremio' | 'cf'>('comparador')
  const [contableSubTab, setContableSubTab] = useState<'ventas' | 'gastos' | 'reportes' | 'comisiones'>('ventas')
  const [viewMode, setViewMode] = useState<'merged' | 'columns'>('columns')
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set())
  const mainRef = useRef<HTMLElement>(null)

  // Reset scroll al inicio cada vez que se cambia de pestaña o sub-pestaña
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [activeNav, comparadorSubTab, contableSubTab])

  // Theme: load from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('microsmart-theme')
      const dark = saved === 'dark'
      setIsDark(dark)
      document.documentElement.classList.toggle('dark', dark)
    } catch {}
  }, [])

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

  const activeSuppliers = suppliers.filter(s => s.items.length > 0)
  // Gremio has its own dedicated tab — exclude it from the comparador
  const comparadorSuppliers = activeSuppliers.filter(s => s.id !== 'gremio')

  const merged = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>()
    for (const s of comparadorSuppliers) {
      for (const item of s.items) {
        const key = item.name.toLowerCase().trim()
        if (!map.has(key))
          map.set(key, { key, name: item.name, code: item.code, category: item.category, prices: {}, stocks: {} })
        const row = map.get(key)!
        row.prices[s.id] = item.price
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
    if (id !== 'comparador') setSelectedSupplierIds(new Set())
    if (id === 'comparador') setComparadorSubTab('comparador')
    if (id === 'contable') setContableSubTab('ventas')
  }

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
    <aside style={{
      width: SIDEBAR_W, minHeight: '100vh',
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
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
                  gap: 9, padding: sidebarOpen ? '8px 10px 8px 10px' : '9px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
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
                {sidebarOpen && (
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
      padding: '0 20px', gap: 12, flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
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

      {/* Date */}
      <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
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

      {/* Notes btn */}
      <button onClick={() => setActiveNav('notasdash')} style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
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

  const ProveedoresView = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E5E5E3', marginBottom: 4 }}>Proveedores</h2>
        <p style={{ fontSize: 13, color: '#676767' }}>
          Gestioná tus fuentes de precios. Los proveedores integrados se actualizan automáticamente.
        </p>
      </div>

      {/* Supplier cards */}
      {suppliers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface)', border: `1px solid ${s.color.border}44`,
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: s.color.bg, border: `1px solid ${s.color.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {s.source === 'builtin' ? '🏢' : '📁'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#E5E5E3' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: s.color.text }}>
                    {s.source === 'builtin' ? 'Integrado · auto-actualiza' : 'Cargado manualmente'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#676767' }}>
                  <span style={{ color: '#E5E5E3', fontWeight: 600 }}>{s.items.length}</span>{' '}productos
                </span>
                {s.error ? (
                  <span style={{ fontSize: 11, color: '#f87171' }}>⚠ Error</span>
                ) : (
                  <span style={{ fontSize: 11, color: '#4ade80' }}>✓ OK</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier name chips + remove */}
      {suppliers.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#676767' }}>Gestionar proveedores</div>
          <SupplierChips suppliers={suppliers} onRemove={handleSupplierRemove} onRename={handleSupplierRename} />
        </>
      )}

      {/* Upload — only for users with permission */}
      {p.canUploadSuppliers && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#676767', marginBottom: 8 }}>Agregar proveedor</div>
          <UploadZone onSupplierAdd={handleSupplierAdd} supplierCount={suppliers.length} />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {Sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {TopBar}

        <main ref={mainRef} style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          {activeNav === 'inicio' && (
            <HomeView key="inicio" displayName={displayName || currentUser} currentUser={currentUser} />
          )}
          {activeNav === 'comparador' && (
            <div key="comparador">
              {/* Sub-pestañas: Comparador / Gremio / Consumidor Final */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {[
                  { id: 'comparador' as const, label: '📊 Proveedores' },
                  ...(p.canViewGremio ? [{ id: 'gremio' as const, label: '🔧 Gremio' }] : []),
                  ...(p.canViewCF    ? [{ id: 'cf'    as const, label: '💰 Consumidor Final' }] : []),
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setComparadorSubTab(tab.id)}
                    style={{
                      padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: comparadorSubTab === tab.id ? 700 : 500,
                      background: 'none', marginBottom: -1,
                      borderBottom: comparadorSubTab === tab.id ? '2px solid #60a5fa' : '2px solid transparent',
                      color: comparadorSubTab === tab.id ? '#60a5fa' : '#8A8A8A',
                      transition: 'all 0.15s',
                    }}
                  >{tab.label}</button>
                ))}
              </div>
              {comparadorSubTab === 'comparador' && ComparadorView}
              {comparadorSubTab === 'gremio'     && <GremioView key="gremio" />}
              {comparadorSubTab === 'cf'         && <CFView key="cf" />}
            </div>
          )}
          {activeNav === 'proveedores' && ProveedoresView}
          {activeNav === 'notasdash' && (
            <NotasBoard key="notasdash" onNotesChange={setPendingNotes} currentUserName={displayName || undefined} isSuperAdmin={isSuperAdmin} />
          )}
          {activeNav === 'imei' && <IMEIView key="imei" />}
          {activeNav === 'ordenes' && <OrdenesView key="ordenes" />}
          {activeNav === 'servicios' && <ServiciosView key="servicios" />}
          {activeNav === 'agenda' && <TurnosView key="agenda" />}
          {activeNav === 'stock' && <StockMainView key="stock" />}
          {activeNav === 'comisiones' && <ComisionesView key="comisiones" />}
          {activeNav === 'clientes' && <ClientesView key="clientes" />}
          {activeNav === 'contable' && (
            <div key="contable">
              {/* Sub-pestañas: Ventas / Gastos / Reportes */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
                {([
                  { id: 'ventas'     as const, label: '💵 Ventas',      show: p.canViewVentas      && (modulosConfig ? modulosConfig['ventas']      !== false : true) },
                  { id: 'gastos'     as const, label: '🧾 Gastos',      show: p.canViewGastos      && (modulosConfig ? modulosConfig['gastos']      !== false : true) },
                  { id: 'comisiones' as const, label: '👤 Comisiones',  show: p.canViewComisiones  && (modulosConfig ? modulosConfig['comisiones']  !== false : true) },
                  { id: 'reportes'   as const, label: '📊 Reportes',    show: p.canViewReportes    && (modulosConfig ? modulosConfig['reportes']    !== false : true) },
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
              {contableSubTab === 'ventas'     && <VentasMainView key="ventas" />}
              {contableSubTab === 'gastos'     && <GastosMainView key="gastos" />}
              {contableSubTab === 'comisiones' && <ComisionesView key="comisiones" />}
              {contableSubTab === 'reportes'   && <ReportesMainView key="reportes" />}
            </div>
          )}
          {activeNav === 'administracion' && <AdminView key="administracion" />}
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

<style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
