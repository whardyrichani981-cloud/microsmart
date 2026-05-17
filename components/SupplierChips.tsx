'use client'

import { useRef } from 'react'
import type { Supplier } from '@/lib/types'

interface Props {
  suppliers: Supplier[]
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}

export default function SupplierChips({ suppliers, onRemove, onRename }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {suppliers.map(s => (
        <SupplierChip key={s.id} supplier={s} onRemove={onRemove} onRename={onRename} />
      ))}
    </div>
  )
}

function SupplierChip({ supplier: s, onRemove, onRename }: {
  supplier: Supplier
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: s.color.bg,
        border: `1px solid ${s.color.border}`,
        color: s.color.text,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: s.color.border, flexShrink: 0
      }} />

      <input
        ref={inputRef}
        defaultValue={s.name}
        onBlur={e => {
          const v = e.target.value.trim()
          if (v && v !== s.name) onRename(s.id, v)
          else e.target.value = s.name
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') inputRef.current?.blur()
          if (e.key === 'Escape') { inputRef.current!.value = s.name; inputRef.current?.blur() }
        }}
        title="Clic para editar nombre"
        style={{
          background: 'transparent', border: 'none',
          color: 'inherit', font: 'inherit', fontSize: 12,
          fontWeight: 600, outline: 'none',
          minWidth: 50, maxWidth: 160,
          cursor: 'pointer', width: `${Math.max(50, s.name.length * 7)}px`
        }}
        onFocus={e => { e.target.style.borderBottom = '1px solid currentColor'; e.target.style.cursor = 'text' }}
        onBlurCapture={e => { e.target.style.borderBottom = 'none'; e.target.style.cursor = 'pointer' }}
      />

      {s.items.length > 0 && (
        <span style={{ opacity: 0.7 }}>({s.items.length})</span>
      )}

      {s.source === 'builtin' && (
        <span title="Proveedor integrado" style={{ opacity: 0.5, fontSize: 10 }}>↗</span>
      )}

      <button
        onClick={() => onRemove(s.id)}
        title="Eliminar proveedor"
        style={{
          background: 'none', border: 'none',
          color: 'inherit', cursor: 'pointer',
          opacity: 0.6, fontSize: 14, lineHeight: 1,
          padding: '0 2px',
        }}
        onMouseEnter={e => ((e.target as HTMLElement).style.opacity = '1')}
        onMouseLeave={e => ((e.target as HTMLElement).style.opacity = '0.6')}
      >
        ×
      </button>
    </div>
  )
}
