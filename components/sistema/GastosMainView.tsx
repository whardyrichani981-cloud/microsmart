'use client'
import { useState } from 'react'
import GastosView from './GastosView'
import type { TipoGasto } from '@/lib/sistema-types'

const TABS: { id: TipoGasto; label: string }[] = [
  { id: 'local',   label: '🧾 Local' },
  { id: 'oficina', label: '🏠 Oficina' },
  { id: 'fijos',   label: '💰 Fijos' },
]

const COLOR = '#f87171'

export default function GastosMainView() {
  const [tab, setTab] = useState<TipoGasto>('local')

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
      <GastosView tipo={tab} />
    </div>
  )
}
