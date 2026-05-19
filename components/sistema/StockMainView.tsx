'use client'
import { useState } from 'react'
import StockView from './StockView'

const TABS = [
  { id: 'repuestos' as const, label: '🔩 Repuestos', desc: 'Módulos, baterías y piezas' },
  { id: 'accesorios' as const, label: '🛍️ Accesorios', desc: 'Accesorios para la venta' },
]

export default function StockMainView() {
  const [tab, setTab] = useState<'repuestos' | 'accesorios'>('repuestos')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none',
              color: tab === t.id ? '#a78bfa' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <StockView tipo={tab} />
    </div>
  )
}
