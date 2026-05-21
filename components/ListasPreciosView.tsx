'use client'

import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { matchesAny } from '@/lib/search'
import GremioView from './GremioView'
import CFView from './CFView'
import type { GremioData, CFItem } from '@/lib/gremio-parser'
import type { SupplierItem } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ListaCustom {
  id: string
  nombre: string
  filename: string
  items: number
  color: string
  createdAt: string
  updatedAt: string
}

interface ListaCustomConItems extends ListaCustom {
  itemsData: SupplierItem[]
}

type TabId = 'gremio' | 'cf' | string

// ── Helpers ───────────────────────────────────────────────────────────────────
function downloadBlob(content: string, filename: string) {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map(r =>
    r.map(cell => {
      const s = cell == null ? '' : String(cell)
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  ).join('\r\n')
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
}

// ── Custom list table ─────────────────────────────────────────────────────────
function CustomTable({ items, search, color }: { items: SupplierItem[]; search: string; color: string }) {
  const filtered = search.trim()
    ? items.filter(it => matchesAny([it.name, it.code, it.category, it.quality, it.brand, it.description], search))
    : items

  if (!filtered.length) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#676767', fontSize: 14 }}>
        {search.trim() ? `Sin resultados para "${search}"` : 'Lista vacía'}
      </div>
    )
  }

  const th: React.CSSProperties = {
    padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#676767',
    letterSpacing: 0.4, textTransform: 'uppercase',
    border: '1px solid rgba(255,255,255,0.06)',
  }

  // Detect if list has any of the new extended fields
  const hasQuality = filtered.some(it => it.quality)
  const hasBrand   = filtered.some(it => it.brand)
  const hasARS     = filtered.some(it => it.priceARS != null && it.priceARS > 0)
  const hasDesc    = filtered.some(it => it.description)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(15,17,28,0.6)' }}>
            <th style={{ ...th, textAlign: 'left' }}>Nombre</th>
            <th style={{ ...th, textAlign: 'left', width: 90 }}>Código</th>
            {hasQuality && <th style={{ ...th, textAlign: 'left', width: 160 }}>Calidad</th>}
            {hasBrand   && <th style={{ ...th, textAlign: 'left', width: 120 }}>Marca</th>}
            <th style={{ ...th, textAlign: 'left', width: 110 }}>Categoría</th>
            <th style={{ ...th, textAlign: 'right', width: 100 }}>
              USD <span style={{ color: '#4ade80' }}>$</span>
            </th>
            {hasARS && (
              <th style={{ ...th, textAlign: 'right', width: 110 }}>
                ARS <span style={{ color: '#facc15' }}>$</span>
              </th>
            )}
            {hasDesc && <th style={{ ...th, textAlign: 'left', width: 200 }}>Descripción</th>}
            <th style={{ ...th, textAlign: 'center', width: 90 }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <td style={{ padding: '8px 12px', color: '#E5E5E3', fontWeight: 500, fontSize: 13 }}>
                {it.name}
              </td>
              <td style={{ padding: '8px 12px', color: '#676767', fontFamily: 'monospace', fontSize: 12 }}>
                {it.code || '—'}
              </td>
              {hasQuality && (
                <td style={{ padding: '8px 12px', fontSize: 12 }}>
                  {it.quality
                    ? <span style={{ padding: '2px 7px', borderRadius: 4, background: `${color}12`, color, fontSize: 11, fontWeight: 600 }}>{it.quality}</span>
                    : <span style={{ color: '#484848' }}>—</span>}
                </td>
              )}
              {hasBrand && (
                <td style={{ padding: '8px 12px', color: '#8A8A8A', fontSize: 12 }}>
                  {it.brand || '—'}
                </td>
              )}
              <td style={{ padding: '8px 12px' }}>
                {it.category
                  ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#8A8A8A', fontWeight: 600 }}>{it.category}</span>
                  : <span style={{ color: '#484848' }}>—</span>}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                {it.price > 0
                  ? `$${it.price.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
                  : <span style={{ color: '#484848' }}>—</span>}
              </td>
              {hasARS && (
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#facc15', fontWeight: 600, fontSize: 12 }}>
                  {it.priceARS != null && it.priceARS > 0
                    ? `$${it.priceARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                    : <span style={{ color: '#484848' }}>—</span>}
                </td>
              )}
              {hasDesc && (
                <td style={{ padding: '8px 12px', color: '#676767', fontSize: 12, maxWidth: 200 }}>
                  {it.description || '—'}
                </td>
              )}
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {it.stock
                  ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: /stock/i.test(it.stock) ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)', color: /stock/i.test(it.stock) ? '#4ade80' : '#facc15', fontWeight: 600 }}>{it.stock}</span>
                  : <span style={{ color: '#484848', fontSize: 12 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function ListasPreciosView() {
  const [activeTab,   setActiveTab]   = useState<TabId>('gremio')
  const [gremioKey,   setGremioKey]   = useState(0)
  const [cfKey,       setCfKey]       = useState(0)
  const [importing,   setImporting]   = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [importMsg,   setImportMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Custom lists
  const [customListas,  setCustomListas]  = useState<ListaCustom[]>([])
  const [customItems,   setCustomItems]   = useState<Record<string, SupplierItem[]>>({})
  const [customLoading, setCustomLoading] = useState<Record<string, boolean>>({})
  const [customSearch,  setCustomSearch]  = useState('')

  // New list modal
  const [showNewModal,  setShowNewModal]  = useState(false)
  const [newNombre,     setNewNombre]     = useState('')
  const [newFile,       setNewFile]       = useState<File | null>(null)
  const [newUrl,        setNewUrl]        = useState('')
  const [newInputMode,  setNewInputMode]  = useState<'file' | 'url'>('file')
  const [creating,      setCreating]      = useState(false)
  const [newFileError,  setNewFileError]  = useState('')

  // Update list modal
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null)

  // File inputs
  const importFileRef = useRef<HTMLInputElement>(null)
  const newFileRef    = useRef<HTMLInputElement>(null)
  const updateFileRef = useRef<HTMLInputElement>(null)

  // ── Load custom lists on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/sistema/listas-custom', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ListaCustom[]) => setCustomListas(data ?? []))
      .catch(() => {})
  }, [])

  // Load items for custom tab when switching to it
  useEffect(() => {
    if (activeTab === 'gremio' || activeTab === 'cf') return
    if (customItems[activeTab]) return  // already loaded
    setCustomLoading(prev => ({ ...prev, [activeTab]: true }))
    fetch(`/api/sistema/listas-custom/${activeTab}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ListaCustomConItems) => {
        setCustomItems(prev => ({ ...prev, [activeTab]: data.itemsData ?? [] }))
      })
      .catch(() => setCustomItems(prev => ({ ...prev, [activeTab]: [] })))
      .finally(() => setCustomLoading(prev => ({ ...prev, [activeTab]: false })))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentCustom = activeTab !== 'gremio' && activeTab !== 'cf'
    ? customListas.find(l => l.id === activeTab)
    : null
  const currentColor = activeTab === 'gremio' ? '#f472b6'
    : activeTab === 'cf' ? '#facc15'
    : currentCustom?.color ?? '#60a5fa'

  // ── Fixed tab import (Gremio / CF) ────────────────────────────────────────
  const handleImportFixed = () => {
    setImportMsg(null)
    if (importFileRef.current) { importFileRef.current.value = ''; importFileRef.current.click() }
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/sistema/listas/${activeTab}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setImportMsg({ ok: true, text: `✅ ${data.items} ítems importados desde ${file.name}` })
        if (activeTab === 'gremio') setGremioKey(k => k + 1)
        else                        setCfKey(k => k + 1)
      } else {
        setImportMsg({ ok: false, text: `❌ ${data.error ?? 'Error al importar'}` })
      }
    } catch (err) {
      setImportMsg({ ok: false, text: `❌ Error de red: ${String(err)}` })
    } finally { setImporting(false) }
  }

  // ── Custom tab re-upload ──────────────────────────────────────────────────
  const handleUpdateCustom = (id: string) => {
    setUpdateTargetId(id)
    if (updateFileRef.current) { updateFileRef.current.value = ''; updateFileRef.current.click() }
  }

  const handleUpdateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !updateTargetId) return
    const id = updateTargetId; setUpdateTargetId(null)
    setImporting(true); setImportMsg(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/sistema/listas-custom/${id}`, { method: 'PUT', body: fd })
      const data = await res.json()
      if (res.ok) {
        setCustomListas(prev => prev.map(l => l.id === id ? { ...l, ...data } : l))
        setCustomItems(prev => { const n = { ...prev }; delete n[id]; return n })
        // Force reload items
        setTimeout(() => {
          fetch(`/api/sistema/listas-custom/${id}`, { cache: 'no-store' })
            .then(r => r.json())
            .then((d: ListaCustomConItems) => setCustomItems(prev => ({ ...prev, [id]: d.itemsData ?? [] })))
            .catch(() => {})
        }, 100)
        setImportMsg({ ok: true, text: `✅ Lista actualizada: ${data.items} ítems (${file.name})` })
      } else {
        setImportMsg({ ok: false, text: `❌ ${data.error ?? 'Error al actualizar'}` })
      }
    } catch (err) {
      setImportMsg({ ok: false, text: `❌ Error de red: ${String(err)}` })
    } finally { setImporting(false) }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    try {
      if (activeTab === 'cf') {
        const res = await fetch('/api/gremio/cf')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items: CFItem[] = await res.json()
        const header = ['Categoría', 'Reparación', 'USD Repuesto', 'Efectivo/Transf.', '3 Cuotas', '6 Cuotas']
        const rows = items.map(it => [it.category, it.name, it.usdRepuesto ?? '', it.precioEfectivo ?? '', it.precio3cuotas ?? '', it.precio6cuotas ?? ''])
        downloadBlob(toCsv([header, ...rows]), 'lista-consumidor-final.csv')
      } else if (activeTab === 'gremio') {
        const res = await fetch('/api/gremio')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: GremioData = await res.json()
        const allSections = [...data.left, ...data.right]
        const header = ['Sección', 'Reparación', 'Transferencia (ARS)', 'Efectivo (ARS)']
        const rows = allSections.flatMap(s => s.items.map(it => [s.title, it.name, it.transferencia ?? '', it.efectivo ?? '']))
        downloadBlob(toCsv([header, ...rows]), 'lista-gremio.csv')
      } else {
        // Custom list export
        const items = customItems[activeTab] ?? []
        const nombre = currentCustom?.nombre ?? activeTab
        const header = ['Producto', 'Código', 'Categoría', 'Precio (ARS)', 'Stock']
        const rows = items.map(it => [it.name, it.code, it.category ?? '', it.price, it.stock ?? ''])
        downloadBlob(toCsv([header, ...rows]), `lista-${slugify(nombre)}.csv`)
      }
    } catch (err) {
      alert(`Error al exportar: ${String(err)}`)
    } finally { setExporting(false) }
  }

  // ── Delete custom list ────────────────────────────────────────────────────
  const handleDeleteCustom = async (id: string) => {
    if (!confirm('¿Eliminar esta lista? Esta acción no se puede deshacer.')) return
    await fetch(`/api/sistema/listas-custom/${id}`, { method: 'DELETE' })
    setCustomListas(prev => prev.filter(l => l.id !== id))
    setCustomItems(prev => { const n = { ...prev }; delete n[id]; return n })
    if (activeTab === id) setActiveTab('gremio')
  }

  // ── Create new custom list ────────────────────────────────────────────────
  const openNewModal = () => {
    setNewNombre(''); setNewFile(null); setNewUrl(''); setNewInputMode('file')
    setNewFileError(''); setShowNewModal(true)
  }

  const handleNewFilePick = () => {
    if (newFileRef.current) { newFileRef.current.value = ''; newFileRef.current.click() }
  }

  const handleNewFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setNewFile(f); setNewFileError('')
  }

  const handleCreate = async () => {
    if (!newNombre.trim()) return
    if (newInputMode === 'file' && !newFile) { setNewFileError('Seleccioná un archivo'); return }
    if (newInputMode === 'url'  && !newUrl.trim()) { setNewFileError('Ingresá un enlace'); return }
    setCreating(true); setNewFileError('')
    try {
      let res: Response
      if (newInputMode === 'url') {
        res = await fetch('/api/sistema/listas-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: newNombre.trim(), url: newUrl.trim() }),
        })
      } else {
        const fd = new FormData()
        fd.append('nombre', newNombre.trim())
        fd.append('file', newFile!)
        res = await fetch('/api/sistema/listas-custom', { method: 'POST', body: fd })
      }
      const data = await res.json()
      if (res.ok) {
        setCustomListas(prev => [...prev, data as ListaCustom])
        setShowNewModal(false)
        setActiveTab(data.id)
        setImportMsg({ ok: true, text: `✅ Lista "${data.nombre}" creada con ${data.items} ítems` })
      } else {
        setNewFileError(data.error ?? 'Error al crear la lista')
      }
    } catch (err) {
      setNewFileError(`Error de red: ${String(err)}`)
    } finally { setCreating(false) }
  }

  // ── Download supplier template ────────────────────────────────────────────
  const downloadTemplate = () => {
    const header = ['Nombre', 'Código', 'Calidad', 'Marca', 'Categoría', 'Precio USD', 'Precio ARS', 'Descripción']
    const examples = [
      ['LCD & TP iPhone 15 Pro Max', '5493', 'Soft OLED X07', 'Mobilesentrix', 'módulos', 210, '', 'Apto IC - 120Hz'],
      ['Batería iPhone 14 Ampsentrix Plus', '5487', 'Ampsentrix Plus', 'Ampsentrix', 'baterías', 23, '', 'Autoprogramable'],
      ['Vidrio Trasero iPhone 14 Pro Max Negro', '4320', 'Premium', '', 'vidrios', 8, 9200, ''],
      ['Cámara Trasera iPhone 13 Pro', '3614', 'Original Pull', 'Apple', 'cámaras', 45, '', ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet([header, ...examples])
    ws['!cols'] = [
      { wch: 42 }, { wch: 12 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 28 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios')
    XLSX.writeFile(wb, 'plantilla-lista-proveedor.xlsx')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isCustomTab = activeTab !== 'gremio' && activeTab !== 'cf'
  const currentItems = isCustomTab ? (customItems[activeTab] ?? []) : []
  const isLoadingCustom = isCustomTab && !!customLoading[activeTab]

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 10, flexWrap: 'wrap',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Fixed tabs */}
          {[
            { id: 'gremio', label: '🔧 Gremio',           color: '#f472b6' },
            { id: 'cf',     label: '💰 Consumidor Final',  color: '#facc15' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setImportMsg(null); setCustomSearch('') }}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: 'none', marginBottom: -1,
                borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
                color: activeTab === tab.id ? tab.color : '#8A8A8A',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >{tab.label}</button>
          ))}

          {/* Custom list tabs */}
          {customListas.map(lista => (
            <div key={lista.id} style={{ display: 'flex', alignItems: 'center', marginBottom: -1 }}>
              <button
                onClick={() => { setActiveTab(lista.id); setImportMsg(null); setCustomSearch('') }}
                style={{
                  padding: '8px 16px 8px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: activeTab === lista.id ? 700 : 500,
                  background: 'none',
                  borderBottom: activeTab === lista.id ? `2px solid ${lista.color}` : '2px solid transparent',
                  color: activeTab === lista.id ? lista.color : '#8A8A8A',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                📋 {lista.nombre}
                <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.65, fontWeight: 400 }}>
                  ({lista.items.toLocaleString('es-AR')})
                </span>
              </button>
              {/* Delete custom tab */}
              <button
                onClick={() => handleDeleteCustom(lista.id)}
                title="Eliminar lista"
                style={{
                  marginBottom: activeTab === lista.id ? 2 : 0,
                  width: 18, height: 18, borderRadius: '50%',
                  border: '1px solid transparent', background: 'transparent',
                  color: '#484848', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#f8717140' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484848'; e.currentTarget.style.borderColor = 'transparent' }}
              >✕</button>
            </div>
          ))}

          {/* + Nueva lista button */}
          <button
            onClick={openNewModal}
            style={{
              padding: '7px 14px 9px', border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: 600, background: 'none', color: '#60a5fa',
              marginBottom: -1, borderBottom: '2px solid transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#93c5fd'; e.currentTarget.style.borderBottomColor = '#60a5fa40' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderBottomColor = 'transparent' }}
          >
            ＋ Nueva lista
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 10, flexShrink: 0 }}>
          {/* Export */}
          <button
            onClick={handleExport} disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8,
              border: `1px solid ${currentColor}50`, background: 'transparent',
              color: currentColor, fontSize: 13, fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = `${currentColor}15` }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {exporting ? '⏳' : '⬇️'} Exportar
          </button>

          {/* Import (fixed tabs) or re-upload (custom tabs) */}
          <button
            onClick={isCustomTab ? () => handleUpdateCustom(activeTab) : handleImportFixed}
            disabled={importing}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: importing ? '#333' : currentColor,
              color: '#111', fontSize: 13, fontWeight: 700,
              cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1, transition: 'all 0.15s',
            }}
          >
            {importing ? '⏳ Importando...' : '⬆️ Importar'}
          </button>
        </div>
      </div>

      {/* Import message */}
      {importMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: importMsg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${importMsg.ok ? '#4ade8040' : '#ef444440'}`,
          color: importMsg.ok ? '#4ade80' : '#fca5a5',
        }}>
          {importMsg.text}
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {activeTab === 'gremio' && <GremioView key={gremioKey} />}
      {activeTab === 'cf'     && <CFView     key={cfKey} />}

      {isCustomTab && (
        <div>
          {isLoadingCustom ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#676767', fontSize: 14 }}>
              Cargando lista...
            </div>
          ) : (
            <>
              {/* Custom list header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: currentColor, margin: 0 }}>
                    {currentCustom?.nombre ?? activeTab}
                  </h2>
                  <p style={{ fontSize: 12, color: '#676767', margin: '4px 0 0' }}>
                    {currentCustom?.filename} · {currentItems.length.toLocaleString('es-AR')} productos
                    {currentCustom && ` · Actualizado ${new Date(currentCustom.updatedAt).toLocaleDateString('es-AR')}`}
                  </p>
                </div>

                {/* Search for custom list */}
                <div style={{ position: 'relative', flex: 1, maxWidth: 360, minWidth: 200 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 24 24"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#676767', pointerEvents: 'none' }}>
                    <path d="M21.707 20.293l-5.387-5.387A8 8 0 1 0 15 16.31l5.387 5.397a1 1 0 0 0 1.414-1.414zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
                  </svg>
                  <input
                    value={customSearch}
                    onChange={e => setCustomSearch(e.target.value)}
                    placeholder={`Buscar en ${currentCustom?.nombre ?? 'lista'}...`}
                    style={{
                      width: '100%', padding: '8px 30px 8px 32px', boxSizing: 'border-box',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 8, color: '#E5E5E3', fontSize: 13, outline: 'none',
                    }}
                  />
                  {customSearch && (
                    <button onClick={() => setCustomSearch('')} style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 16,
                    }}>×</button>
                  )}
                </div>

                {customSearch && (
                  <div style={{ fontSize: 12, color: '#676767' }}>
                    {currentItems.filter(it =>
                      it.name.toLowerCase().includes(customSearch.toLowerCase()) ||
                      it.code.toLowerCase().includes(customSearch.toLowerCase()) ||
                      (it.category ?? '').toLowerCase().includes(customSearch.toLowerCase())
                    ).length.toLocaleString('es-AR')} resultados
                  </div>
                )}
              </div>

              <CustomTable items={currentItems} search={customSearch} color={currentColor} />
            </>
          )}
        </div>
      )}

      {/* ── Hidden file inputs ─────────────────────────────────────────────── */}
      <input ref={importFileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFileChange} />
      <input ref={updateFileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleUpdateFileChange} />
      <input ref={newFileRef}    type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleNewFileSelected} />

      {/* ── Nueva lista modal ──────────────────────────────────────────────── */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false) }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            width: 420, maxWidth: '90vw', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E5E5E3' }}>📋 Nueva lista de precios</div>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', color: '#676767', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '22px 22px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8A8A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Nombre del proveedor / lista <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={newNombre}
                  onChange={e => setNewNombre(e.target.value)}
                  placeholder="Ej: Mayorista Norte, Distribuidora XYZ..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && newInputMode === 'file' && !newFile && handleNewFilePick()}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                    color: '#E5E5E3', fontSize: 14, outline: 'none',
                  }}
                />
              </div>

              {/* Source toggle */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8A8A8A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Origen de precios <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                  {(['file', 'url'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setNewInputMode(mode); setNewFileError('') }}
                      style={{
                        padding: '8px 18px', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                        background: newInputMode === mode ? '#60a5fa' : 'var(--surface2)',
                        color: newInputMode === mode ? '#111' : '#8A8A8A',
                      }}
                    >
                      {mode === 'file' ? '📂 Subir archivo' : '🔗 Enlace online'}
                    </button>
                  ))}
                </div>
              </div>

              {/* File picker */}
              {newInputMode === 'file' && (
                <div>
                  <button
                    onClick={handleNewFilePick}
                    style={{
                      width: '100%', padding: '22px 16px',
                      borderRadius: 10, border: `2px dashed ${newFile ? '#4ade80' : '#333'}`,
                      background: newFile ? 'rgba(74,222,128,0.06)' : 'var(--surface2)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { if (!newFile) e.currentTarget.style.borderColor = '#60a5fa' }}
                    onMouseLeave={e => { if (!newFile) e.currentTarget.style.borderColor = '#333' }}
                  >
                    {newFile ? (
                      <>
                        <span style={{ fontSize: 24 }}>✅</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{newFile.name}</span>
                        <span style={{ fontSize: 11, color: '#676767' }}>Clic para cambiar</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 28 }}>📂</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8A8A' }}>Seleccionar archivo</span>
                        <span style={{ fontSize: 11, color: '#484848' }}>CSV, Excel (.xlsx / .xls)</span>
                      </>
                    )}
                  </button>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#484848', lineHeight: 1.5 }}>
                    Usá la plantilla para el formato correcto:{' '}
                    <span style={{ color: '#676767' }}>Nombre, Código, Calidad, Marca, Categoría, Precio USD, Precio ARS, Descripción</span>
                  </div>
                </div>
              )}

              {/* URL input */}
              {newInputMode === 'url' && (
                <div>
                  <input
                    value={newUrl}
                    onChange={e => { setNewUrl(e.target.value); setNewFileError('') }}
                    placeholder="https://docs.google.com/spreadsheets/d/... o link al CSV"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${newUrl ? '#60a5fa60' : 'var(--border)'}`,
                      background: 'var(--surface2)', color: '#E5E5E3',
                      fontSize: 13, outline: 'none', fontFamily: 'monospace',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#60a5fa' }}
                    onBlur={e => { e.currentTarget.style.borderColor = newUrl ? '#60a5fa60' : 'var(--border)' }}
                  />
                  <div style={{ marginTop: 8, fontSize: 11, color: '#484848', lineHeight: 1.6 }}>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>Google Sheets:</span> el archivo debe ser <span style={{ color: '#676767' }}>público</span> (Compartir → Cualquier persona con el enlace → Lector).<br />
                    También acepta links directos a archivos CSV o Excel en la nube.
                  </div>
                </div>
              )}

              {newFileError && (
                <div style={{ fontSize: 12, color: '#f87171', marginTop: -8 }}>{newFileError}</div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 22px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Download template — left side */}
              <button
                onClick={downloadTemplate}
                title="Descargar plantilla Excel con el formato correcto"
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid rgba(96,165,250,0.35)', background: 'transparent',
                  color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  marginRight: 'auto',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                📄 Descargar plantilla
              </button>

              <button
                onClick={() => setShowNewModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#8A8A8A', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={creating || !newNombre.trim() || (newInputMode === 'file' ? !newFile : !newUrl.trim())}
                style={{
                  padding: '8px 22px', borderRadius: 8, border: 'none',
                  background: creating || !newNombre.trim() || (newInputMode === 'file' ? !newFile : !newUrl.trim()) ? '#333' : '#60a5fa',
                  color:      creating || !newNombre.trim() || (newInputMode === 'file' ? !newFile : !newUrl.trim()) ? '#555' : '#111',
                  fontSize: 13, fontWeight: 700,
                  cursor: creating || !newNombre.trim() || (newInputMode === 'file' ? !newFile : !newUrl.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {creating ? '⏳ Importando...' : '✓ Crear lista'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
