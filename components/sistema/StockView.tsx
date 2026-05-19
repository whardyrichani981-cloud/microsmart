'use client'
import { useState, useMemo } from 'react'
import type { StockItem, TipoStock, CategoriaStock, Moneda, Proveedor } from '@/lib/sistema-types'
import {
  useApi, fmtARS,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'

const CATEGORIAS: CategoriaStock[] = ['Accesorios', 'Altavoz', 'Batería', 'Cámara', 'Chasis', 'Flex', 'Otro', 'Pantalla/Módulo', 'Parlante', 'Vidrio trasero']
const MONEDAS: Moneda[] = ['ARS $', 'USD $']


interface StockViewProps { tipo: TipoStock }

const TIPO_CONFIG: Record<TipoStock, { title: string; icon: string; color: string; desc: string }> = {
  repuestos:  { title: 'Stock de Repuestos',  icon: '🔧', color: '#a78bfa', desc: 'Inventario de repuestos Apple' },
  accesorios: { title: 'Stock de Accesorios', icon: '🎧', color: '#fb923c', desc: 'Inventario de accesorios' },
}

type FormState = Omit<StockItem, 'id' | 'updatedAt' | 'tipo'>

function buildEmpty(): FormState {
  return { repuesto: '', categoria: 'Otro', modelo: '', proveedor: '', stock: 0, costoUnitario: 0, moneda: 'ARS $', costoTotalARS: 0, notas: '' }
}

function recalc(f: FormState, dolar: number): FormState {
  const costoTotalARS = Math.round(f.stock * f.costoUnitario * (f.moneda === 'USD $' ? dolar : 1))
  return { ...f, costoTotalARS }
}

// Clave de agrupación: mismo repuesto + modelo = mismo producto
function groupKey(item: StockItem) {
  return `${item.repuesto.trim().toLowerCase()}|||${item.modelo.trim().toLowerCase()}`
}

interface StockGroup {
  key: string
  repuesto: string
  categoria: CategoriaStock
  modelo: string
  totalStock: number
  items: StockItem[]
}

export default function StockView({ tipo }: StockViewProps) {
  const config = TIPO_CONFIG[tipo]
  const { data: stockData, loading, refresh } = useApi<{ items: StockItem[]; dolar: number }>(`/api/sistema/stock?tipo=${tipo}`, [tipo])
  const { data: proveedoresData } = useApi<Proveedor[]>('/api/sistema/proveedores')
  const [modal, setModal]     = useState<false | 'new' | 'edit'>(false)
  const [form, setForm]       = useState<FormState>(buildEmpty())
  const [editId, setEditId]   = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Nombres de proveedores del sistema para el selector
  const proveedoresOpciones = useMemo(() =>
    (proveedoresData ?? []).map(p => p.nombre).sort((a, b) => a.localeCompare(b, 'es'))
  , [proveedoresData])

  const dolar = stockData?.dolar ?? 1200
  const list  = stockData?.items ?? []

  const set = (k: string, v: unknown) => setForm(prev => recalc({ ...prev, [k]: v }, dolar))

  const openNew = () => {
    setForm(recalc(buildEmpty(), dolar))
    setEditId(null)
    setModal('new')
  }

  // Agregar un proveedor nuevo a un producto ya existente (pre-rellena nombre/cat/modelo)
  const openAddProveedor = (g: StockGroup) => {
    setForm(recalc({ ...buildEmpty(), repuesto: g.repuesto, categoria: g.categoria, modelo: g.modelo }, dolar))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (item: StockItem) => {
    const { id, updatedAt, tipo: _t, ...rest } = item
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, tipo }
      if (modal === 'new') {
        await fetch('/api/sistema/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        await fetch('/api/sistema/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (item: StockItem) => {
    if (!confirm(`¿Eliminar entrada de ${item.proveedor || 'este proveedor'}?`)) return
    await fetch('/api/sistema/stock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
    await refresh()
  }

  const toggleExpand = (key: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Agrupar por repuesto+modelo
  const groups = useMemo<StockGroup[]>(() => {
    const map = new Map<string, StockGroup>()
    for (const item of list) {
      const k = groupKey(item)
      if (!map.has(k)) map.set(k, { key: k, repuesto: item.repuesto, categoria: item.categoria, modelo: item.modelo, totalStock: 0, items: [] })
      const g = map.get(k)!
      g.totalStock += item.stock
      g.items.push(item)
    }
    return [...map.values()].sort((a, b) => a.repuesto.localeCompare(b.repuesto, 'es'))
  }, [list])

  // En el detalle expandido, ocultar proveedores agotados solo si hay al menos uno con stock
  const visibleItems = (g: StockGroup) => {
    const conStock = g.items.filter(i => i.stock > 0)
    return conStock.length > 0 ? conStock : g.items   // si todos en 0, mostrarlos igual
  }

  // Filtro de búsqueda
  const q = search.toLowerCase()
  const filtered = q
    ? groups.filter(g =>
        g.repuesto.toLowerCase().includes(q) ||
        g.modelo.toLowerCase().includes(q) ||
        g.categoria.toLowerCase().includes(q) ||
        g.items.some(i => i.proveedor.toLowerCase().includes(q))
      )
    : groups

  // KPIs (sobre items individuales)
  const totalProductos  = groups.length
  const valorTotal      = list.reduce((s, i) => s + i.costoTotalARS, 0)
  const lowStock        = groups.filter(g => g.totalStock < 2).length
  const sinStock        = groups.filter(g => g.totalStock === 0).length

  const COLOR = config.color

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader icon={config.icon} title={config.title} desc={config.desc} color={COLOR} count={totalProductos} onNew={openNew} newLabel="Agregar item" />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Productos distintos" value={String(totalProductos)} color={COLOR}        icon="📦" />
        <KPICard label="Valor Total Stock"    value={fmtARS(valorTotal)}    color={COLOR}        icon="💰" />
        <KPICard label="Stock Bajo (< 2)"     value={String(lowStock)}      color={lowStock  > 0 ? '#fb923c' : C.muted} icon="⚠️" />
        <KPICard label="Sin Stock"            value={String(sinStock)}      color={sinStock  > 0 ? C.red    : C.muted} icon="🚫" />
      </div>

      {lowStock > 0 && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 12, color: '#fb923c' }}>
          ⚠️ {lowStock} producto{lowStock > 1 ? 's' : ''} con stock bajo (menos de 2 unidades en total)
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Buscar repuesto, modelo, proveedor..."
          style={{ ...inputSt, width: '100%', fontSize: 13 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.muted, fontSize: 13 }}>
          {search ? `Sin resultados para "${search}"` : 'No hay items en el stock'}
        </div>
      ) : (
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Encabezado */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 130px 140px 80px 110px 110px 80px',
            padding: '9px 14px', background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Repuesto</span>
            <span>Categoría</span>
            <span>Modelo</span>
            <span style={{ textAlign: 'right' }}>Stock</span>
            <span style={{ textAlign: 'right' }}>Precio min.</span>
            <span style={{ textAlign: 'right' }}>Precio max.</span>
            <span />
          </div>

          {filtered.map((g, gi) => {
            const isOpen = expanded.has(g.key)
            // Precios en ARS para comparar
            const preciosARS = g.items.map(i =>
              i.moneda === 'USD $' ? i.costoUnitario * dolar : i.costoUnitario
            )
            const minPrecio = Math.min(...preciosARS)
            const maxPrecio = Math.max(...preciosARS)
            const multiProveedor = g.items.length > 1
            const isLast = gi === filtered.length - 1

            return (
              <div key={g.key}>
                {/* ── Fila producto agrupado ── */}
                <div
                  onClick={() => toggleExpand(g.key)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 130px 140px 80px 110px 110px 80px',
                    padding: '11px 14px', cursor: 'pointer',
                    background: isOpen ? `${COLOR}09` : 'var(--surface)',
                    borderBottom: isLast && !isOpen ? 'none' : '1px solid var(--border)',
                    transition: 'background 0.12s',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isOpen ? `${COLOR}09` : 'var(--surface)' }}
                >
                  {/* Nombre */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 14, transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: COLOR, flexShrink: 0 }}>▶</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.repuesto}</span>
                    {multiProveedor && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: `${COLOR}22`, color: COLOR, fontWeight: 700, flexShrink: 0 }}>
                        {g.items.length} proveedores
                      </span>
                    )}
                  </div>

                  {/* Categoría */}
                  <div><Badge label={g.categoria} color={COLOR} /></div>

                  {/* Modelo */}
                  <span style={{ fontSize: 12, color: C.muted }}>{g.modelo || '—'}</span>

                  {/* Stock total */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 800, fontSize: 14,
                      color: g.totalStock === 0 ? C.red : g.totalStock < 2 ? '#fb923c' : 'var(--text-primary)',
                      background: g.totalStock === 0 ? 'rgba(248,113,113,0.1)' : g.totalStock < 2 ? 'rgba(251,146,60,0.1)' : 'transparent',
                      padding: '2px 7px', borderRadius: 5,
                    }}>
                      {g.totalStock}
                    </span>
                  </div>

                  {/* Precio min */}
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
                    {fmtARS(minPrecio)}
                  </div>

                  {/* Precio max */}
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: minPrecio === maxPrecio ? C.muted : '#fb923c', fontWeight: 600 }}>
                    {minPrecio === maxPrecio ? '—' : fmtARS(maxPrecio)}
                  </div>

                  {/* Acción agregar proveedor */}
                  <div style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openAddProveedor(g)}
                      title="Agregar otro proveedor a este producto"
                      style={{
                        padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLOR}44`,
                        background: `${COLOR}11`, color: COLOR, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${COLOR}22` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${COLOR}11` }}
                    >+ Prov.</button>
                  </div>
                </div>

                {/* ── Detalle por proveedor (expandido) ── */}
                {isOpen && (
                  <div style={{ background: 'var(--surface2)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                    {/* Sub-encabezado */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 80px 100px 100px 110px 80px',
                      padding: '7px 14px 7px 28px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      <span />
                      <span>Proveedor</span>
                      <span style={{ textAlign: 'right' }}>Stock</span>
                      <span style={{ textAlign: 'right' }}>Costo unit.</span>
                      <span style={{ textAlign: 'right' }}>Moneda</span>
                      <span style={{ textAlign: 'right' }}>Costo total ARS</span>
                      <span />
                    </div>

                    {visibleItems(g).map((item, ii) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '28px 1fr 80px 100px 100px 110px 80px',
                          padding: '9px 14px 9px 28px', alignItems: 'center',
                          borderBottom: ii < visibleItems(g).length - 1 ? '1px solid var(--border-light, var(--border))' : 'none',
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>🏭</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {item.proveedor || <span style={{ color: C.muted, fontStyle: 'italic' }}>Sin proveedor</span>}
                          {item.notas && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{item.notas}</span>}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700,
                            color: item.stock === 0 ? C.red : item.stock < 2 ? '#fb923c' : 'var(--text-primary)',
                          }}>{item.stock}</span>
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                          {item.moneda === 'USD $' ? `USD ${item.costoUnitario}` : fmtARS(item.costoUnitario)}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700,
                            background: item.moneda === 'USD $' ? 'rgba(96,165,250,0.12)' : 'rgba(74,222,128,0.1)',
                            color: item.moneda === 'USD $' ? '#60a5fa' : '#4ade80',
                          }}>{item.moneda}</span>
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
                          {fmtARS(item.costoTotalARS)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button
                            onClick={() => openEdit(item)}
                            title="Editar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '3px 5px', fontSize: 13, borderRadius: 5 }}
                            onMouseEnter={e => e.currentTarget.style.color = COLOR}
                            onMouseLeave={e => e.currentTarget.style.color = C.muted}
                          >✏️</button>
                          <button
                            onClick={() => del(item)}
                            title="Eliminar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '3px 5px', fontSize: 13, borderRadius: 5 }}
                            onMouseEnter={e => e.currentTarget.style.color = C.red}
                            onMouseLeave={e => e.currentTarget.style.color = C.muted}
                          >🗑️</button>
                        </div>
                      </div>
                    ))}

                    {/* Totales del grupo */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 80px 100px 100px 110px 80px',
                      padding: '8px 14px 8px 28px',
                      borderTop: '1px solid var(--border)',
                      background: `${COLOR}08`,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      <span />
                      <span style={{ color: COLOR }}>TOTAL</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: COLOR }}>{g.totalStock}</span>
                      <span />
                      <span />
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: COLOR }}>
                        {fmtARS(g.items.reduce((s, i) => s + i.costoTotalARS, 0))}
                      </span>
                      <span />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal nuevo / editar ── */}
      {modal && (
        <Modal
          title={modal === 'new' ? `Agregar a ${config.title}` : `Editar Item — ${config.title}`}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={COLOR}
          width={600}
        >
          <FormGrid cols={2}>
            <Field label="Repuesto / Artículo" required col={2}>
              <AutoCapInput value={form.repuesto} onChange={e => set('repuesto', e.target.value)} placeholder="Nombre del repuesto o accesorio" style={inputSt} />
            </Field>
            <Field label="Categoría" required>
              <SearchableSelect value={form.categoria} onChange={v => set('categoria', v as CategoriaStock)} options={CATEGORIAS} placeholder="Buscar categoría..." />
            </Field>
            <Field label="Modelo Compatible">
              <SearchableSelect value={form.modelo} onChange={v => set('modelo', v)} options={MODELOS_DISPOSITIVOS} emptyOption="— Seleccionar modelo —" placeholder="Buscar modelo..." />
            </Field>
            <Field label="Proveedor" col={2}>
              <SearchableSelect
                value={form.proveedor}
                onChange={v => set('proveedor', v)}
                options={proveedoresOpciones}
                emptyOption="— Sin proveedor —"
                placeholder="Buscar proveedor..."
              />
            </Field>
          </FormGrid>

          <SectionDivider label="Inventario y Costos" color={COLOR} />

          <FormGrid cols={3}>
            <Field label="Stock (unidades)" required>
              <input type="number" min={0} value={form.stock} onChange={e => set('stock', parseInt(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Costo Unitario">
              <input type="number" min={0} value={form.costoUnitario} onChange={e => set('costoUnitario', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Moneda">
              <SearchableSelect value={form.moneda} onChange={v => set('moneda', v as Moneda)} options={MONEDAS} placeholder="Seleccionar moneda..." />
            </Field>
            <Field label="Costo Total ARS" calc col={3}>
              <input readOnly value={fmtARS(form.costoTotalARS)} style={calcSt} />
            </Field>
          </FormGrid>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
          </Field>
        </Modal>
      )}
    </div>
  )
}
