'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const LIMIT = 3

export default function DiagnosticoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Consultar usos restantes al cargar
  useEffect(() => {
    fetch('/api/panic')
      .then(r => r.json())
      .then((d: { remaining: number }) => {
        setRemaining(d.remaining)
        setLimitReached(d.remaining === 0)
      })
      .catch(() => setRemaining(LIMIT))
  }, [])

  const hasContent = file || pastedText.trim()

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setPastedText('') }
  }, [])

  const analyze = async () => {
    if (!hasContent || loading || limitReached) return
    setLoading(true)
    setResult(null)
    setError(null)

    const fd = new FormData()
    if (file) fd.append('file', file)
    else fd.append('file_text', pastedText.trim())

    try {
      const res = await fetch('/api/panic', { method: 'POST', body: fd })
      const data = await res.json() as {
        ok?: boolean; html?: string; error?: string
        remaining?: number; limitReached?: boolean
      }

      if (data.limitReached) {
        setLimitReached(true)
        setRemaining(0)
        setError(data.error ?? 'Límite alcanzado')
      } else if (!res.ok || data.error) {
        setError(data.error ?? 'Error desconocido')
      } else {
        setResult(data.html ?? '')
        if (data.remaining !== undefined) setRemaining(data.remaining)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPastedText('')
    setResult(null)
    setError(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 60%, #0a0f1a 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e6edf3',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #0066CC, #0099FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff',
          flexShrink: 0,
        }}>M</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Microsmart</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Especialistas Apple</div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>
            Diagnóstico Panic Full
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
            Subí el archivo de diagnóstico de tu iPhone y obtenés un análisis
            automático en segundos.
          </p>
        </div>

        {/* Rate limit badge */}
        {remaining !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex', gap: 4,
            }}>
              {Array.from({ length: LIMIT }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i < remaining ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: limitReached ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
              {limitReached
                ? 'Límite diario alcanzado — volvé mañana'
                : `${remaining} análisis disponible${remaining !== 1 ? 's' : ''} hoy`}
            </span>
          </div>
        )}

        {/* Main card */}
        {!result && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '28px 24px',
            backdropFilter: 'blur(10px)',
          }}>

            {limitReached ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>
                  Límite diario alcanzado
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  Podés realizar hasta {LIMIT} análisis por día.<br />
                  El contador se reinicia a medianoche.
                </div>
                <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  ¿Necesitás más análisis?{' '}
                  <a
                    href="https://wa.me/5491165798149"
                    style={{ color: '#0099FF', textDecoration: 'none' }}
                  >
                    Contactanos
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  onDragEnter={() => setDragging(true)}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => !file && fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#0099FF' : file ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 14,
                    padding: '28px 20px',
                    textAlign: 'center',
                    cursor: file ? 'default' : 'pointer',
                    background: dragging ? 'rgba(0,153,255,0.08)' : file ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s',
                    marginBottom: 16,
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setFile(f); setPastedText('') }
                    }}
                  />
                  {file ? (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null) }}
                        style={{
                          marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Cambiar archivo
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                        Arrastrá el archivo acá
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                        o hacé clic para seleccionarlo
                      </div>
                      <div style={{
                        display: 'inline-block', fontSize: 11, padding: '4px 10px',
                        borderRadius: 6, background: 'rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.35)',
                      }}>
                        .txt · .panic · .ips · cualquier formato
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                {!file && (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>o pegá el texto</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    </div>

                    <textarea
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder="Copiá y pegá el contenido del log de pánico acá..."
                      rows={5}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '12px 14px', borderRadius: 10, fontSize: 12,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#e6edf3', resize: 'vertical',
                        fontFamily: 'monospace', lineHeight: 1.5,
                        outline: 'none',
                        marginBottom: 16,
                      }}
                    />
                  </>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                    color: '#fca5a5', fontSize: 13,
                  }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Analyze button */}
                <button
                  onClick={analyze}
                  disabled={!hasContent || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, fontSize: 15,
                    fontWeight: 700, border: 'none', cursor: hasContent && !loading ? 'pointer' : 'not-allowed',
                    background: hasContent && !loading
                      ? 'linear-gradient(135deg, #0066CC, #0099FF)'
                      : 'rgba(255,255,255,0.07)',
                    color: hasContent && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: hasContent && !loading ? '0 4px 20px rgba(0,102,204,0.35)' : 'none',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{
                        width: 16, height: 16,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      Analizando...
                    </>
                  ) : '🔍 Analizar diagnóstico'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                ✅ Resultado del análisis
              </div>
              <button
                onClick={reset}
                style={{
                  padding: '7px 16px', borderRadius: 999, fontSize: 13,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                }}
              >
                🔄 Nuevo análisis
              </button>
            </div>

            <div style={{
              borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <iframe
                srcDoc={result}
                sandbox="allow-same-origin"
                style={{ width: '100%', minHeight: 600, border: 'none', background: '#fff', display: 'block' }}
                title="Resultado Panic Full"
              />
            </div>

            {remaining !== null && remaining > 0 && (
              <div style={{
                marginTop: 12, textAlign: 'center', fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
              }}>
                Te quedan {remaining} análisis más hoy
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, textAlign: 'center', fontSize: 12,
          color: 'rgba(255,255,255,0.2)', lineHeight: 1.8,
        }}>
          <div>Microsmart · Especialistas Apple</div>
          <div>Análisis procesado con tecnología de panicfull.com</div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
        textarea:focus { border-color: rgba(0,153,255,0.5) !important; }
      `}</style>
    </div>
  )
}
