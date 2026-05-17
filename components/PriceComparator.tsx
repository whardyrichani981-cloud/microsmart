'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
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

interface Props { initialSuppliers: Supplier[]; currentUser?: string; initialDisplayName?: string }
export type SortState = { col: string; dir: 1 | -1 }

type NavItem = 'comparador' | 'proveedores' | 'notas' | 'notasdash' | 'cf' | 'gremio'

const NAV: { id: NavItem; label: string; icon: string }[] = [
  { id: 'comparador',  label: 'Listas de precio', icon: '📊' },
  { id: 'gremio',      label: 'Gremio',           icon: '🔧' },
  { id: 'cf',          label: 'Consumidor Final',  icon: '💰' },
  { id: 'proveedores', label: 'Proveedores',       icon: '🏢' },
  { id: 'notasdash',   label: 'Notas',             icon: '📋' },
]

export default function PriceComparator({ initialSuppliers, currentUser = '', initialDisplayName = '' }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName || currentUser)
  const [showSettings, setShowSettings] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ col: 'name', dir: 1 })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingNotes, setPendingNotes] = useState(0)
  const [activeCategories, setActiveCategories] = useState<Set<AppleCategory>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeNav, setActiveNav] = useState<NavItem>('comparador')
  const [viewMode, setViewMode] = useState<'merged' | 'columns'>('columns')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)

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

  const merged = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>()
    for (const s of activeSuppliers) {
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
  }, [activeSuppliers])

  const rows = useMemo(() => {
    const terms = expandQuery(search)
    let filtered = merged
    if (selectedSupplierId)
      filtered = filtered.filter(r => r.prices[selectedSupplierId] != null)
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
  }, [merged, search, sort, activeCategories, selectedSupplierId])

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

  const handleOpenSettings = () => {
    setNameInput(displayName)
    setNameError('')
    setShowSettings(true)
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) { setNameError('El nombre no puede estar vacío'); return }
    setNameSaving(true)
    setNameError('')
    try {
      const res = await fetch('/api/users/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error') }
      setDisplayName(nameInput.trim())
      setShowSettings(false)
    } catch (e) {
      setNameError(String(e))
    } finally {
      setNameSaving(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/suppliers')
      const fresh: Supplier[] = await res.json()
      setSuppliers(prev => [...fresh, ...prev.filter(s => s.source === 'upload')])
    } finally { setRefreshing(false) }
  }

  const handleNav = (id: NavItem) => {
    setActiveNav(id)
    if (id !== 'comparador') setSelectedSupplierId(null)
  }

  const SIDEBAR_W = sidebarOpen ? 220 : 56

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────
  const Sidebar = (
    <aside style={{
      width: SIDEBAR_W, minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.22s ease',
      flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center',
        padding: sidebarOpen ? '0 18px' : '0', justifyContent: sidebarOpen ? 'space-between' : 'center',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {sidebarOpen && (
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5, color: '#818cf8', whiteSpace: 'nowrap' }}>
            Micro<span style={{ color: '#4ade80' }}>smart</span>
          </div>
        )}
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#7c85a2', fontSize: 16, padding: 4, lineHeight: 1,
          display: 'flex', alignItems: 'center',
        }}>
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          const isActive = activeNav === item.id
          const isNotes = item.id === 'notasdash'
          const isListas = item.id === 'comparador'
          return (
            <div key={item.id}>
              <button
                onClick={() => handleNav(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: sidebarOpen ? '10px 18px' : '10px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  background: isActive && !selectedSupplierId ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive && !selectedSupplierId ? '3px solid #6366f1' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  color: isActive ? '#818cf8' : '#7c85a2',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!(isActive && !selectedSupplierId)) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!(isActive && !selectedSupplierId)) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && (
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                )}
                {isNotes && pendingNotes > 0 && (
                  <span style={{
                    background: '#6366f1', color: '#fff', borderRadius: 10,
                    fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    marginLeft: sidebarOpen ? 'auto' : undefined,
                    position: sidebarOpen ? 'relative' : 'absolute',
                    top: sidebarOpen ? undefined : 6, right: sidebarOpen ? undefined : 6,
                  }}>
                    {pendingNotes}
                  </span>
                )}
              </button>

              {/* Supplier sub-items under "Listas de precio" */}
              {isListas && activeSuppliers.length > 0 && (
                <div style={{ overflow: 'hidden' }}>
                  {activeSuppliers.filter(s => s.id !== 'gremio').map(s => {
                    const isSubActive = activeNav === 'comparador' && selectedSupplierId === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setActiveNav('comparador'); setSelectedSupplierId(s.id) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          gap: 8,
                          padding: sidebarOpen ? '7px 18px 7px 38px' : '7px 0',
                          justifyContent: sidebarOpen ? 'flex-start' : 'center',
                          background: isSubActive ? `${s.color.border}22` : 'transparent',
                          border: 'none',
                          borderLeft: isSubActive ? `3px solid ${s.color.border}` : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!isSubActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { if (!isSubActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: s.color.border, flexShrink: 0,
                        }} />
                        {sidebarOpen && (
                          <>
                            <span style={{
                              fontSize: 12, color: isSubActive ? s.color.text : '#94a3b8',
                              fontWeight: isSubActive ? 600 : 400,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              flex: 1, textAlign: 'left',
                            }}>
                              {s.name}
                            </span>
                            <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>
                              {s.items.length}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: total products + logout */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {sidebarOpen && merged.length > 0 && (
          <div style={{ padding: '10px 18px', fontSize: 11, color: '#475569' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{merged.length}</span>{' '}productos totales
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 8, padding: sidebarOpen ? '12px 18px' : '12px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#7c85a2', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            e.currentTarget.style.color = '#fca5a5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = '#7c85a2'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3H9a2 2 0 0 0-2 2v4h2V5h11v14H9v-4H7v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
          </svg>
          {sidebarOpen && (
            <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>Cerrar sesión</span>
          )}
        </button>
      </div>
    </aside>
  )

  // ─── TOP BAR ──────────────────────────────────────────────────────────────
  const TopBar = (
    <header style={{
      height: 52, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12, flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor"
          viewBox="0 0 24 24" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7c85a2', pointerEvents: 'none' }}>
          <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
        </svg>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); if (activeNav !== 'comparador') setActiveNav('comparador') }}
          placeholder="Buscar producto, código, modelo..."
          style={{
            width: '100%', padding: '7px 12px 7px 32px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#7c85a2', cursor: 'pointer', fontSize: 14,
          }}>×</button>
        )}
      </div>

      {/* Date */}
      <div style={{ fontSize: 12, color: '#7c85a2', whiteSpace: 'nowrap' }}>
        📅 {today}
      </div>

      {/* Current user + settings */}
      {displayName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            whiteSpace: 'nowrap',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#6366f1', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>{displayName}</span>
          </div>
          <button
            onClick={handleOpenSettings}
            title="Configuración"
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: '#7c85a2', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.borderColor = '#6366f1' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7c85a2'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.36 2.54a7.37 7.37 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.63 8.48a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.36 1.04.67 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54a7.37 7.37 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Stats pill */}
      {merged.length > 0 && (
        <div style={{
          fontSize: 12, whiteSpace: 'nowrap',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 10px',
          color: '#e2e8f0', fontWeight: 600,
        }}>
          {rows.length !== merged.length
            ? `${rows.length} / ${merged.length} productos`
            : `${merged.length} productos`}
        </div>
      )}

      {/* Refresh */}
      <button onClick={handleRefresh} disabled={refreshing} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: refreshing ? '#7c85a2' : '#e2e8f0', cursor: refreshing ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor"
          viewBox="0 0 24 24" style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>
          <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
        </svg>
        {refreshing ? 'Actualizando...' : 'Actualizar'}
      </button>

      {/* Notes btn */}
      <button onClick={() => setActiveNav('notasdash')} style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: activeNav === 'notasdash' ? 'rgba(99,102,241,0.2)' : 'var(--surface2)',
        border: `1px solid ${activeNav === 'notasdash' ? '#6366f1' : 'var(--border)'}`,
        color: '#e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        📋 Notas
        {pendingNotes > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#6366f1', color: '#fff', borderRadius: 10,
            fontSize: 9, fontWeight: 700, padding: '1px 5px',
            border: '2px solid var(--bg)',
          }}>{pendingNotes}</span>
        )}
      </button>
    </header>
  )

  // ─── CONTENT VIEWS ────────────────────────────────────────────────────────
  const visibleSuppliers = selectedSupplierId
    ? activeSuppliers.filter(s => s.id === selectedSupplierId)
    : activeSuppliers

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
                  background: viewMode === opt.id ? '#6366f1' : 'var(--surface2)',
                  color: viewMode === opt.id ? '#fff' : '#7c85a2',
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
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Proveedores</h2>
        <p style={{ fontSize: 13, color: '#7c85a2' }}>
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
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: s.color.text }}>
                    {s.source === 'builtin' ? 'Integrado · auto-actualiza' : 'Cargado manualmente'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#7c85a2' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.items.length}</span>{' '}productos
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
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7c85a2' }}>Gestionar proveedores</div>
          <SupplierChips suppliers={suppliers} onRemove={handleSupplierRemove} onRename={handleSupplierRename} />
        </>
      )}

      {/* Upload */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7c85a2', marginBottom: 8 }}>Agregar proveedor</div>
        <UploadZone onSupplierAdd={handleSupplierAdd} supplierCount={suppliers.length} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {Sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {TopBar}

        <main style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          {activeNav === 'comparador' && ComparadorView}
          {activeNav === 'gremio' && <GremioView />}
          {activeNav === 'cf' && <CFView />}
          {activeNav === 'proveedores' && ProveedoresView}
          {activeNav === 'notasdash' && (
            <NotasBoard onNotesChange={setPendingNotes} />
          )}
        </main>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{
            width: 400, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#818cf8" viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.36 2.54a7.37 7.37 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.63 8.48a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.36 1.04.67 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54a7.37 7.37 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
                </svg>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Configuración</span>
              </div>
              <button onClick={() => setShowSettings(false)} style={{
                background: 'none', border: 'none', color: '#7c85a2',
                cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
              }}>×</button>
            </div>

            {/* User info */}
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              marginBottom: 20, fontSize: 12, color: '#7c85a2',
            }}>
              Usuario: <span style={{ color: '#818cf8', fontWeight: 600 }}>{currentUser}</span>
            </div>

            {/* Name field */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
                Nombre para mostrar
              </label>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                placeholder="Tu nombre completo"
                style={{
                  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none',
                }}
              />
            </div>

            {nameError && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
                background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5',
              }}>
                {nameError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowSettings(false)} style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: '#7c85a2', cursor: 'pointer', fontSize: 13,
              }}>
                Cancelar
              </button>
              <button onClick={handleSaveName} disabled={nameSaving} style={{
                padding: '9px 18px', borderRadius: 8, border: 'none',
                background: nameSaving ? '#4f46e5' : '#6366f1',
                color: '#fff', cursor: nameSaving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: nameSaving ? 0.8 : 1,
              }}>
                {nameSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

<style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #7c85a2; }
        input:focus { border-color: #6366f1 !important; }
      `}</style>
    </div>
  )
}
