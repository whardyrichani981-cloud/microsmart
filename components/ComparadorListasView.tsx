'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Supplier, MergedRow, SortState } from '@/lib/types'
import type { AppleCategory } from '@/lib/categories'
import { COLORS } from '@/lib/colors'
import { expandQuery, matchesQuery } from '@/lib/search'
import PriceTable from './PriceTable'
import SupplierColumns from './SupplierColumns'
import CategoryFilters from './CategoryFilters'

const MAX_SELECTED = 4

// ── API types ─────────────────────────────────────────────────────────────────
interface SistemaProveedor {
  id: string
  nombre: string
}

interface BuiltinSupplier {
  id: string
  name: string
  items: { name: string; code: string; price: number; stock?: string; category?: string }[]
  error?: string
}

interface ListaConItems {
  filename: string
  items: number
  updatedAt: string
  itemsData: { name: string; code: string; price: number; stock?: string; category?: string }[]
}

/** Normalize name for matching: "BH Tech" → "bhtech" */
function normName(s: string) {
  return s.toLowerCase().replace(/[\s\-_]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ComparadorListasView() {
  const [sistemaProvs, setSistemaProvs]   = useState<SistemaProveedor[]>([])
  const [builtins, setBuiltins]           = useState<BuiltinSupplier[]>([])
  const [uploadedListas, setUploadedListas] = useState<Record<string, ListaConItems>>({})
  const [loading, setLoading]             = useState(true)

  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [search, setSearch]                 = useState('')
  const [sort, setSort]                     = useState<SortState>({ col: 'name', dir: 1 })
  const [viewMode, setViewMode]             = useState<'columns' | 'merged'>('columns')
  const [activeCategories, setActiveCategories] = useState<Set<AppleCategory>>(new Set())

  // ── Load all data ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        // 1. System providers (source of truth — includes user-added ones)
        const provsRes = await fetch('/api/sistema/proveedores', { cache: 'no-store' })
        const provs: SistemaProveedor[] = provsRes.ok ? await provsRes.json() : []
        setSistemaProvs(provs)

        // 2. Builtin supplier data (BH Tech, Cparts, Pineapple items)
        const suppRes = await fetch('/api/suppliers', { cache: 'no-store' })
        const suppData: BuiltinSupplier[] = suppRes.ok ? await suppRes.json() : []
        setBuiltins(suppData.filter(s => s.id !== 'gremio' && s.id !== 'cf'))

        // 3. Uploaded lista metas — then eagerly fetch items for each
        const metaRes = await fetch('/api/sistema/proveedores/listas', { cache: 'no-store' })
        if (metaRes.ok) {
          const metas: Record<string, { filename: string; items: number; updatedAt: string }> = await metaRes.json()
          const ids = Object.keys(metas)
          if (ids.length > 0) {
            const fetches = ids.map(id =>
              fetch(`/api/sistema/proveedores/${id}/lista`, { cache: 'no-store' })
                .then(r => r.ok ? r.json() : null)
                .then((data: ListaConItems | null) => data ? [id, data] as const : null)
                .catch(() => null)
            )
            const results = await Promise.all(fetches)
            const uploads: Record<string, ListaConItems> = {}
            for (const res of results) {
              if (res) uploads[res[0]] = res[1]
            }
            setUploadedListas(uploads)
          }
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    loadAll()
  }, [])

  // ── Build Supplier[] from system providers ────────────────────────────────
  // For each system provider: prefer uploaded list, fall back to builtin match
  const suppliers = useMemo<Supplier[]>(() => {
    const result: Supplier[] = []

    for (const prov of sistemaProvs) {
      const normProv = normName(prov.nombre)

      // Prefer uploaded items
      const uploaded = uploadedListas[prov.id]
      const uploadedItems = uploaded?.itemsData ?? []

      // Fallback: find a builtin whose name matches this provider
      const builtin = builtins.find(b => normName(b.name) === normProv)
      const builtinItems = builtin?.items ?? []

      const items = uploadedItems.length > 0 ? uploadedItems : builtinItems
      if (items.length === 0) continue  // skip providers with no list at all

      const colorIdx = result.length % COLORS.length
      result.push({
        id: prov.id,
        name: prov.nombre,
        items,
        color: COLORS[colorIdx],
        source: uploadedItems.length > 0 ? 'upload' : 'builtin',
        error: builtin?.error,
      })
    }

    return result
  }, [sistemaProvs, builtins, uploadedListas])

  // ── Supplier selection ────────────────────────────────────────────────────
  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECTED) return prev
        next.add(id)
      }
      return next
    })
  }, [])

  const visibleSuppliers = selectedIds.size > 0
    ? suppliers.filter(s => selectedIds.has(s.id))
    : suppliers

  // ── Merge rows ────────────────────────────────────────────────────────────
  const merged = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>()
    for (const s of visibleSuppliers) {
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
  }, [visibleSuppliers])

  // ── Filter & sort rows ────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const terms = expandQuery(search)
    let filtered = merged
    if (terms.length) filtered = filtered.filter(r =>
      matchesQuery(r.name, terms) || matchesQuery(r.code, terms))
    if (activeCategories.size > 0)
      filtered = filtered.filter(r => activeCategories.has((r.category ?? 'otros') as AppleCategory))
    return [...filtered].sort((a, b) => {
      if (sort.col === 'name') return sort.dir * a.name.localeCompare(b.name, 'es')
      if (sort.col === 'best') {
        const ba = Object.values(a.prices).length ? Math.min(...Object.values(a.prices)) : Infinity
        const bb = Object.values(b.prices).length ? Math.min(...Object.values(b.prices)) : Infinity
        return sort.dir * (ba - bb)
      }
      return sort.dir * ((a.prices[sort.col] ?? Infinity) - (b.prices[sort.col] ?? Infinity))
    })
  }, [merged, search, sort, activeCategories])

  const handleSort = useCallback((col: string) =>
    setSort(s => s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }), [])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#676767', gap: 10 }}>
        <div style={{
          width: 16, height: 16, border: '2px solid #333',
          borderTopColor: '#60a5fa', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <span style={{ fontSize: 14 }}>Cargando listas de proveedores…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#676767' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📦</div>
        <p style={{ fontWeight: 600, color: '#E5E5E3', marginBottom: 6 }}>Ningún proveedor tiene lista cargada</p>
        <p style={{ fontSize: 13 }}>Subí una lista desde el <strong style={{ color: '#60a5fa' }}>Directorio</strong> para poder comparar.</p>
      </div>
    )
  }

  return (
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

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, pointerEvents: 'none', opacity: 0.4,
        }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto o código…"
          style={{
            width: '100%', boxSizing: 'border-box',
            paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface2)', color: '#E5E5E3',
            fontSize: 14, outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#676767',
              cursor: 'pointer', fontSize: 16, padding: '0 4px',
            }}
          >✕</button>
        )}
      </div>

      {/* Supplier chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {suppliers.map(s => {
            const isSelected = selectedIds.has(s.id)
            const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTED
            return (
              <button
                key={s.id}
                onClick={() => handleToggle(s.id)}
                disabled={isDisabled}
                title={s.source === 'upload' ? 'Lista propia subida' : 'Lista integrada'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px', borderRadius: 20,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
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
                {s.source === 'upload' && (
                  <span title="Lista propia" style={{ fontSize: 10, opacity: 0.5 }}>↑</span>
                )}
                {isSelected && <span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>}
              </button>
            )
          })}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid #333',
                background: 'none', color: '#676767', fontSize: 12, cursor: 'pointer',
              }}
            >Limpiar</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {selectedIds.size === 0
            ? `${suppliers.length} proveedor${suppliers.length !== 1 ? 'es' : ''} · Seleccioná hasta ${MAX_SELECTED} para comparar`
            : `${selectedIds.size} de ${MAX_SELECTED} seleccionados · ${rows.length} productos`}
        </div>
      </div>

      {/* Category filters + view toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {visibleSuppliers.length > 0 && merged.length > 0 && (
            <CategoryFilters rows={merged} active={activeCategories} onChange={setActiveCategories} />
          )}
        </div>

        {visibleSuppliers.length > 0 && (
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            {([
              { id: 'columns' as const, label: '☰ Por proveedor' },
              { id: 'merged'  as const, label: '⊞ Comparar' },
            ]).map(opt => (
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

      {/* Main content */}
      {viewMode === 'columns' ? (
        <SupplierColumns
          suppliers={visibleSuppliers}
          search={search}
          activeCategories={activeCategories}
        />
      ) : (
        <PriceTable
          rows={rows}
          suppliers={visibleSuppliers}
          sort={sort}
          onSort={handleSort}
          search={search}
        />
      )}
    </div>
  )
}
