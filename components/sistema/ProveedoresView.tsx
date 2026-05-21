'use client'
import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { matchesAny } from '@/lib/search'
import type { Proveedor } from '@/lib/sistema-types'
import type { SupplierItem } from '@/lib/types'
import {
  useApi, C, Modal, Field, FormGrid, PageHeader,
  inputSt, AutoCapInput,
} from './shared'
import ComparadorListasView from '@/components/ComparadorListasView'

const COLOR = '#60a5fa'

// ── Types ─────────────────────────────────────────────────────────────────────
type FormState = { nombre: string; telefono: string; direccion: string }

interface ListaConItems {
  filename: string
  items: number
  updatedAt: string
  itemsData: SupplierItem[]
}

interface BuiltinSupplier {
  id: string
  name: string
  items: SupplierItem[]
  error?: string
}

function buildEmpty(): FormState {
  return { nombre: '', telefono: '', direccion: '' }
}

/** Normalize name for matching: "BH Tech" → "bhtech" */
function normName(s: string) {
  return s.toLowerCase().replace(/[\s\-_]/g, '')
}

/** Format ARS currency */
function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

/** Format USD currency */
function fmtUSD(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'symbol', maximumFractionDigits: 2 }).format(n)
}

// ── Search highlight ───────────────────────────────────────────────────────────
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>
  const re = new RegExp(`(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        re.test(p)
          ? <mark key={i} style={{ background: `${COLOR}50`, color: '#fff', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
          : p
      )}
    </>
  )
}

// ── Items table ────────────────────────────────────────────────────────────────
function ItemsTable({ items, search }: { items: SupplierItem[]; search: string }) {
  const filtered = search.trim()
    ? items.filter(it => matchesAny([it.name, it.code, it.category, it.quality, it.brand, it.description], search))
    : items

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        {search.trim() ? `Sin resultados para "${search}"` : 'Lista vacía'}
      </div>
    )
  }

  const hasQuality = filtered.some(it => it.quality)
  const hasBrand   = filtered.some(it => it.brand)
  const hasARS     = filtered.some(it => it.priceARS != null && it.priceARS > 0)
  const hasDesc    = filtered.some(it => it.description)

  const thSt: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', color: C.muted,
    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
            <th style={thSt}>Nombre</th>
            <th style={{ ...thSt, width: 90 }}>Código</th>
            {hasQuality && <th style={{ ...thSt, width: 160 }}>Calidad</th>}
            {hasBrand   && <th style={{ ...thSt, width: 120 }}>Marca</th>}
            <th style={{ ...thSt, width: 110 }}>Categoría</th>
            <th style={{ ...thSt, textAlign: 'right', width: 100 }}>
              <span style={{ color: '#4ade80' }}>USD $</span>
            </th>
            {hasARS && (
              <th style={{ ...thSt, textAlign: 'right', width: 110 }}>
                <span style={{ color: '#facc15' }}>ARS $</span>
              </th>
            )}
            {hasDesc && <th style={{ ...thSt, width: 200 }}>Descripción</th>}
            <th style={{ ...thSt, textAlign: 'center', width: 90 }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              <td style={{ padding: '7px 12px', color: '#E5E5E3', fontWeight: 500 }}>
                <Highlight text={it.name} q={search} />
              </td>
              <td style={{ padding: '7px 12px', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>
                {it.code || '—'}
              </td>
              {hasQuality && (
                <td style={{ padding: '7px 12px' }}>
                  {it.quality
                    ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${COLOR}15`, color: COLOR, fontWeight: 600 }}>
                        <Highlight text={it.quality} q={search} />
                      </span>
                    : <span style={{ color: C.muted }}>—</span>}
                </td>
              )}
              {hasBrand && (
                <td style={{ padding: '7px 12px', color: C.muted, fontSize: 12 }}>
                  {it.brand
                    ? <Highlight text={it.brand} q={search} />
                    : '—'}
                </td>
              )}
              <td style={{ padding: '7px 12px' }}>
                {it.category ? (
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#8A8A8A', fontWeight: 600 }}>
                    <Highlight text={it.category} q={search} />
                  </span>
                ) : <span style={{ color: C.muted }}>—</span>}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                  {fmtUSD(it.price)}
                </div>
              </td>
              {hasARS && (
                <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                  {it.priceARS != null && it.priceARS > 0
                    ? <div style={{ color: '#facc15', fontWeight: 600, fontSize: 12 }}>{fmtARS(it.priceARS)}</div>
                    : <span style={{ color: C.muted }}>—</span>}
                </td>
              )}
              {hasDesc && (
                <td style={{ padding: '7px 12px', color: C.muted, fontSize: 12 }}>
                  {it.description
                    ? <Highlight text={it.description} q={search} />
                    : '—'}
                </td>
              )}
              <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                {it.stock ? (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4,
                    background: /stock/i.test(it.stock) ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)',
                    color: /stock/i.test(it.stock) ? '#4ade80' : '#facc15',
                    fontWeight: 600,
                  }}>
                    {it.stock}
                  </span>
                ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────
export default function ProveedoresView() {
  const { data: proveedores, loading, refresh } = useApi<Proveedor[]>('/api/sistema/proveedores')

  // Modal / form state
  const [modal, setModal]             = useState<false | 'new' | 'edit'>(false)
  const [form, setForm]               = useState<FormState>(buildEmpty())
  const [editId, setEditId]           = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Price list state
  const [builtins, setBuiltins]       = useState<BuiltinSupplier[] | null>(null)
  const [uploadedListas, setUploaded] = useState<Record<string, ListaConItems>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  // URL upload modal
  const [urlModal, setUrlModal]       = useState<{ id: string; nombre: string } | null>(null)
  const [urlInput, setUrlInput]       = useState('')
  const [urlError, setUrlError]       = useState('')
  const [urlMode, setUrlMode]         = useState<'file' | 'url'>('file')

  // Expanded card state
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [expandSearch, setExpandSearch] = useState('')

  // Fetch builtin supplier data
  useEffect(() => {
    fetch('/api/suppliers')
      .then(r => r.json())
      .then((data: BuiltinSupplier[]) => setBuiltins(data))
      .catch(() => setBuiltins([]))
  }, [])

  // Fetch uploaded lista items lazily when a card expands
  // (metas are seeded on mount with itemsData: [] — only skip if items already loaded)
  const fetchUploadedLista = async (proveedorId: string) => {
    const existing = uploadedListas[proveedorId]
    if (existing && existing.itemsData.length > 0) return // items already loaded
    try {
      const res = await fetch(`/api/sistema/proveedores/${proveedorId}/lista`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setUploaded(prev => ({ ...prev, [proveedorId]: data as ListaConItems }))
        }
      }
    } catch { /* ignore */ }
  }

  // Load metas for all providers on mount
  useEffect(() => {
    fetch('/api/sistema/proveedores/listas', { cache: 'no-store' })
      .then(r => r.json())
      .then((metas: Record<string, { filename: string; items: number; updatedAt: string }>) => {
        // Seed uploaded state with metas (no items yet — fetched lazily)
        setUploaded(prev => {
          const next = { ...prev }
          for (const [id, meta] of Object.entries(metas)) {
            if (!next[id]) next[id] = { ...meta, itemsData: [] }
          }
          return next
        })
      })
      .catch(() => {})
  }, [])

  // Get items for a provider: prefer uploaded, fallback to builtin
  const getItems = (p: Proveedor): { items: SupplierItem[]; source: 'upload' | 'builtin' | 'none' } => {
    const uploaded = uploadedListas[p.id]
    if (uploaded && uploaded.itemsData?.length > 0)
      return { items: uploaded.itemsData, source: 'upload' }

    const norm = normName(p.nombre)
    const builtin = builtins?.find(s => normName(s.name) === norm)
    if (builtin && builtin.items.length > 0)
      return { items: builtin.items, source: 'builtin' }

    return { items: [], source: 'none' }
  }

  // Get item count for summary badge
  const getItemCount = (p: Proveedor): number | null => {
    const uploaded = uploadedListas[p.id]
    if (uploaded) return uploaded.items

    const norm = normName(p.nombre)
    const builtin = builtins?.find(s => normName(s.name) === norm)
    if (builtin) return builtin.items.length

    return null
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const set = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const openNew = () => {
    setForm(buildEmpty())
    setEditId(null)
    setModal('new')
  }

  const openEdit = (p: Proveedor) => {
    setForm({ nombre: p.nombre, telefono: p.telefono ?? '', direccion: p.direccion ?? '' })
    setEditId(p.id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            contacto: '', mail: '', web: '', condicionesPago: '', notas: '',
          }),
        })
      } else {
        await fetch(`/api/sistema/proveedores/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    await fetch(`/api/sistema/proveedores/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    if (expandedId === id) setExpandedId(null)
    await refresh()
  }

  const handleUploadClick = (id: string, nombre: string) => {
    setUrlInput(''); setUrlError(''); setUrlMode('file')
    setUrlModal({ id, nombre })
  }

  const handleUrlModalFile = () => {
    if (!urlModal) return
    setUploadTargetId(urlModal.id)
    setUrlModal(null)
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click() }
  }

  const handleUrlModalSubmit = async () => {
    if (!urlModal) return
    if (!urlInput.trim()) { setUrlError('Ingresá un enlace'); return }
    const id = urlModal.id
    setUrlModal(null)
    setUploadingId(id)
    try {
      const res = await fetch(`/api/sistema/proveedores/${id}/lista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      await afterUpload(id, res)
    } catch (err) {
      alert(`Error de red: ${String(err)}`)
    } finally {
      setUploadingId(null)
    }
  }

  /** Shared post-upload logic for both file and URL modes */
  const afterUpload = async (id: string, res: Response) => {
    if (res.ok) {
      const result = await res.json()
      if (result.items === 0 && result.preview) {
        const previewStr = (result.preview as string[][])
          .map((row: string[], i: number) => `Fila ${i}: ${row.filter(Boolean).join(' | ')}`)
          .join('\n')
        alert(
          `⚠️ No se encontraron productos en "${result.filename}".\n\n` +
          `Encabezados detectados:\n${previewStr}\n\n` +
          `Copiá esto y compartilo para ajustar el parser.`
        )
      }
      const metaRes = await fetch(`/api/sistema/proveedores/${id}/lista`, { cache: 'no-store' })
      if (metaRes.ok) {
        const data = await metaRes.json()
        if (data) setUploaded(prev => ({ ...prev, [id]: data as ListaConItems }))
      }
      setExpandedId(id)
      setExpandSearch('')
    } else {
      const err = await res.json()
      alert(`Error al subir: ${err.error ?? 'Error desconocido'}`)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetId) return
    const id = uploadTargetId
    setUploadingId(id)
    setUploadTargetId(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/sistema/proveedores/${id}/lista`, { method: 'POST', body: fd })
      await afterUpload(id, res)
    } catch (err) {
      alert(`Error de red: ${String(err)}`)
    } finally {
      setUploadingId(null)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandSearch('')
      return
    }
    setExpandedId(id)
    setExpandSearch('')
    await fetchUploadedLista(id)
  }

  const list = proveedores ?? []

  // ── Sub-tab state ─────────────────────────────────────────────────────────
  type ViewTab = 'directorio' | 'comparar'
  const [viewTab, setViewTab] = useState<ViewTab>('directorio')

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon="🏭"
        title="Proveedores"
        desc="Directorio de proveedores con sus listas de precios"
        color={COLOR}
        count={list.length}
        onNew={viewTab === 'directorio' ? openNew : undefined}
        newLabel="+ Agregar proveedor"
        extra={
          <button
            onClick={() => {
              const header = ['Nombre', 'Código', 'Calidad', 'Marca', 'Categoría', 'Precio USD', 'Precio ARS', 'Descripción']
              const examples = [
                ['LCD & TP iPhone 15 Pro Max Soft OLED', '5493', 'Soft OLED X07', 'Mobilesentrix', 'módulos', 210, '', 'Apto IC - 120Hz'],
                ['Batería iPhone 14 Ampsentrix Plus', '5487', 'Ampsentrix Plus', 'Ampsentrix', 'baterías', 23, '', 'Autoprogramable'],
                ['Vidrio Trasero iPhone 14 Pro Max Negro', '4320', 'Premium', '', 'vidrios', 8, 9200, ''],
                ['Cámara Trasera iPhone 13 Pro Triple', '3614', 'Original Pull', 'Apple', 'cámaras', 45, '', ''],
                ['Flex Carga iPhone 12', '3191', 'Compatible', '', 'flex', 5, '', ''],
              ]
              const ws = XLSX.utils.aoa_to_sheet([header, ...examples])
              ws['!cols'] = [{ wch: 42 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 28 }]
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios')
              XLSX.writeFile(wb, 'plantilla-lista-proveedor.xlsx')
            }}
            title="Descargá la plantilla Excel para armar listas de precios"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #333', background: 'transparent',
              color: '#676767', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#E5E5E3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#676767' }}
          >
            📥 Plantilla Excel
          </button>
        }
      />

      {/* ── Sub-tab bar ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '1px solid var(--border)',
      }}>
        {([
          { id: 'directorio' as const, label: '🏭 Directorio' },
          { id: 'comparar'   as const, label: '📊 Comparar listas' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewTab(tab.id)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              color: viewTab === tab.id ? COLOR : C.muted,
              borderBottom: viewTab === tab.id ? `2px solid ${COLOR}` : '2px solid transparent',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Comparar listas sub-tab ───────────────────────────────────── */}
      {viewTab === 'comparar' && <ComparadorListasView />}

      {/* ── Directorio sub-tab ───────────────────────────────────────── */}
      {viewTab === 'directorio' && (loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 14 }}>No hay proveedores registrados.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Hacé clic en <strong style={{ color: COLOR }}>+ Agregar proveedor</strong> para comenzar.
          </div>
        </div>
      ) : (<>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(p => {
            const isExpanded    = expandedId === p.id
            const isUploading   = uploadingId === p.id
            const itemCount     = getItemCount(p)
            const hasUpload     = !!uploadedListas[p.id]
            const hasAnyList    = itemCount !== null && itemCount > 0
            const { items: expandedItems, source } = isExpanded
              ? getItems(p)
              : { items: [], source: 'none' as const }

            // Filter for search within expanded view
            const searchQ = expandSearch.trim()
            const filteredItems = searchQ
              ? expandedItems.filter(it => matchesAny([it.name, it.code, it.category, it.quality, it.brand, it.description], searchQ))
              : expandedItems

            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isExpanded ? `${COLOR}60` : 'var(--border)'}`,
                  borderRadius: 12,
                  transition: 'border-color 0.15s',
                  overflow: 'hidden',
                }}
              >
                {/* ── Card header ─────────────────────────────────────── */}
                <div style={{
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                }}>
                  {/* Provider avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: `${COLOR}18`, border: `1.5px solid ${COLOR}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>🏭</div>

                  {/* Name + contact */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3', marginBottom: 3 }}>
                      {p.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: C.muted }}>
                      {p.telefono && (
                        <span>📞 <span style={{ fontFamily: 'monospace' }}>{p.telefono}</span></span>
                      )}
                      {p.direccion && (
                        <span>📍 {p.direccion}</span>
                      )}
                      {!p.telefono && !p.direccion && (
                        <span style={{ fontStyle: 'italic' }}>Sin datos de contacto</span>
                      )}
                    </div>
                  </div>

                  {/* List summary badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {itemCount !== null ? (
                      <div style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 20,
                        background: `${COLOR}12`, border: `1px solid ${COLOR}30`,
                        color: COLOR, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        📋 {itemCount.toLocaleString('es-AR')} productos
                        {hasUpload && (
                          <span style={{ color: '#4ade80', marginLeft: 5 }}>✓ actualizada</span>
                        )}
                      </div>
                    ) : builtins === null ? (
                      <div style={{ fontSize: 12, color: C.muted }}>Cargando...</div>
                    ) : (
                      <div style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        color: C.muted, fontWeight: 500,
                      }}>
                        Sin lista
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {/* Upload */}
                    <button
                      onClick={() => handleUploadClick(p.id, p.nombre)}
                      disabled={isUploading}
                      title="Subir lista de precios"
                      style={{
                        padding: '6px 12px', borderRadius: 7,
                        border: `1px solid ${COLOR}50`,
                        background: isUploading ? 'transparent' : `${COLOR}12`,
                        color: isUploading ? C.muted : COLOR,
                        fontSize: 12, fontWeight: 600,
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { if (!isUploading) e.currentTarget.style.background = `${COLOR}22` }}
                      onMouseLeave={e => { if (!isUploading) e.currentTarget.style.background = `${COLOR}12` }}
                    >
                      {isUploading ? '⏳ Subiendo...' : hasAnyList ? '🔄 Actualizar lista' : '⬆️ Subir lista'}
                    </button>

                    {/* Toggle expand */}
                    {itemCount !== null && itemCount > 0 && (
                      <button
                        onClick={() => toggleExpand(p.id)}
                        title={isExpanded ? 'Cerrar lista' : 'Ver lista'}
                        style={{
                          padding: '6px 12px', borderRadius: 7,
                          border: isExpanded ? `1px solid ${COLOR}` : '1px solid var(--border)',
                          background: isExpanded ? `${COLOR}20` : 'transparent',
                          color: isExpanded ? COLOR : C.muted,
                          fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? '▲ Cerrar' : '▼ Ver lista'}
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar proveedor"
                      style={{
                        padding: '6px 8px', borderRadius: 7,
                        border: '1px solid var(--border)',
                        background: 'transparent', color: C.muted,
                        fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E5E5E3'; e.currentTarget.style.borderColor = '#555' }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >✏️</button>

                    {/* Delete */}
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      title="Eliminar proveedor"
                      style={{
                        padding: '6px 8px', borderRadius: 7,
                        border: '1px solid var(--border)',
                        background: 'transparent', color: C.muted,
                        fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >🗑️</button>
                  </div>
                </div>

                {/* ── Expanded list section ────────────────────────── */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${COLOR}30` }}>
                    {/* List header */}
                    <div style={{
                      padding: '10px 18px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: `${COLOR}06`,
                      borderBottom: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>
                        {source === 'upload'
                          ? `📁 ${uploadedListas[p.id]?.filename} · ${uploadedListas[p.id]?.items.toLocaleString('es-AR')} productos`
                          : `🔗 Lista de ${p.nombre} · ${expandedItems.length.toLocaleString('es-AR')} productos`}
                      </div>
                      <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <input
                          value={expandSearch}
                          onChange={e => setExpandSearch(e.target.value)}
                          placeholder={`Buscar en ${p.nombre}...`}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '6px 28px 6px 10px', borderRadius: 7,
                            border: '1px solid var(--border)',
                            background: 'var(--surface2)', color: '#E5E5E3',
                            fontSize: 12, outline: 'none',
                          }}
                        />
                        {expandSearch && (
                          <button
                            onClick={() => setExpandSearch('')}
                            style={{
                              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14,
                            }}
                          >×</button>
                        )}
                      </div>
                      {searchQ && (
                        <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>
                          {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Table */}
                    <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                      <ItemsTable items={expandedItems} search={expandSearch} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>))}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── URL / File upload modal ─────────────────────────────────── */}
      {urlModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setUrlModal(null) }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            width: 440, maxWidth: '92vw', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E3' }}>
                ⬆️ Subir lista — <span style={{ color: COLOR }}>{urlModal.nombre}</span>
              </div>
              <button onClick={() => setUrlModal(null)} style={{ background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Toggle */}
            <div style={{ padding: '18px 22px 0' }}>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content', marginBottom: 18 }}>
                {(['file', 'url'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setUrlMode(m); setUrlError('') }}
                    style={{
                      padding: '8px 18px', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      background: urlMode === m ? COLOR : 'var(--surface2)',
                      color: urlMode === m ? '#111' : '#8A8A8A',
                    }}
                  >
                    {m === 'file' ? '📂 Subir archivo' : '🔗 Enlace online'}
                  </button>
                ))}
              </div>

              {urlMode === 'file' ? (
                <div style={{ paddingBottom: 22 }}>
                  <button
                    onClick={handleUrlModalFile}
                    style={{
                      width: '100%', padding: '20px 16px', borderRadius: 10,
                      border: '2px dashed #333', background: 'var(--surface2)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 8, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#333' }}
                  >
                    <span style={{ fontSize: 28 }}>📂</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8A8A' }}>Seleccionar archivo</span>
                    <span style={{ fontSize: 11, color: '#484848' }}>CSV, Excel (.xlsx / .xls / .xlsm)</span>
                  </button>
                </div>
              ) : (
                <div style={{ paddingBottom: 4 }}>
                  <input
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlError('') }}
                    placeholder="https://docs.google.com/spreadsheets/d/... o link al CSV"
                    autoFocus
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${urlInput ? `${COLOR}60` : 'var(--border)'}`,
                      background: 'var(--surface2)', color: '#E5E5E3',
                      fontSize: 13, outline: 'none', fontFamily: 'monospace',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = COLOR }}
                    onBlur={e => { e.currentTarget.style.borderColor = urlInput ? `${COLOR}60` : 'var(--border)' }}
                    onKeyDown={e => e.key === 'Enter' && handleUrlModalSubmit()}
                  />
                  <div style={{ marginTop: 8, marginBottom: 18, fontSize: 11, color: '#484848', lineHeight: 1.6 }}>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>Google Sheets:</span> el archivo debe ser <span style={{ color: '#676767' }}>público</span> (Compartir → Cualquier persona con el enlace → Lector).
                  </div>
                  {urlError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{urlError}</div>}
                </div>
              )}
            </div>

            {/* Footer — only for URL mode */}
            {urlMode === 'url' && (
              <div style={{ padding: '0 22px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setUrlModal(null)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#8A8A8A', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >Cancelar</button>
                <button
                  onClick={handleUrlModalSubmit}
                  disabled={!urlInput.trim()}
                  style={{
                    padding: '8px 22px', borderRadius: 8, border: 'none',
                    background: urlInput.trim() ? COLOR : '#333',
                    color: urlInput.trim() ? '#111' : '#555',
                    fontSize: 13, fontWeight: 700,
                    cursor: urlInput.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                  }}
                >
                  ✓ Importar lista
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ────────────────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === 'new' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={COLOR}
          width={400}
        >
          <FormGrid cols={1}>
            <Field label="Nombre" required>
              <AutoCapInput
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre del proveedor"
                style={inputSt}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                placeholder="+54 9 11 1234-5678"
                style={inputSt}
              />
            </Field>
            <Field label="Dirección">
              <AutoCapInput
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
                style={inputSt}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* ── Confirm delete modal ─────────────────────────────────────── */}
      {confirmDeleteId && (() => {
        const prov = list.find(p => p.id === confirmDeleteId)
        return (
          <Modal
            title="Eliminar Proveedor"
            onClose={() => setConfirmDeleteId(null)}
            onSubmit={() => del(confirmDeleteId)}
            submitting={false}
            submitColor="#ef4444"
            submitLabel="Eliminar"
            width={360}
          >
            <div style={{ padding: '8px 0', fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
              ¿Confirmás que querés eliminar a{' '}
              <strong style={{ color: '#E5E5E3' }}>{prov?.nombre}</strong>?
              <br />
              Esta acción no se puede deshacer.
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
