'use client'
import { useState } from 'react'
import DashboardView from './DashboardView'
import TipoCambioView from './TipoCambioView'

const TABS = [
  { id: 'dashboard'    as const, label: '📊 Dashboard' },
  { id: 'tipo-cambio'  as const, label: '💱 Tipo de Cambio' },
]

const COLOR = '#fb923c'

export default function ReportesMainView() {
  const [tab, setTab] = useState<'dashboard' | 'tipo-cambio'>('dashboard')

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
      {tab === 'dashboard'   && <DashboardView />}
      {tab === 'tipo-cambio' && <TipoCambioView />}
    </div>
  )
}
