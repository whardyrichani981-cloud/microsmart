'use client'
import { useState, useRef, useCallback } from 'react'

interface LogSlot {
  file: File | null
  text: string
  name: string
}

const emptySlot = (): LogSlot => ({ file: null, text: '', name: '' })

export default function PanicAnalyzerView() {
  const [slots, setSlots] = useState<[LogSlot, LogSlot, LogSlot]>([emptySlot(), emptySlot(), emptySlot()])
  const [multiMode, setMultiMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const updateSlot = (idx: number, patch: Partial<LogSlot>) => {
    setSlots(prev => {
      const next = [...prev] as [LogSlot, LogSlot, LogSlot]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const handleFile = (idx: number, file: File) => {
    updateSlot(idx, { file, name: file.name, text: '' })
  }

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragging(null)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(idx, file)
  }, [])

  const activeSlots = multiMode ? 3 : 1

  const canAnalyze = slots[0].file || slots[0].text.trim()

  const analyze = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const fd = new FormData()
      for (let i = 0; i < activeSlots; i++) {
        const s = slots[i]
        const key = activeSlots > 1 ? `file${i + 1}` : 'file'
        if (s.file) fd.append(key, s.file)
        else if (s.text.trim()) fd.append(key + '_text', s.text.trim())
      }

      const res = await fetch('/api/panic', { method: 'POST', body: fd })
      const data = await res.json() as { ok?: boolean; html?: string; error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Error desconocido')
      } else {
        setResult(data.html ?? '')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setSlots([emptySlot(), emptySlot(), emptySlot()])
    setResult(null)
    setError(null)
  }

  const slotLabels = ['Log 1', 'Log 2', 'Log 3']

  return (
    <div style={{ padding: '24px 28px', maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          📋 Análisis Panic Full
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
          Subí el archivo Panic-Full del iPhone para obtener un diagnóstico automático.
          El análisis se procesa desde nuestros servidores.
        </p>
      </div>


      {/* Upload slots */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {Array.from({ length: activeSlots }).map((_, idx) => {
          const slot = slots[idx]
          const hasContent = slot.file || slot.text.trim()
          return (
            <div
              key={idx}
              style={{ flex: activeSlots === 1 ? '1 1 100%' : '1 1 220px', minWidth: 200 }}
            >
              {activeSlots > 1 && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                  {slotLabels[idx]}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragEnter={() => setDragging(idx)}
                onDragLeave={() => setDragging(null)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, idx)}
                onClick={() => fileRefs[idx].current?.click()}
                style={hasContent ? {
                  border: '1px solid var(--accent)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background: 'var(--surface2)',
                  transition: 'all 0.15s',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                } : {
                  border: `2px dashed ${dragging === idx ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '18px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragging === idx ? 'var(--accent-dim)' : 'var(--surface)',
                  transition: 'all 0.15s',
                  marginBottom: 8,
                }}
              >
                <input
                  ref={fileRefs[idx]}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(idx, f) }}
                />
                {hasContent ? (
                  <>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slot.name || 'Texto pegado'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); updateSlot(idx, emptySlot()) }}
                      style={{
                        fontSize: 11, color: 'var(--text-dim)',
                        background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
                      }}
                    >
                      Limpiar
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Arrastrá o hacé clic para seleccionar
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      Archivo Panic-Full (.txt, .panic, .ips)
                    </div>
                  </>
                )}
              </div>

              {/* Paste alternative */}
              {!slot.file && (
                <textarea
                  value={slot.text}
                  onChange={e => updateSlot(idx, { text: e.target.value, file: null, name: '' })}
                  placeholder="O pegá el contenido del log acá..."
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', borderRadius: 8, fontSize: 12,
                    background: 'var(--surface2)', border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)', resize: 'vertical',
                    fontFamily: 'monospace',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button
          onClick={analyze}
          disabled={!canAnalyze || loading}
          style={{
            padding: '10px 28px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            background: canAnalyze && !loading ? 'var(--accent)' : 'var(--surface2)',
            color: canAnalyze && !loading ? '#fff' : 'var(--text-dim)',
            border: 'none', cursor: canAnalyze && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Analizando...
            </>
          ) : (
            <> 🔍 Analizar</>
          )}
        </button>

        {(result || error) && (
          <button
            onClick={reset}
            style={{
              padding: '10px 20px', borderRadius: 999, fontSize: 14,
              background: 'var(--surface2)', border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            🔄 Nuevo análisis
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: 10, marginBottom: 20,
          background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}


      {/* Result */}
      {result && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{
            padding: '10px 16px', background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            📊 Resultado del análisis — panicfull.com
          </div>
          <iframe
            srcDoc={result}
            sandbox="allow-scripts allow-same-origin"
            style={{ width: '100%', minHeight: 480, border: 'none', display: 'block' }}
            title="Resultado Panic Full"
          />
        </div>
      )}

    </div>
  )
}
