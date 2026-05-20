'use client'
import { useState, useRef, useEffect } from 'react'
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
  const q = search.trim().toLowerCase()
  const filtered = q
    ? items.filter(it =>
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.category ?? '').toLowerCase().includes(q)
      )
    : items

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        {q ? `Sin resultados para "${search}"` : 'Lista vacía'}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)' }}>
              Producto
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', width: 100 }}>
              Código
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', width: 120 }}>
              Categoría
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', width: 140 }}>
              Precio
              <span style={{ color: '#4ade80', marginLeft: 4, fontWeight: 400 }}>USD</span>
              <span style={{ color: '#facc15', marginLeft: 4, fontWeight: 400 }}>/ ARS</span>
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'center', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', width: 90 }}>
              Stock
            </th>
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
              <td style={{ padding: '7px 12px' }}>
                {it.category ? (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4,
                    background: `${COLOR}18`, color: COLOR, fontWeight: 600,
                  }}>
                    <Highlight text={it.category} q={search} />
                  </span>
                ) : <span style={{ color: C.muted }}>—</span>}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13 }}>
                  {fmtUSD(it.price)}
                </div>
                {it.priceARS != null && it.priceARS > 0 && (
                  <div style={{ color: '#facc15', fontWeight: 600, fontSize: 11, marginTop: 1 }}>
                    {fmtARS(it.priceARS)}
                  </div>
                )}
              </td>
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

  const handleUploadClick = (id: string) => {
    setUploadTargetId(id)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
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
      if (res.ok) {
        const result = await res.json()
        // Warn when parser found 0 items — show the raw file structure
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
        // Reload full lista with items
        const metaRes = await fetch(`/api/sistema/proveedores/${id}/lista`, { cache: 'no-store' })
        if (metaRes.ok) {
          const data = await metaRes.json()
          if (data) setUploaded(prev => ({ ...prev, [id]: data as ListaConItems }))
        }
        // Auto-expand to show the new list
        setExpandedId(id)
        setExpandSearch('')
      } else {
        const err = await res.json()
        alert(`Error al subir: ${err.error ?? 'Error desconocido'}`)
      }
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
          <a
            href="/plantilla-lista-precios.csv"
            download="plantilla-lista-precios.csv"
            title="Descargá la plantilla CSV para armar listas de precios compatibles"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #333', background: 'transparent',
              color: '#676767', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#E5E5E3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#676767' }}
          >
            📥 Plantilla CSV
          </a>
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
            const searchQ = expandSearch.trim().toLowerCase()
            const filteredItems = searchQ
              ? expandedItems.filter(it =>
                  it.name.toLowerCase().includes(searchQ) ||
                  it.code.toLowerCase().includes(searchQ) ||
                  (it.category ?? '').toLowerCase().includes(searchQ)
                )
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
                      onClick={() => handleUploadClick(p.id)}
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
