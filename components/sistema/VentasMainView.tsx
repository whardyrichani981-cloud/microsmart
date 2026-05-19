'use client'
import { useState } from 'react'
import VentasCSFView from './VentasCSFView'
import VentasGremioView from './VentasGremioView'

const TABS = [
  { id: 'csf'    as const, label: '📋 Cliente Final' },
  { id: 'gremio' as const, label: '🏢 Gremio' },
]

const COLOR = '#4ade80'

export default function VentasMainView() {
  const [tab, setTab] = useState<'csf' | 'gremio'>('csf')

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
              color: tab === t.id ? COLOR : 'var(--text-secondary)',
              borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'csf'    && <VentasCSFView />}
      {tab === 'gremio' && <VentasGremioView />}
    </div>
  )
}
