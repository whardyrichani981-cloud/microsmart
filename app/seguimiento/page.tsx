'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SeguimientoSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [codigo, setCodigo] = useState('')
  const [copied, setCopied] = useState(false)

  // Auto-redirect if ?q= param is present
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.trim()) {
      router.push(`/seguimiento/${q.trim().toUpperCase()}`)
    }
  }, [searchParams, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = codigo.trim().toUpperCase()
    if (!trimmed) return
    router.push(`/seguimiento/${trimmed}`)
  }

  const widgetCode = `<form action="https://TU-DOMINIO/seguimiento" target="_blank" style="display:flex;gap:8px;font-family:sans-serif">
  <input name="q" placeholder="Código de seguimiento" style="padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;flex:1" />
  <button type="submit" style="padding:10px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">Consultar</button>
</form>`

  const handleCopyWidget = () => {
    navigator.clipboard.writeText(widgetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: '#111' }}>Microsmart</span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Seguimiento de reparaciones</div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px' }}>
        {/* Search Card */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '36px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          marginBottom: 32,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8 }}>
              Consultá el estado de tu equipo
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Ingresá el código que recibiste en el comprobante de ingreso para ver el estado de tu reparación en tiempo real.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: AB3X7Y2K"
                maxLength={8}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1.5px solid #d1d5db',
                  borderRadius: 10,
                  fontSize: 18,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: '#111',
                  outline: 'none',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#111' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
                autoComplete="off"
                autoFocus
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111' }}
            >
              Consultar estado
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 14 }}>
            Encontrás tu código en el comprobante de ingreso
          </p>
        </div>

        {/* Info section */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>
            ¿Cómo funciona el seguimiento?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🔢', title: 'Ingresá tu código', desc: 'Encontrás el código de 8 caracteres en el comprobante que te entregamos al dejar el equipo.' },
              { icon: '📊', title: 'Ver el estado actual', desc: 'Podés ver en qué etapa del proceso se encuentra tu dispositivo: Entrada, Laboratorio, Salida, etc.' },
              { icon: '📝', title: 'Notas del técnico', desc: 'Si el técnico dejó notas públicas sobre tu reparación, las podrás ver aquí.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Widget embed section */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
              Widget para tu sitio web
            </h2>
            <button
              onClick={handleCopyWidget}
              style={{
                padding: '6px 14px',
                background: copied ? '#d1fae5' : '#f3f4f6',
                border: `1px solid ${copied ? '#6ee7b7' : '#e5e7eb'}`,
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                color: copied ? '#065f46' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar código'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Pegá este código HTML en tu sitio web para que los clientes puedan buscar directamente desde ahí:
          </p>
          <pre style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 11,
            color: '#374151',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            lineHeight: 1.6,
          }}>
            {widgetCode}
          </pre>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
        Microsmart © 2025
      </footer>
    </div>
  )
}

export default function SeguimientoPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280' }}>
        Cargando...
      </div>
    }>
      <SeguimientoSearch />
    </Suspense>
  )
}
