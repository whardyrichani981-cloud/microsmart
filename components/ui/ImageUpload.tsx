'use client'
import { useRef, useState } from 'react'

interface Props {
  images: string[]
  onChange: (images: string[]) => void
  folder?: string
  maxImages?: number
  label?: string
}

export default function ImageUpload({ images, onChange, folder = 'microsmart', maxImages = 10, label = 'Fotos' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [lightbox, setLightbox]   = useState<string | null>(null)

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (!arr.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of arr) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        urls.push(data.url)
      }
    }
    onChange([...images, ...urls])
    setUploading(false)
  }

  function removeImage(url: string) {
    onChange(images.filter(i => i !== url))
  }

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </p>

      {/* Grid de imágenes existentes */}
      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {images.map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`foto ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => setLightbox(url)}
              />
              <button
                type="button"
                onClick={() => removeImage(url)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.9)', border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Zona de carga */}
      {images.length < maxImages && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 10,
            padding: '16px 12px',
            textAlign: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s',
          }}
        >
          {uploading ? (
            <p style={{ color: '#818cf8', fontSize: 13, margin: 0 }}>⏳ Subiendo...</p>
          ) : (
            <>
              <p style={{ fontSize: 22, margin: '0 0 4px' }}>📷</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                Arrastrá o hacé click para subir fotos
              </p>
              <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>
                JPG, PNG, HEIC — máx. {maxImages} fotos
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => e.target.files && uploadFiles(e.target.files)}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="foto ampliada"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', top: 20, right: 24,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: 28, cursor: 'pointer',
              borderRadius: 8, width: 44, height: 44,
            }}
          >×</button>
        </div>
      )}
    </div>
  )
}
