'use client'
import { useState } from 'react'
import PanicAnalyzerView from './PanicAnalyzerView'

type Tool = 'panicfull'

const TOOLS: { id: Tool; label: string; icon: string; desc: string }[] = [
  { id: 'panicfull', label: 'Panicfull', icon: '📋', desc: 'Análisis de logs de pánico iPhone' },
]

export default function HerramientasTecnicasView() {
  const [activeTool, setActiveTool] = useState<Tool>('panicfull')

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* Sub-sidebar de herramientas */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '16px 10px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '0 8px', marginBottom: 8,
        }}>
          Herramientas
        </div>

        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, border: 'none',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              background: activeTool === t.id ? 'var(--accent-dim)' : 'transparent',
              color: activeTool === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTool === t.id ? 600 : 400,
              fontSize: 13,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
            <div>
              <div style={{ fontSize: 13, lineHeight: 1.2 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Contenido de la herramienta activa */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTool === 'panicfull' && <PanicAnalyzerView />}
      </div>
    </div>
  )
}
