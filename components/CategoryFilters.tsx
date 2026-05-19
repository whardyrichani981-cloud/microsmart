'use client'

import { CATEGORY_META, CATEGORY_ORDER, type AppleCategory } from '@/lib/categories'
import type { MergedRow } from '@/lib/types'

interface Props {
  rows: MergedRow[]
  active: Set<AppleCategory>
  onChange: (next: Set<AppleCategory>) => void
}

export default function CategoryFilters({ rows, active, onChange }: Props) {
  // Count products per category
  const counts = new Map<AppleCategory, number>()
  for (const row of rows) {
    const cat = (row.category ?? 'otros') as AppleCategory
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  // Only show categories that have products
  const available = CATEGORY_ORDER.filter(c => (counts.get(c) ?? 0) > 0)
  if (available.length === 0) return null

  const allActive = active.size === 0

  const toggle = (cat: AppleCategory) => {
    const next = new Set(active)
    if (next.has(cat)) {
      next.delete(cat)
    } else {
      next.add(cat)
    }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* "Todas" chip */}
      <button
        onClick={() => onChange(new Set())}
        style={{
          padding: '5px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: allActive ? 700 : 500,
          cursor: 'pointer',
          border: `1px solid ${allActive ? '#F5C400' : 'var(--border)'}`,
          background: allActive ? 'rgba(245,196,0,0.10)' : 'var(--surface)',
          color: allActive ? '#F5C400' : '#676767',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        Todas
        <span style={{
          marginLeft: 5, fontSize: 10,
          background: allActive ? '#F5C400' : 'var(--surface2)',
          color: allActive ? '#0c0d0f' : '#676767',
          borderRadius: 10, padding: '1px 5px',
        }}>
          {rows.length}
        </span>
      </button>

      {available.map(cat => {
        const meta = CATEGORY_META[cat]
        const count = counts.get(cat) ?? 0
        const isOn = active.has(cat)

        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: isOn ? 700 : 400,
              cursor: 'pointer',
              border: `1px solid ${isOn ? meta.color : 'var(--border)'}`,
              background: isOn ? meta.bg : 'var(--surface)',
              color: isOn ? meta.color : '#676767',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>{meta.icon}</span>
            {meta.label}
            <span style={{
              fontSize: 10,
              background: isOn ? meta.color + '33' : 'var(--surface2)',
              color: isOn ? meta.color : '#676767',
              borderRadius: 10, padding: '1px 5px',
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
