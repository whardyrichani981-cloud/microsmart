'use client'

import { useState } from 'react'
import type { Permissions } from '@/lib/roles'
import { PERM_LABELS } from '@/lib/roles'
import { C, PageHeader, useApi, inputSt } from './shared'

interface UserData {
  username: string
  displayName: string
  role: 'superadmin' | 'employee'
  permissions: Permissions
}

const COMPARADOR_KEYS: (keyof Permissions)[] = [
  'canViewComparador',
  'canViewGremio',
  'canViewCF',
  'canViewProveedores',
  'canViewNotas',
  'canUploadSuppliers',
  'canManageNotas',
  'canViewIMEI',
]

const SISTEMA_KEYS: (keyof Permissions)[] = [
  'canViewOrdenes',
  'canViewServicios',
  'canViewClientes',
  'canViewAgenda',
  'canViewStock',
  'canViewVentas',
  'canViewGastos',
  'canViewComisiones',
  'canViewReportes',
]

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 32, height: 18, borderRadius: 9,
        background: enabled ? '#4ade80' : 'var(--border)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: enabled ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  )
}

function CredencialesPanel({
  user,
  onSaved,
  onClose,
}: {
  user: UserData
  onSaved: () => void
  onClose: () => void
}) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [login, setLogin] = useState(user.username)
  const [pass, setPass] = useState('')
  const [passConfirm, setPassConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const passChanged = pass.trim() !== ''
  const isDirty =
    displayName.trim() !== user.displayName ||
    login.trim() !== user.username ||
    passChanged

  const validate = () => {
    if (!displayName.trim()) return 'El nombre no puede estar vacío'
    if (!login.trim()) return 'El login no puede estar vacío'
    if (passChanged && pass !== passConfirm) return 'Las contraseñas no coinciden'
    if (passChanged && pass.length < 4) return 'La contraseña debe tener al menos 4 caracteres'
    return ''
  }

  const save = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/sistema/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldUsername: user.username,
          newUsername: login.trim() !== user.username ? login.trim() : undefined,
          password: passChanged ? pass : undefined,
          displayName: displayName.trim() !== user.displayName ? displayName.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onSaved()
        onClose()
      }, 1200)
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle: React.CSSProperties = {
    ...inputSt,
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 13,
    padding: '8px 10px',
  }

  return (
    <div style={{
      marginTop: 4,
      padding: '16px',
      borderRadius: 10,
      background: 'rgba(96,165,250,0.06)',
      border: '1px solid rgba(96,165,250,0.18)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        ✏️ Editar credenciales
      </div>

      {/* Nombre de pantalla */}
      <div>
        <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Nombre de pantalla</label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          style={fieldStyle}
          placeholder="Nombre visible en el sistema"
        />
      </div>

      {/* Login */}
      <div>
        <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Login (usuario)</label>
        <input
          value={login}
          onChange={e => setLogin(e.target.value)}
          style={fieldStyle}
          placeholder="nombre de usuario para ingresar"
          autoComplete="off"
        />
      </div>

      {/* Nueva contraseña */}
      <div>
        <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>
          Nueva contraseña <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(dejar vacío para no cambiar)</span>
        </label>
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          style={fieldStyle}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      {/* Confirmar contraseña */}
      {passChanged && (
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Confirmar contraseña</label>
          <input
            type="password"
            value={passConfirm}
            onChange={e => setPassConfirm(e.target.value)}
            style={{
              ...fieldStyle,
              borderColor: passConfirm && pass !== passConfirm ? '#f87171' : undefined,
            }}
            placeholder="••••••••"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: '#f87171', padding: '6px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={save}
          disabled={!isDirty || saving}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: saved ? '#4ade80' : isDirty ? '#60a5fa' : C.border,
            color: saved || isDirty ? '#FFFFFF' : C.dim,
            cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'none', color: C.muted, fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function UserCard({ user, onSaved }: { user: UserData; onSaved: () => void }) {
  const [perms, setPerms] = useState<Permissions>({ ...user.permissions })
  const [saving, setSaving] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const isSuperAdmin = user.role === 'superadmin'

  const isDirty = !isSuperAdmin && (Object.keys(perms) as (keyof Permissions)[]).some(
    k => perms[k] !== user.permissions[k]
  )

  const toggle = (key: keyof Permissions) => {
    if (isSuperAdmin) return
    setPerms(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/sistema/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, permissions: perms }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const roleBadgeColor = isSuperAdmin ? '#fbbf24' : '#60a5fa'

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: isSuperAdmin ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.15)',
          border: `2px solid ${roleBadgeColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: roleBadgeColor, flexShrink: 0,
        }}>
          {initials(user.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {user.displayName}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>@{user.username}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: `${roleBadgeColor}18`, color: roleBadgeColor,
            border: `1px solid ${roleBadgeColor}33`, whiteSpace: 'nowrap',
          }}>
            {isSuperAdmin ? 'Superadmin' : 'Empleado'}
          </span>
          {/* Botón editar credenciales — solo para empleados */}
          {!isSuperAdmin && (
            <button
              onClick={() => setShowEdit(v => !v)}
              title="Editar credenciales"
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: `1px solid ${showEdit ? '#60a5fa' : 'var(--border)'}`,
                background: showEdit ? 'rgba(96,165,250,0.12)' : 'none',
                color: showEdit ? '#60a5fa' : C.muted,
                cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              ✏️
            </button>
          )}
        </div>
      </div>

      {/* Panel de edición de credenciales */}
      {!isSuperAdmin && showEdit && (
        <CredencialesPanel
          user={user}
          onSaved={onSaved}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Superadmin: read-only message */}
      {isSuperAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px', borderRadius: 8,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
          color: '#4ade80', fontSize: 13, fontWeight: 600,
        }}>
          <span>✓</span>
          <span>Acceso completo</span>
        </div>
      )}

      {/* Employee: permission toggles */}
      {!isSuperAdmin && (
        <>
          {/* Section: Comparador */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📊 Comparador
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COMPARADOR_KEYS.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, color: perms[key] ? C.text : C.muted }}>
                    {PERM_LABELS[key]}
                  </span>
                  <Toggle enabled={perms[key]} onClick={() => toggle(key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border }} />

          {/* Section: Sistema */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚙️ Sistema
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SISTEMA_KEYS.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, color: perms[key] ? C.text : C.muted }}>
                    {PERM_LABELS[key]}
                  </span>
                  <Toggle enabled={perms[key]} onClick={() => toggle(key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Save perms button */}
          <button
            onClick={save}
            disabled={!isDirty || saving}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: isDirty ? '#4ade80' : C.border,
              color: isDirty ? '#FFFFFF' : C.dim,
              cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (isDirty && !saving) e.currentTarget.style.background = '#22c55e' }}
            onMouseLeave={e => { if (isDirty && !saving) e.currentTarget.style.background = '#4ade80' }}
          >
            {saving ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </>
      )}
    </div>
  )
}

export default function UsuariosView({ onBack }: { onBack?: () => void }) {
  const { data, loading, refresh } = useApi<UserData[]>('/api/sistema/usuarios')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          ← Volver
        </button>
      )}
      <PageHeader
        icon="👤"
        title="Usuarios"
        desc="Gestión de accesos y permisos"
        color={C.blue}
      />

      {loading && (
        <div style={{ color: C.muted, fontSize: 13 }}>Cargando usuarios…</div>
      )}

      {!loading && data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
        }}>
          {data.map(user => (
            <UserCard key={user.username} user={user} onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}
