'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Hook exportado para que PriceComparator pueda usar el estado y el botón
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  // mounted evita el mismatch de hidratación — el botón solo aparece en el cliente
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone) {
      setIsInstalled(true)
      return
    }
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
      setInstallPrompt(null)
    } else {
      setShowModal(true)
    }
  }

  // Mostrar siempre que: esté montado en cliente, no esté ya instalado en standalone
  // No depende de que beforeinstallprompt haya disparado — si no hay prompt nativo
  // el botón igual aparece y muestra instrucciones manuales al hacer click
  const showInstallButton = mounted && !isInstalled

  return { installPrompt, isInstalled, install, showModal, setShowModal, showInstallButton }
}

// Modal con instrucciones manuales (para cuando no hay prompt nativo)
export function PWAInstructionsModal({ onClose }: { onClose: () => void }) {
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 901, width: 400, borderRadius: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)', padding: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0066CC,#0A84FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍎</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Instalar Microsmart</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Seguí estos pasos en tu navegador</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {isIOS ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: 1, text: 'Tocá el botón Compartir', icon: '⬆️', hint: '(ícono de cuadrado con flecha, abajo de la pantalla)' },
              { n: 2, text: 'Seleccioná "Agregar a pantalla de inicio"', icon: '➕', hint: '' },
              { n: 3, text: 'Tocá "Agregar" para confirmar', icon: '✅', hint: '' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.icon} {s.text}</div>
                  {s.hint && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: 1, text: 'Hacé click en el ícono ⊕ en la barra de dirección', icon: '🖱️', hint: '(aparece a la derecha de la URL, en Chrome y Edge)' },
              { n: 2, text: 'Seleccioná "Instalar Microsmart"', icon: '📲', hint: '' },
              { n: 3, text: 'Confirmá en el diálogo que aparece', icon: '✅', hint: 'El sistema se abre como app sin barra del navegador' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.icon} {s.text}</div>
                  {s.hint && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// Componente vacío — solo registra el SW (el botón vive en PriceComparator)
export default function PWAInstaller() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
