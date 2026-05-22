'use client'
import { useState, useEffect } from 'react'

export default function PanicfullSessionConfig() {
  const [cookies, setCookies] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sistema/panicfull-session')
      .then(r => r.json())
      .then(d => { setCookies(d.cookies || ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/sistema/panicfull-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const autoFill = () => {
    // Intenta leer PHPSESSID del browser actual si está logueado en panicfull.com
    // Solo funciona si el admin tiene panicfull.com abierto en la misma sesión del browser
    const cookieStr = document.cookie
    const hasPanic = cookieStr.includes('PHPSESSID')
    if (hasPanic) {
      // Tomar las cookies relevantes (sin las de analytics)
      const relevantCookies = cookieStr
        .split(';')
        .map(c => c.trim())
        .filter(c => {
          const name = c.split('=')[0].toLowerCase()
          return !name.startsWith('_ga') && !name.startsWith('_fb') && !name.startsWith('_g')
        })
        .join('; ')
      setCookies(relevantCookies)
    } else {
      alert('No se detectaron cookies de panicfull.com en este browser. Abrí panicfull.com, iniciá sesión, y volvé acá para usar este botón.')
    }
  }

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 12,
      border: '1px solid var(--border)', padding: '20px 22px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        🔐 Sesión panicfull.com Pro
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
        Pegá las cookies de sesión de tu cuenta Pro. Se actualizan acá sin tocar Vercel.
        <br />Cuando expire la sesión vas a ver un error al analizar — volvé acá para renovarlas.
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
        COOKIES DE SESIÓN
      </div>
      <textarea
        value={loading ? 'Cargando...' : cookies}
        onChange={e => setCookies(e.target.value)}
        rows={3}
        placeholder="PHPSESSID=xxx; temp_i1=temp_i1; ..."
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px', borderRadius: 8, fontSize: 12,
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          color: 'var(--text-primary)', resize: 'vertical',
          fontFamily: 'monospace', letterSpacing: '0.02em',
        }}
      />

      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={save}
          disabled={saving || !cookies.trim()}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: saved ? '#22c55e' : 'var(--accent)',
            color: '#fff', border: 'none',
            cursor: saving || !cookies.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {saved ? '✅ Guardado' : saving ? 'Guardando...' : '💾 Guardar'}
        </button>

        <button
          onClick={autoFill}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12,
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          🔄 Auto-leer del browser
        </button>

        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          O copiá desde Chrome: <strong>F12 → Application → Cookies → panicfull.com → PHPSESSID</strong>
        </span>
      </div>
    </div>
  )
}
