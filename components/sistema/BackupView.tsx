'use client'

import { useState, useEffect, useCallback } from 'react'

interface BackupFile {
  name: string
  size: number
  createdAt: string
}

interface BackupMeta {
  lastBackup: string | null
  lastBackupFile: string | null
  lastBackupSize: number
  totalBackups: number
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function hoursAgo(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

export default function BackupView() {
  const [meta, setMeta] = useState<BackupMeta | null>(null)
  const [files, setFiles] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sistema/backup?list=1')
      if (res.ok) {
        const data = await res.json()
        setMeta(data.meta)
        setFiles(data.files ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const triggerBackup = async () => {
    setSaving(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/sistema/backup', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setLastResult({ ok: true, msg: `Backup guardado: ${data.file} (${fmtSize(data.size)})` })
        await loadList()
      } else {
        setLastResult({ ok: false, msg: data.error ?? 'Error desconocido' })
      }
    } catch (e) {
      setLastResult({ ok: false, msg: String(e) })
    } finally {
      setSaving(false)
    }
  }

  const downloadFile = async (name: string) => {
    setDownloading(name)
    try {
      const res = await fetch(`/api/sistema/backup?file=${encodeURIComponent(name)}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const downloadLatest = async () => {
    setDownloading('live')
    try {
      const res = await fetch('/api/sistema/backup')
      if (!res.ok) return
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      const name = match?.[1] ?? 'backup.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const age = hoursAgo(meta?.lastBackup ?? null)
  const statusColor = age < 25 ? '#4ade80' : age < 49 ? '#fbbf24' : '#f87171'
  const statusLabel = age < 25 ? 'Al día' : age < 49 ? 'Ayer' : age === Infinity ? 'Sin backups' : `Hace ${Math.round(age)} h`
  const statusIcon  = age < 25 ? '✅' : age < 49 ? '⚠️' : '🔴'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E5E5E3', margin: 0 }}>
          💾 Backup del sistema
        </h2>
        <p style={{ fontSize: 13, color: '#676767', margin: '4px 0 0' }}>
          Respaldo automático diario a las 3:00 AM · Conserva los últimos 30 backups
        </p>
      </div>

      {/* Estado actual */}
      <div style={{
        background: 'var(--surface)',
        border: `1px solid ${statusColor}44`,
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: 12,
        padding: '18px 22px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{statusIcon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: statusColor }}>{statusLabel}</span>
          </div>
          {meta?.lastBackup ? (
            <div style={{ fontSize: 13, color: '#8A8A8A' }}>
              Último backup: <span style={{ color: '#E5E5E3' }}>{fmtDate(meta.lastBackup)}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#484848' }}>No hay backups guardados todavía</div>
          )}
          {meta?.lastBackupSize ? (
            <div style={{ fontSize: 12, color: '#676767', marginTop: 2 }}>
              Tamaño: {fmtSize(meta.lastBackupSize)} · Total guardados: {meta.totalBackups}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Backup ahora */}
          <button
            onClick={triggerBackup}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13,
              background: saving ? 'var(--surface2)' : '#F5C400',
              border: 'none',
              color: saving ? '#484848' : '#0c0d0f',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {saving ? (
              <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Guardando...</>
            ) : (
              <>💾 Hacer backup ahora</>
            )}
          </button>

          {/* Descargar copia al instante */}
          <button
            onClick={downloadLatest}
            disabled={downloading === 'live'}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 9, fontWeight: 600, fontSize: 13,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: '#E5E5E3', cursor: 'pointer',
            }}
          >
            {downloading === 'live' ? '⟳ Descargando...' : '⬇ Descargar ahora'}
          </button>
        </div>
      </div>

      {/* Resultado del último backup manual */}
      {lastResult && (
        <div style={{
          padding: '12px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500,
          background: lastResult.ok ? 'rgba(74,222,128,0.10)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${lastResult.ok ? '#22c55e55' : '#ef444455'}`,
          color: lastResult.ok ? '#4ade80' : '#f87171',
        }}>
          {lastResult.ok ? '✓ ' : '✗ '}{lastResult.msg}
        </div>
      )}

      {/* Info del cron */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>⏰</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#E5E5E3', marginBottom: 4 }}>
            Backup automático diario — 3:00 AM
          </div>
          <div style={{ fontSize: 12, color: '#676767', lineHeight: 1.6 }}>
            Configurado en Vercel Cron Jobs para ejecutarse automáticamente cada día a las 03:00 AM.
            Si el sistema está hosteado localmente, podés configurar una tarea programada de Windows
            que haga un GET a <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>/api/cron/backup</code>.
            Se conservan los últimos <strong style={{ color: '#E5E5E3' }}>30 backups</strong> automáticamente.
          </div>
        </div>
      </div>

      {/* Historial */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#E5E5E3', marginBottom: 12 }}>
          📁 Backups guardados ({files.length})
        </div>

        {loading ? (
          <div style={{ color: '#484848', fontSize: 13, padding: '20px 0' }}>Cargando...</div>
        ) : files.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            border: '1px dashed var(--border)', borderRadius: 10,
            color: '#484848', fontSize: 13,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
            No hay backups guardados. Hacé tu primer backup con el botón de arriba.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((f, i) => {
              const isLatest = i === 0
              const fileAge = hoursAgo(f.createdAt)
              const dot = fileAge < 25 ? '#4ade80' : fileAge < 49 ? '#fbbf24' : '#8A8A8A'
              return (
                <div
                  key={f.name}
                  style={{
                    background: isLatest ? 'rgba(245,196,0,0.04)' : 'var(--surface)',
                    border: `1px solid ${isLatest ? 'rgba(245,196,0,0.2)' : 'var(--border)'}`,
                    borderRadius: 9,
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: dot, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E5E3', fontFamily: 'monospace' }}>
                        {f.name}
                      </span>
                      {isLatest && (
                        <span style={{
                          fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 700,
                          background: 'rgba(245,196,0,0.15)', color: '#F5C400',
                          border: '1px solid rgba(245,196,0,0.3)',
                        }}>último</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>
                      {fmtDate(f.createdAt)} · {fmtSize(f.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadFile(f.name)}
                    disabled={downloading === f.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: '#E5E5E3', cursor: 'pointer', flexShrink: 0,
                      opacity: downloading === f.name ? 0.5 : 1,
                    }}
                  >
                    {downloading === f.name ? '⟳' : '⬇'} Descargar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
