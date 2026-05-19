'use client'

import { useState, useRef } from 'react'

// Luhn algorithm — verifies the IMEI check digit
function luhnValid(imei: string): boolean {
  if (imei.length !== 15 || !/^\d+$/.test(imei)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = parseInt(imei[i])
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

function getManufacturer(imei: string): string {
  if (imei.length < 8) return ''
  const tac = imei.slice(0, 8)
  const t = parseInt(tac)
  if (t >= 353000000 && t <= 353109999) return 'Apple'
  if (t >= 862000000 && t <= 862999999) return 'Apple'
  if (['35299406','35617406','35878406','35325910','35347510','35421701',
       '35674108','35674707','35742109','35869404','35986509'].includes(tac)) return 'Apple'
  if (tac.startsWith('860') || tac.startsWith('861')) return 'Huawei'
  if (tac.startsWith('867')) return 'Xiaomi'
  if (tac.startsWith('350') || tac.startsWith('351') || tac.startsWith('356')) return 'Samsung'
  if (tac.startsWith('354') || tac.startsWith('357')) return 'Motorola / LG'
  if (tac.startsWith('359')) return 'Motorola / Xiaomi'
  return ''
}

function formatDisplay(digits: string) {
  return [digits.slice(0,6), digits.slice(6,8), digits.slice(8,14), digits.slice(14)]
    .filter(g => g.length > 0).join(' ')
}

type Result = { resultado: string | null; error: string | null; showResult: boolean }

export default function IMEIView() {
  const [imei, setImei] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [apiError, setApiError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const digits = imei.replace(/\D/g, '').slice(0, 15)
  const isComplete = digits.length === 15
  const isValid = isComplete && luhnValid(digits)
  const manufacturer = getManufacturer(digits)

  const handleInput = (v: string) => {
    setImei(v.replace(/\D/g, '').slice(0, 15))
    setResult(null)
    setApiError('')
  }

  const reset = () => {
    setImei(''); setResult(null); setApiError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const consultar = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setResult(null)
    setApiError('')
    try {
      const res = await fetch(`/api/imei?imei=${digits}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setApiError(data.error ?? 'Error desconocido')
      } else {
        setResult(data)
      }
    } catch {
      setApiError('No se pudo conectar con ENACOM. Verificá tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  // Determine result type — coerce to string since ENACOM may return non-string values
  const toStr = (v: unknown) => (typeof v === 'string' ? v : '')
  const isBlocked = toStr(result?.resultado).toLowerCase().includes('bloqueado') ||
                    toStr(result?.error).toLowerCase().includes('bloqueado')
  const isVálido = toStr(result?.resultado).toLowerCase().includes('válido') ||
                   toStr(result?.resultado).toLowerCase().includes('valido')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 64, height: 64, borderRadius: 18,
          background: '#F5C400',
          boxShadow: '0 8px 32px rgba(245,196,0,0.35)',
          fontSize: 30, marginBottom: 16,
        }}>📱</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#E5E5E3', margin: '0 0 8px' }}>
          Verificador de IMEI
        </h2>
        <p style={{ fontSize: 14, color: '#676767', margin: 0, lineHeight: 1.6 }}>
          Consulta oficial vía ENACOM · Verificá si un equipo está libre o bloqueado.<br />
          Obtené el IMEI marcando{' '}
          <code style={{ background: 'rgba(245,196,0,0.12)', color: '#F5C400', padding: '1px 6px', borderRadius: 4 }}>
            *#06#
          </code>
        </p>
      </div>

      {/* ── Input card ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '28px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}>
        <label style={{
          fontSize: 12, fontWeight: 700, color: '#676767',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'block', marginBottom: 10,
        }}>
          Número IMEI (15 dígitos)
        </label>

        {/* Input */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={digits}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') consultar() }}
            placeholder="Ej: 352999061234560"
            maxLength={15}
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '16px 20px',
              paddingRight: digits ? 48 : 20,
              background: 'var(--bg)',
              border: `2px solid ${isComplete ? (isValid ? '#22c55e' : '#ef4444') : 'var(--border)'}`,
              borderRadius: 12, color: '#E5E5E3',
              fontSize: 22, fontFamily: 'monospace', fontWeight: 600,
              letterSpacing: '0.1em', outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          {digits && (
            <button
              onClick={reset}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#484848',
                fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
              }}
            >×</button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, height: 4, background: 'rgba(255,255,255,0.06)',
            borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${(digits.length / 15) * 100}%`,
              background: isComplete ? (isValid ? '#22c55e' : '#ef4444') : '#F5C400',
              transition: 'width 0.15s, background 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#484848', minWidth: 32, textAlign: 'right' }}>
            {digits.length}/15
          </span>
        </div>

        {/* Format validation */}
        {isComplete && (
          <div style={{
            marginTop: 10, padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 7,
            background: isValid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isValid ? '#22c55e33' : '#ef444433'}`,
            color: isValid ? '#4ade80' : '#f87171',
          }}>
            {isValid ? '✓ Formato válido' : '✕ IMEI inválido — revisá los 15 dígitos'}
          </div>
        )}

        {/* Manufacturer */}
        {isValid && manufacturer && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,196,0,0.06)', border: '1px solid rgba(245,196,0,0.20)',
          }}>
            <span>{manufacturer === 'Apple' ? '🍎' : '📱'}</span>
            <span style={{ color: '#F5C400', fontWeight: 600 }}>{manufacturer}</span>
            <span style={{ color: '#484848', fontSize: 11 }}>· TAC: {digits.slice(0, 8)}</span>
          </div>
        )}

        {/* Consult button */}
        <button
          onClick={consultar}
          disabled={!isValid || loading}
          style={{
            width: '100%', marginTop: 18, padding: '15px 0',
            borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15,
            cursor: !isValid || loading ? 'not-allowed' : 'pointer',
            background: !isValid || loading
              ? 'rgba(255,255,255,0.05)'
              : '#F5C400',
            color: !isValid || loading ? '#2E2E2E' : '#0c0d0f',
            boxShadow: !isValid || loading ? 'none' : '0 4px 20px rgba(245,196,0,0.35)',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              Consultando en ENACOM...
            </>
          ) : (
            <>🔍 Consultar IMEI en ENACOM</>
          )}
        </button>

        {/* API error */}
        {apiError && (
          <div style={{
            marginTop: 14, padding: '12px 16px', borderRadius: 10, fontSize: 13,
            background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444',
            color: '#f87171', lineHeight: 1.5,
          }}>
            ⚠️ {apiError}
          </div>
        )}

        {/* ── ENACOM Result ── */}
        {result?.showResult && (
          <div style={{
            marginTop: 18,
            borderRadius: 14, overflow: 'hidden',
            border: `2px solid ${isBlocked ? '#ef4444' : '#22c55e'}`,
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Status banner */}
            <div style={{
              padding: '18px 20px',
              background: isBlocked
                ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))'
                : 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: isBlocked ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                {isBlocked ? '🚫' : '✅'}
              </div>
              <div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: isBlocked ? '#f87171' : '#4ade80',
                  marginBottom: 3,
                }}>
                  {toStr(result.resultado) || toStr(result.error) || 'Resultado recibido'}
                </div>
                <div style={{ fontSize: 12, color: '#676767' }}>
                  IMEI: <span style={{ fontFamily: 'monospace', color: '#8A8A8A', letterSpacing: '0.05em' }}>
                    {formatDisplay(digits)}
                  </span>
                </div>
              </div>
            </div>

            {/* Detail */}
            <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.15)' }}>
              <p style={{ fontSize: 13, color: '#8A8A8A', margin: 0, lineHeight: 1.6 }}>
                {isBlocked
                  ? 'Este equipo está registrado como bloqueado en las bases de datos de ENACOM. No puede operar en redes móviles argentinas.'
                  : 'Este equipo está habilitado para operar en redes móviles argentinas. No presenta reportes de bloqueo.'}
              </p>
              <div style={{
                marginTop: 10, fontSize: 11, color: '#484848',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span>🏛</span> Fuente oficial: ENACOM Argentina
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Info cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { icon: '✅', title: 'IMEI Válido', desc: 'El equipo está habilitado para operar en redes argentinas sin restricciones.', color: '#4ade80' },
          { icon: '🚫', title: 'IMEI Bloqueado', desc: 'El equipo fue reportado o bloqueado y no puede operar en redes locales.', color: '#f87171' },
          { icon: '*#06#', title: '¿Cómo obtener el IMEI?', desc: 'Marcá *#06# en el teléfono, o buscalo en Ajustes → General → Información.', color: '#F5C400' },
          { icon: '🔒', title: '¿Qué es el IMEI?', desc: 'Número único de 15 dígitos que identifica a nivel mundial cada dispositivo móvil.', color: '#fbbf24' },
        ].map(card => (
          <div key={card.title} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: card.icon.startsWith('*') ? 11 : 20,
                fontFamily: card.icon.startsWith('*') ? 'monospace' : 'inherit',
                fontWeight: card.icon.startsWith('*') ? 700 : 'normal',
                color: card.icon.startsWith('*') ? card.color : 'inherit',
                background: card.icon.startsWith('*') ? `${card.color}22` : 'transparent',
                padding: card.icon.startsWith('*') ? '3px 8px' : 0,
                borderRadius: card.icon.startsWith('*') ? 6 : 0,
              }}>{card.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: card.color }}>{card.title}</span>
            </div>
            <p style={{ fontSize: 12, color: '#676767', margin: 0, lineHeight: 1.6 }}>{card.desc}</p>
          </div>
        ))}
      </div>

      <style>{`
        input:focus { border-color: #F5C400 !important; }
        input::placeholder { color: #2E2E2E; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
