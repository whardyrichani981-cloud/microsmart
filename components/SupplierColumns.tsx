'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Supplier, SupplierItem } from '@/lib/types'
import { CATEGORY_META, CATEGORY_ORDER, type AppleCategory } from '@/lib/categories'
import { expandQuery, matchesQuery } from '@/lib/search'

interface Props {
  suppliers: Supplier[]
  search: string
  activeCategories: Set<AppleCategory>
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'USD',
    currencyDisplay: 'symbol', maximumFractionDigits: 2,
  }).format(n)
}

function highlight(text: string, terms: string[][]) {
  const flat = terms.flat()
  if (!flat.length) return text
  let best = { idx: -1, len: 0 }
  const lower = text.toLowerCase()
  for (const t of flat) {
    const i = lower.indexOf(t)
    if (i !== -1 && (best.idx === -1 || t.length > best.len)) best = { idx: i, len: t.length }
  }
  if (best.idx === -1) return text
  return (
    text.slice(0, best.idx) +
    `<mark style="background:rgba(245,196,0,0.35);color:inherit;border-radius:2px;padding:0 1px">${text.slice(best.idx, best.idx + best.len)}</mark>` +
    text.slice(best.idx + best.len)
  )
}

function ItemCard({ item, terms }: { item: SupplierItem; terms: string[][] }) {
  const isOut = /sin\s*stock/i.test(item.stock ?? '')
  const isIngresando = /ingresando/i.test(item.stock ?? '')

  return (
    <div
      style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      {/* Name */}
      <div
        style={{ color: '#E5E5E3', fontSize: 13, fontWeight: 500, lineHeight: 1.35, marginBottom: 3 }}
        dangerouslySetInnerHTML={{ __html: highlight(item.name, terms) }}
      />

      {/* Code */}
      {item.code && (
        <div style={{ fontSize: 11, color: '#484848', marginBottom: 4 }}
          dangerouslySetInnerHTML={{ __html: highlight(item.code, terms) }} />
      )}

      {/* Price + stock */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 15, fontWeight: 700, fontFamily: 'monospace',
          color: isOut ? '#484848' : '#4ade80',
          textDecoration: isOut ? 'line-through' : 'none',
        }}>
          {fmt(item.price)}
        </span>
        {isOut && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', color: '#f87171',
            border: '1px solid rgba(248,113,113,0.2)', whiteSpace: 'nowrap',
          }}>Sin stock</span>
        )}
        {isIngresando && !isOut && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
            background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
            border: '1px solid rgba(251,191,36,0.2)', whiteSpace: 'nowrap',
          }}>Ingresando</span>
        )}
        {!isOut && !isIngresando && item.stock && item.stock !== 'En stock' && (
          <span style={{ fontSize: 10, color: '#484848' }}>{item.stock}</span>
        )}
      </div>
    </div>
  )
}

// ─── Category section within a column ────────────────────────────────────────
function CategorySection({
  cat, items, terms, defaultCollapsed,
}: {
  cat: AppleCategory
  items: SupplierItem[]
  terms: string[][]
  defaultCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const meta = CATEGORY_META[cat]

  // Sort items alphabetically within each category
  const sorted = useMemo(() =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [items]
  )

  return (
    <div>
      {/* Category header — click to collapse */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px',
          background: meta.bg,
          borderTop: `1px solid ${meta.color}22`,
          borderBottom: `1px solid ${meta.color}22`,
          cursor: 'pointer',
          userSelect: 'none',
          position: 'sticky', top: 0, zIndex: 2,
        }}
      >
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 12, color: meta.color, flex: 1 }}>
          {meta.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
          background: meta.color + '22', color: meta.color,
        }}>
          {items.length}
        </span>
        <span style={{ fontSize: 11, color: meta.color, opacity: 0.6 }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {!collapsed && sorted.map((item, i) => (
        <ItemCard key={`${item.code}-${i}`} item={item} terms={terms} />
      ))}
    </div>
  )
}

const PAGE_LOAD = 5   // categories visible initially (loads more on scroll)

function SupplierColumn({
  supplier, terms, activeCategories,
}: {
  supplier: Supplier
  terms: string[][]
  activeCategories: Set<AppleCategory>
}) {
  const [showAll, setShowAll] = useState(false)

  // Group filtered items by category following CATEGORY_ORDER
  const grouped = useMemo(() => {
    let items = supplier.items
    if (activeCategories.size > 0)
      items = items.filter(i => activeCategories.has((i.category ?? 'otros') as AppleCategory))
    if (terms.length)
      items = items.filter(i => matchesQuery(i.name, terms) || matchesQuery(i.code, terms))

    const map = new Map<AppleCategory, SupplierItem[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const item of items) {
      const cat = (item.category ?? 'otros') as AppleCategory
      const key = map.has(cat) ? cat : 'otros'
      map.get(key)!.push(item)
    }
    // Only return categories that have items
    return CATEGORY_ORDER
      .map(cat => ({ cat, items: map.get(cat)! }))
      .filter(g => g.items.length > 0)
  }, [supplier.items, terms, activeCategories])

  // Reset when filter changes
  useEffect(() => { setShowAll(false) }, [grouped])

  const totalFiltered = grouped.reduce((s, g) => s + g.items.length, 0)
  const totalAll = supplier.items.length

  const visibleGroups = showAll ? grouped : grouped.slice(0, PAGE_LOAD)
  const hiddenCount = grouped.slice(PAGE_LOAD).reduce((s, g) => s + g.items.length, 0)
  const hasMore = !showAll && grouped.length > PAGE_LOAD

  // Searching? Don't collapse any sections. Default: collapse below top 3 categories.
  const isSearching = terms.length > 0

  return (
    <div style={{
      flex: '1 1 300px', minWidth: 270, maxWidth: 460,
      background: 'var(--surface)',
      border: `1px solid ${supplier.color.border}44`,
      borderTop: `3px solid ${supplier.color.border}`,
      borderRadius: 10, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 190px)',
    }}>
      {/* Column header */}
      <div style={{
        padding: '11px 14px',
        background: supplier.color.bg,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: supplier.color.border, flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: supplier.color.text }}>
            {supplier.name}
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
            background: `${supplier.color.border}22`,
            color: supplier.color.text,
            borderRadius: 10, padding: '2px 8px',
          }}>
            {totalFiltered !== totalAll
              ? <>{totalFiltered} <span style={{ opacity: 0.55 }}>/ {totalAll}</span></>
              : totalAll}
          </span>
        </div>

        {/* Category pills summary */}
        {grouped.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {grouped.map(({ cat, items }) => {
              const meta = CATEGORY_META[cat]
              return (
                <span key={cat} style={{
                  fontSize: 10, padding: '1px 7px', borderRadius: 10,
                  background: meta.color + '18', color: meta.color,
                  border: `1px solid ${meta.color}33`, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {meta.icon} {items.length}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Items grouped by category */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {grouped.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#484848', fontSize: 13 }}>
            Sin resultados en {supplier.name}
          </div>
        ) : (
          <>
            {visibleGroups.map(({ cat, items }, idx) => (
              <CategorySection
                key={cat}
                cat={cat}
                items={items}
                terms={terms}
                // Auto-collapse lower-priority categories when not searching
                defaultCollapsed={!isSearching && idx >= 3}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--surface2)',
                  border: 'none', borderTop: '1px solid var(--border)',
                  color: '#8A8A8A', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
              >
                Ver {grouped.length - PAGE_LOAD} categorías más · {hiddenCount} productos
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SupplierColumns({ suppliers, search, activeCategories }: Props) {
  const terms = useMemo(() => expandQuery(search), [search])
  const active = suppliers.filter(s => s.items.length > 0)

  if (active.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 0',
        color: '#484848', fontSize: 14,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
        Sin proveedores cargados
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
      {active.map(s => (
        <SupplierColumn
          key={s.id}
          supplier={s}
          terms={terms}
          activeCategories={activeCategories}
        />
      ))}
    </div>
  )
}
