'use client'
import { useState } from 'react'
import UsuariosView from './sistema/UsuariosView'
import ConfiguracionView from './sistema/ConfiguracionView'
import { usePWAInstall, PWAInstructionsModal } from './PWAInstaller'

const COLOR = '#a78bfa'

const SECTIONS = [
  {
    id: 'usuarios' as const,
    icon: '👤',
    label: 'Usuarios',
    desc: 'Gestioná accesos y permisos de cada integrante del equipo',
  },
  {
    id: 'configuracion' as const,
    icon: '🧩',
    label: 'Configuración del Sistema',
    desc: 'Activá o desactivá los módulos del menú para cada usuario',
  },
]

export default function AdminView({
  onModulosChange,
  onModulosSaved,
}: {
  onModulosChange?: (config: Record<string, boolean>) => void
  onModulosSaved?: (config: Record<string, boolean>) => void
}) {
  const [section, setSection] = useState<'usuarios' | 'configuracion' | null>(null)
  const pwa = usePWAInstall()

  if (section === 'usuarios') {
    return <UsuariosView onBack={() => setSection(null)} />
  }
  if (section === 'configuracion') {
    return <ConfiguracionView onBack={() => setSection(null)} onModulosChange={onModulosChange} onModulosSaved={onModulosSaved} />
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E5E5E3', margin: 0 }}>Administración</h2>
        </div>
        <div style={{ fontSize: 13, color: '#8A8A8A', marginLeft: 34 }}>Configuración del sistema — solo administradores</div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              padding: '22px 20px', borderRadius: 12, border: `1px solid var(--border)`,
              background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = COLOR
              e.currentTarget.style.background = `${COLOR}0d`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <span style={{ fontSize: 28 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: '#8A8A8A', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
            <div style={{ fontSize: 11, color: COLOR, fontWeight: 600, marginTop: 4 }}>Configurar →</div>
          </button>
        ))}

        {/* Card instalación PWA */}
        {pwa.showInstallButton && (
          <button
            onClick={pwa.install}
            style={{
              padding: '22px 20px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#0A84FF'
              e.currentTarget.style.background = 'rgba(0,132,255,0.07)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <span style={{ fontSize: 28 }}>📲</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3', marginBottom: 4 }}>Instalar como app</div>
              <div style={{ fontSize: 12, color: '#8A8A8A', lineHeight: 1.4 }}>
                Instalá el sistema en el escritorio para abrirlo sin navegador
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#0A84FF', fontWeight: 600, marginTop: 4 }}>Instalar →</div>
          </button>
        )}
      </div>

      {pwa.showModal && <PWAInstructionsModal onClose={() => pwa.setShowModal(false)} />}
    </div>
  )
}
