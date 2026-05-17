'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Supplier, SupplierItem } from '@/lib/types'
import { CATEGORY_META, type AppleCategory } from '@/lib/categories'
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

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text
  // Find the first matching term in the text
  let best = { idx: -1, len: 0 }
  const lower = text.toLowerCase()
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i !== -1 && (best.idx === -1 || t.length > best.len)) {
      best = { idx: i, len: t.length }
    }
  }
  if (best.idx === -1) return text
  return (
    text.slice(0, best.idx) +
    `<mark style="background:rgba(99,102,241,0.4);color:inherit;border-radius:2px;padding:0 1px">${text.slice(best.idx, best.idx + best.len)}</mark>` +
    text.slice(best.idx + best.len)
  )
}

function ItemCard({ item, terms }: { item: SupplierItem; terms: string[] }) {
  const cat = (item.category ?? 'otros') as AppleCategory
  const meta = CATEGORY_META[cat]
  const isOut = /sin\s*stock/i.test(item.stock ?? '')

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)',
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      {/* Category badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 10,
          background: meta.bg, color: meta.color,
          border: `1px solid ${meta.color}44`,
          fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {meta.icon} {meta.label}
        </span>
        {isOut && (
          <span style={{ fontSize: 10, color: '#f87171', marginLeft: 'auto' }}>Sin stock</span>
        )}
      </div>

      {/* Name */}
      <div
        className="text-sm font-medium leading-snug"
        style={{ color: '#e2e8f0', marginBottom: 2 }}
        dangerouslySetInnerHTML={{ __html: highlight(item.name, terms) }}
      />

      {/* Code */}
      {item.code && (
        <div style={{ fontSize: 11, color: '#7c85a2', marginBottom: 4 }}
          dangerouslySetInnerHTML={{ __html: highlight(item.code, terms) }} />
      )}

      {/* Price + stock */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{
          fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
          color: isOut ? '#7c85a2' : '#4ade80',
        }}>
          {fmt(item.price)}
        </span>
        {item.stock && !isOut && (
          <span style={{ fontSize: 10, color: '#475569' }}>{item.stock}</span>
        )}
      </div>
    </div>
  )
}

const PAGE_SIZE = 50

function SupplierColumn({ supplier, terms, activeCategories }: {
  supplier: Supplier
  terms: string[]
  activeCategories: Set<AppleCategory>
}) {
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let items = supplier.items
    if (activeCategories.size > 0)
      items = items.filter(i => activeCategories.has((i.category ?? 'otros') as AppleCategory))
    if (terms.length)
      items = items.filter(i => matchesQuery(i.name, terms) || matchesQuery(i.code, terms))
    return items
  }, [supplier.items, terms, activeCategories])

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1) }, [filtered])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length
  const remaining = filtered.length - visible.length

  return (
    <div style={{
      flex: '1 1 300px', minWidth: 260, maxWidth: 480,
      background: 'var(--surface)',
      border: `1px solid ${supplier.color.border}44`,
      borderTop: `3px solid ${supplier.color.border}`,
      borderRadius: 10, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 200px)',
    }}>
      {/* Column header */}
      <div style={{
        padding: '12px 14px',
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
            {visible.length}/{filtered.length}
            {filtered.length !== supplier.items.length && (
              <span style={{ opacity: 0.6 }}> de {supplier.items.length}</span>
            )}
          </span>
        </div>
      </div>

      {/* Items */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            Sin resultados en {supplier.name}
          </div>
        ) : (
          <>
            {visible.map((item, i) => (
              <ItemCard key={`${item.code}-${i}`} item={item} terms={terms} />
            ))}

            {hasMore && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    width: '100%', padding: '9px 0',
                    background: `${supplier.color.border}18`,
                    border: `1px solid ${supplier.color.border}44`,
                    borderRadius: 8,
                    color: supplier.color.text,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${supplier.color.border}30`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${supplier.color.border}18`)}
                >
                  Ver más · {remaining} producto{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}
                </button>
              </div>
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
        color: '#475569', fontSize: 14,
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
