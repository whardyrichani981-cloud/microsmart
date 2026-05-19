'use client'

import { useState } from 'react'
import type { Supplier, MergedRow } from '@/lib/types'
import type { SortState } from './PriceComparator'
import { CATEGORY_META, CATEGORY_ORDER, type AppleCategory } from '@/lib/categories'

interface Props {
  rows: MergedRow[]
  suppliers: Supplier[]
  sort: SortState
  onSort: (col: string) => void
  search: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 2,
  }).format(n)
}

function highlight(text: string, search: string) {
  if (!search) return text
  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    `<mark style="background:rgba(245,196,0,0.35);color:inherit;border-radius:2px">${text.slice(idx, idx + search.length)}</mark>` +
    text.slice(idx + search.length)
  )
}

function SortIcon({ col, sort }: { col: string; sort: SortState }) {
  if (sort.col !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>
  return <span style={{ color: '#F5C400', marginLeft: 4 }}>{sort.dir === 1 ? '↑' : '↓'}</span>
}

// ─── Product row ─────────────────────────────────────────────────────────────
function ProductRow({
  row, suppliers, search, isLast,
}: {
  row: MergedRow
  suppliers: Supplier[]
  search: string
  isLast: boolean
}) {
  const prices = suppliers.map(s => row.prices[s.id])
  const valid = prices.filter((p): p is number => p != null && !isNaN(p))
  const minPrice = valid.length > 0 ? Math.min(...valid) : null
  const bestSupplier = minPrice != null ? suppliers.find(s => row.prices[s.id] === minPrice) : null
  const showBest = suppliers.length > 1

  return (
    <tr
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <td className="px-4 py-2.5">
        <div className="font-medium leading-snug"
          dangerouslySetInnerHTML={{ __html: highlight(row.name, search) }} />
        {row.code && (
          <div className="text-xs mt-0.5" style={{ color: '#676767' }}
            dangerouslySetInnerHTML={{ __html: highlight(row.code, search) }} />
        )}
      </td>

      {suppliers.map((s, i) => {
        const price = prices[i]
        const isBest = price != null && price === minPrice && valid.length > 1
        const isOut = /sin\s*stock/i.test(row.stocks[s.id] ?? '')

        if (price == null || isNaN(price)) {
          return <td key={s.id} className="px-4 py-2.5 text-right"
            style={{ color: '#363636', fontSize: 12 }}>—</td>
        }
        return (
          <td key={s.id} className="px-4 py-2.5 text-right font-mono tabular-nums"
            style={{
              color: isBest ? '#4ade80' : isOut ? '#676767' : '#E5E5E3',
              fontWeight: isBest ? 700 : 400,
              background: isBest ? 'rgba(34,197,94,0.05)' : undefined,
              fontSize: 13,
            }}>
            {isBest && <span style={{ marginRight: 3, fontSize: 10 }}>🏆</span>}
            {fmt(price)}
            {isOut && <div style={{ fontSize: 10, color: '#676767', fontWeight: 400 }}>Sin stock</div>}
          </td>
        )
      })}

      {showBest && (
        <td className="px-4 py-2.5 text-right"
          style={{ background: 'rgba(34,197,94,0.04)', borderLeft: '1px solid var(--border)' }}>
          {minPrice != null ? (
            <>
              <div className="font-bold tabular-nums font-mono" style={{ color: '#4ade80', fontSize: 13 }}>
                {fmt(minPrice)}
              </div>
              {bestSupplier && (
                <div className="text-xs mt-0.5" style={{ color: bestSupplier.color.text }}>
                  {bestSupplier.name}
                </div>
              )}
            </>
          ) : <span style={{ color: '#363636' }}>—</span>}
        </td>
      )}
    </tr>
  )
}

// ─── Category header row ─────────────────────────────────────────────────────
function CategoryHeader({
  cat, count, collapsed, colSpan, onToggle,
}: {
  cat: AppleCategory
  count: number
  collapsed: boolean
  colSpan: number
  onToggle: () => void
}) {
  const meta = CATEGORY_META[cat]
  return (
    <tr
      onClick={onToggle}
      style={{
        background: meta.bg,
        borderTop: `2px solid ${meta.color}22`,
        borderBottom: `1px solid ${meta.color}33`,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <td colSpan={colSpan} style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>
            {meta.label}
          </span>
          <span style={{
            fontSize: 11, background: meta.color + '22',
            color: meta.color, borderRadius: 10,
            padding: '1px 7px', fontWeight: 600,
          }}>
            {count}
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 12,
            color: meta.color, opacity: 0.7,
          }}>
            {collapsed ? '▶' : '▼'}
          </span>
        </div>
      </td>
    </tr>
  )
}

// ─── Main table ──────────────────────────────────────────────────────────────
export default function PriceTable({ rows, suppliers, sort, onSort, search }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCat = (cat: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl"
        style={{ border: '1px dashed var(--border)', color: '#676767' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
        <p className="font-medium" style={{ color: '#E5E5E3' }}>Sin datos cargados</p>
        <p className="text-sm mt-1">Los proveedores se están cargando...</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-xl"
        style={{ border: '1px dashed var(--border)', color: '#676767' }}>
        <p className="font-medium" style={{ color: '#E5E5E3' }}>Sin resultados</p>
        <p className="text-sm mt-1">Probá con otro término o categoría</p>
      </div>
    )
  }

  // Group rows by normalized category, preserving CATEGORY_ORDER
  // Within each category, sort respects the passed-in sort (price/name) OR falls back to name A-Z
  const grouped = new Map<AppleCategory, MergedRow[]>()
  for (const cat of CATEGORY_ORDER) grouped.set(cat, [])

  for (const row of rows) {
    const cat = (row.category ?? 'otros') as AppleCategory
    const key = grouped.has(cat) ? cat : 'otros'
    grouped.get(key)!.push(row)
  }

  // Always sort alphabetically within each category when sort.col === 'name'
  if (sort.col === 'name') {
    for (const [, catRows] of grouped) {
      catRows.sort((a, b) => sort.dir * a.name.localeCompare(b.name, 'es'))
    }
  }

  const showBest = suppliers.length > 1
  const colSpan = 1 + suppliers.length + (showBest ? 1 : 0)

  return (
    <div className="rounded-xl overflow-hidden table-scroll"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none whitespace-nowrap"
              style={{ color: '#676767', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}
              onClick={() => onSort('name')}>
              Producto <SortIcon col="name" sort={sort} />
            </th>
            {suppliers.map(s => (
              <th key={s.id}
                className="text-right px-4 py-3 font-semibold cursor-pointer select-none whitespace-nowrap"
                style={{ color: s.color.text, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}
                onClick={() => onSort(s.id)}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: s.color.border, marginRight: 5 }} />
                {s.name} <SortIcon col={s.id} sort={sort} />
              </th>
            ))}
            {showBest && (
              <th className="text-right px-4 py-3 font-semibold cursor-pointer select-none whitespace-nowrap"
                style={{ color: '#4ade80', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}
                onClick={() => onSort('best')}>
                Mejor precio <SortIcon col="best" sort={sort} />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map(cat => {
            const catRows = grouped.get(cat) ?? []
            if (catRows.length === 0) return null
            const isCollapsed = collapsed.has(cat)

            return [
              <CategoryHeader
                key={`hdr-${cat}`}
                cat={cat}
                count={catRows.length}
                collapsed={isCollapsed}
                colSpan={colSpan}
                onToggle={() => toggleCat(cat)}
              />,
              ...(!isCollapsed ? catRows.map((row, i) => (
                <ProductRow
                  key={row.key}
                  row={row}
                  suppliers={suppliers}
                  search={search}
                  isLast={i === catRows.length - 1}
                />
              )) : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
