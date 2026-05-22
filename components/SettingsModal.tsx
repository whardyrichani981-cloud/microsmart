'use client'

import { useState, useEffect } from 'react'
import type { UserRole, Permissions } from '@/lib/roles'
import { PERM_LABELS, DEFAULT_EMPLOYEE_PERMISSIONS } from '@/lib/roles'

interface Props {
  currentUser: string
  displayName: string
  role: UserRole
  onNameChange: (name: string) => void
  onClose: () => void
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, color: '#E5E5E3', fontSize: 14, outline: 'none',
}
const btnSecondary: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface2)', color: '#676767', cursor: 'pointer', fontSize: 13,
}
const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: 'none',
  background: '#F5C400', color: '#0c0d0f', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        background: checked ? '#F5C400' : '#2E2E2E',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Employee permissions editor ───────────────────────────────────────────────
function PermissionsPanel() {
  const [perms, setPerms] = useState<Record<string, Permissions>>({})
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then(r => r.json())
      .then(data => {
        setPerms(data.resolved ?? {})
        setDisplayNames(data.displayNames ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleToggle = (username: string, key: keyof Permissions, value: boolean) => {
    setPerms(prev => ({
      ...prev,
      [username]: { ...(prev[username] ?? DEFAULT_EMPLOYEE_PERMISSIONS), [key]: value },
    }))
  }

  const handleSave = async (username: string) => {
    setSaving(username)
    try {
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, permissions: perms[username] }),
      })
      setSaved(username)
      setTimeout(() => setSaved(null), 2000)
    } finally { setSaving(null) }
  }

  if (loading) return <div style={{ padding: 20, color: '#676767', fontSize: 13 }}>Cargando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.keys(perms).map(username => {
        const p = perms[username] ?? DEFAULT_EMPLOYEE_PERMISSIONS
        return (
          <div key={username} style={{
            border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px', background: 'rgba(245,196,0,0.07)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#E5E5E3' }}>
                  {displayNames[username] ?? username}
                </div>
                <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>
                  @{username} · Empleado
                </div>
              </div>
              <button
                onClick={() => handleSave(username)}
                disabled={saving === username}
                style={{
                  ...btnPrimary,
                  padding: '6px 14px', fontSize: 12,
                  opacity: saving === username ? 0.7 : 1,
                  cursor: saving === username ? 'not-allowed' : 'pointer',
                  background: saved === username ? '#059669' : '#F5C400',
                }}
              >
                {saved === username ? '✓ Guardado' : saving === username ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            {/* Permissions */}
            <div style={{ padding: '4px 0' }}>
              {(Object.keys(PERM_LABELS) as (keyof Permissions)[]).map(key => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontSize: 13, color: '#E5E5E3' }}>{PERM_LABELS[key]}</span>
                  <Toggle checked={p[key]} onChange={v => handleToggle(username, key, v)} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SettingsModal({ currentUser, displayName, role, onNameChange, onClose }: Props) {
  const isSuperAdmin = role === 'superadmin'
  const [tab, setTab] = useState<'cuenta' | 'accesos'>('cuenta')
  const [nameInput, setNameInput] = useState(displayName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  const handleSaveName = async () => {
    if (!nameInput.trim()) { setNameError('El nombre no puede estar vacío'); return }
    setNameSaving(true); setNameError('')
    try {
      const res = await fetch('/api/users/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error') }
      onNameChange(nameInput.trim())
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (e) { setNameError(String(e)) }
    finally { setNameSaving(false) }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{
        width: isSuperAdmin ? 520 : 420,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 0', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#F5C400" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.36 2.54a7.37 7.37 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.63 8.48a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.36 1.04.67 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54a7.37 7.37 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#E5E5E3' }}>Configuración</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#676767',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {/* Tabs — only for superadmin */}
        {isSuperAdmin && (
          <div style={{ padding: '16px 24px 0', flexShrink: 0, display: 'flex', gap: 4 }}>
            {([
              { id: 'cuenta',  label: '👤 Mi cuenta' },
              { id: 'accesos', label: '🔐 Accesos de empleados' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                background: tab === t.id ? '#F5C400' : 'var(--surface2)',
                color: tab === t.id ? '#fff' : '#676767',
                transition: 'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          {/* Tab: Mi cuenta */}
          {tab === 'cuenta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Role badge */}
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: isSuperAdmin ? 'rgba(245,196,0,0.07)' : 'rgba(74,222,128,0.06)',
                border: `1px solid ${isSuperAdmin ? 'rgba(245,196,0,0.25)' : 'rgba(74,222,128,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: '#676767' }}>
                    Usuario: <span style={{ color: '#F5C400', fontWeight: 600 }}>@{currentUser}</span>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: isSuperAdmin ? 'rgba(245,196,0,0.12)' : 'rgba(74,222,128,0.15)',
                  color: isSuperAdmin ? '#F5C400' : '#4ade80',
                  border: `1px solid ${isSuperAdmin ? 'rgba(245,196,0,0.28)' : 'rgba(74,222,128,0.3)'}`,
                }}>
                  {isSuperAdmin ? '⭐ Super Admin' : '👷 Empleado'}
                </span>
              </div>

              {/* Name field */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8A', display: 'block', marginBottom: 8 }}>
                  Nombre para mostrar
                </label>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                  placeholder="Tu nombre completo"
                  style={inputStyle}
                />
              </div>

              {nameError && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5',
                }}>
                  {nameError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving}
                  style={{
                    ...btnPrimary,
                    opacity: nameSaving ? 0.7 : 1,
                    cursor: nameSaving ? 'not-allowed' : 'pointer',
                    background: nameSaved ? '#059669' : '#F5C400',
                  }}
                >
                  {nameSaved ? '✓ Guardado' : nameSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: Accesos */}
          {tab === 'accesos' && isSuperAdmin && <PermissionsPanel />}
        </div>
      </div>

      <style>{`input::placeholder{color:#484848}input:focus{border-color:#F5C400!important}`}</style>
    </div>
  )
}
