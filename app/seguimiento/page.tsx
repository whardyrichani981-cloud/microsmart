'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function SeguimientoLandingPage() {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = codigo.trim().toUpperCase()
    if (!clean) { setError('Ingresá tu código de seguimiento'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/seguimiento/${encodeURIComponent(clean)}`)
      if (res.status === 404) {
        setError('No encontramos ninguna orden con ese código. Verificá que esté bien escrito.')
        setLoading(false)
        return
      }
      router.push(`/seguimiento/${clean}`)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #F5C400, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🍎</div>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Microsmart</span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
          Seguimiento de reparaciones
        </span>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(245,196,0,0.15), rgba(249,115,22,0.15))',
          border: '1.5px solid rgba(245,196,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 28,
          boxShadow: '0 0 40px rgba(245,196,0,0.1)',
        }}>
          🔍
        </div>

        <h1 style={{
          fontSize: 'clamp(24px, 5vw, 36px)',
          fontWeight: 900, color: '#fff',
          textAlign: 'center', margin: '0 0 10px',
          letterSpacing: '-0.5px',
        }}>
          Seguí tu reparación
        </h1>
        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.5)',
          textAlign: 'center', margin: '0 0 40px',
          maxWidth: 380, lineHeight: 1.6,
        }}>
          Ingresá el código de seguimiento que recibiste al dejar tu equipo en el taller.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420 }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${error ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 14,
            padding: '6px 6px 6px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'border-color 0.2s',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔐</span>
            <input
              ref={inputRef}
              value={codigo}
              onChange={e => { setCodigo(e.target.value.toUpperCase()); setError('') }}
              placeholder="Ej: MS-2024-ABC1"
              autoFocus
              autoComplete="off"
              maxLength={30}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 18, fontWeight: 700, color: '#fff',
                fontFamily: 'monospace', letterSpacing: '0.08em',
                caretColor: '#F5C400', minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={loading || !codigo.trim()}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 700, fontSize: 14,
                background: loading || !codigo.trim()
                  ? 'rgba(255,255,255,0.07)'
                  : 'linear-gradient(135deg, #F5C400, #f97316)',
                border: 'none',
                color: loading || !codigo.trim() ? 'rgba(255,255,255,0.3)' : '#0c0d0f',
                cursor: loading || !codigo.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '⟳' : 'Consultar →'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, fontSize: 13, color: '#f87171',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span>{error}
            </div>
          )}
        </form>

        {/* Hint */}
        <div style={{
          marginTop: 32, padding: '16px 20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, maxWidth: 420, width: '100%',
        }}>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.35)',
            fontWeight: 700, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            ¿Dónde está mi código?
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            📄 En el comprobante impreso que te dimos al dejar el equipo.<br />
            💬 También lo podés solicitar llamándonos o escribiéndonos.
          </div>
        </div>
      </main>

      <footer style={{
        textAlign: 'center', padding: '20px 24px',
        fontSize: 12, color: 'rgba(255,255,255,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        Microsmart · Reparaciones Apple
      </footer>
    </div>
  )
}
