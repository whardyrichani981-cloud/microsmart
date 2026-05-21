'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { matchesAny } from '@/lib/search'
import type { StockItem, Moneda, Proveedor } from '@/lib/sistema-types'
import {
  useApi, fmtARS,
  C, Modal, Field, FormGrid, SectionDivider, KPICard,
  inputSt, calcSt, AutoCapInput,
} from './shared'
import ImportExcelModal from './ImportExcelModal'

const ACC_IMPORT_COLS = [
  { key: 'repuesto',     label: 'Nombre',          required: true,  type: 'string' as const, aliases: ['nombre', 'accesorio'] },
  { key: 'categoria',    label: 'Categoría',        required: false, type: 'string' as const, default: 'Accesorios' },
  { key: 'modelo',       label: 'Modelo',           required: false, type: 'string' as const, default: '' },
  { key: 'proveedor',    label: 'Proveedor',        required: false, type: 'string' as const, default: '' },
  { key: 'stock',        label: 'Stock',            required: false, type: 'number' as const, default: 0 },
  { key: 'stockMinimo',  label: 'Stock mínimo',     required: false, type: 'number' as const, default: 1, aliases: ['stock minimo', 'minimo'] },
  { key: 'costoUnitario',label: 'Costo unit.',      required: false, type: 'number' as const, default: 0, aliases: ['costo'] },
  { key: 'precioVenta',  label: 'Precio venta',     required: false, type: 'number' as const, default: 0, aliases: ['precio', 'precio de venta'] },
  { key: 'moneda',       label: 'Moneda',           required: false, type: 'string' as const, default: 'ARS $' },
  { key: 'notas',        label: 'Notas',            required: false, type: 'string' as const, default: '' },
]

const ACC_TEMPLATE_ROWS = [
  { repuesto: 'Funda silicona', categoria: 'Accesorios', modelo: 'iPhone 14', proveedor: 'Proveedor ABC', stock: 10, stockMinimo: 3, costoUnitario: 2000, precioVenta: 5500, moneda: 'ARS $', notas: '' },
  { repuesto: 'Cable USB-C', categoria: 'Accesorios', modelo: 'Universal', proveedor: 'Proveedor XYZ', stock: 20, stockMinimo: 5, costoUnitario: 1500, precioVenta: 4000, moneda: 'ARS $', notas: '' },
]

const COLOR = '#fb923c'
const COLOR2 = '#f97316'
const MONEDAS: Moneda[] = ['ARS $', 'USD $']

type FormState = Omit<StockItem, 'id' | 'updatedAt' | 'tipo' | 'categoria'> & { categoria: string }

function buildEmpty(): FormState {
  return {
    repuesto: '', categoria: '', modelo: '', proveedor: '',
    stock: 0, stockMinimo: 1, costoUnitario: 0, precioVenta: 0,
    moneda: 'ARS $', costoTotalARS: 0, imagen: '', notas: '',
  }
}

// ── AutoComplete genérico con botón "+ Nuevo" ───────────────────────────────
interface QuickSelectProps {
  value: string
  onChange: (val: string) => void
  options: string[]          // lista de valores disponibles
  placeholder?: string
  accentColor?: string
  onAddNew?: (nombre: string) => void   // si está presente, muestra "+ Nuevo"
  addNewLabel?: string
}

function QuickSelect({ value, onChange, options, placeholder, accentColor = COLOR, onAddNew, addNewLabel }: QuickSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = value.trim().length >= 1
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', gap: 6 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <AutoCapInput
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={inputSt}
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
            background: 'var(--surface)', border: `1px solid ${accentColor}`,
            borderRadius: 10, boxShadow: '0 8px 24px var(--shadow)',
            maxHeight: 200, overflowY: 'auto',
          }}>
            {filtered.map((opt, i) => (
              <div key={`${opt}-${i}`}
                onMouseDown={() => { onChange(opt); setOpen(false) }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                  color: opt === value ? accentColor : 'var(--text-primary)',
                  background: opt === value ? `${accentColor}12` : 'transparent',
                  fontWeight: opt === value ? 600 : 400,
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (opt !== value) e.currentTarget.style.background = 'transparent' }}
              >{opt}</div>
            ))}
          </div>
        )}
      </div>
      {onAddNew && (
        <button
          type="button"
          onClick={() => onAddNew(value)}
          title={addNewLabel ?? 'Agregar nuevo'}
          style={{
            padding: '0 12px', borderRadius: 8, border: `1px solid ${accentColor}`,
            background: 'none', color: accentColor, cursor: 'pointer',
            fontSize: 18, fontWeight: 700, flexShrink: 0, lineHeight: 1,
          }}
        >+</button>
      )}
    </div>
  )
}

// ── Mini form nuevo proveedor ───────────────────────────────────────────────
interface NuevoProveedorFormProps {
  nombreInicial?: string
  onCreated: (nombre: string) => void
  onCancel: () => void
}

function NuevoProveedorForm({ nombreInicial, onCreated, onCancel }: NuevoProveedorFormProps) {
  const [nombre, setNombre] = useState(nombreInicial ?? '')
  const [telefono, setTelefono] = useState('')
  const [contacto, setContacto] = useState('')
  const [saving, setSaving] = useState(false)

  const crear = async () => {
    if (!nombre.trim()) return alert('El nombre del proveedor es obligatorio')
    setSaving(true)
    try {
      await fetch('/api/sistema/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), contacto, telefono, mail: '', web: '', condicionesPago: '', notas: '', direccion: '' }),
      })
      onCreated(nombre.trim())
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--bg)', border: `1px solid ${COLOR}`, borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        ✨ Nuevo Proveedor
      </div>
      <FormGrid cols={3}>
        <Field label="Nombre *">
          <AutoCapInput value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del proveedor" style={inputSt} />
        </Field>
        <Field label="Contacto">
          <AutoCapInput value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Nombre del contacto" style={inputSt} />
        </Field>
        <Field label="Teléfono">
          <input value={telefono} onChange={e => setTelefono(e.target.value)} style={inputSt} placeholder="11 1234-5678" />
        </Field>
      </FormGrid>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={crear} disabled={saving}
          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: COLOR, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
          {saving ? 'Guardando...' : '💾 Crear proveedor'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Tarjeta de accesorio ────────────────────────────────────────────────────
function AccesorioCard({ item, onEdit, onDelete }: { item: StockItem; onEdit: (i: StockItem) => void; onDelete: (i: StockItem) => void }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const sinStock = item.stock === 0

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${sinStock ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${COLOR}22`; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Imagen */}
      <div style={{
        height: 160, background: 'var(--bg)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
        borderBottom: '1px solid var(--border)',
      }}>
        {item.imagen
          ? <img src={item.imagen} alt={item.repuesto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 52, opacity: 0.3 }}>🛍️</span>
        }
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: sinStock ? 'rgba(239,68,68,0.9)' : item.stock <= (item.stockMinimo ?? 1) ? 'rgba(251,146,60,0.9)' : 'rgba(34,197,94,0.9)',
          color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700,
        }}>
          {sinStock ? 'Sin stock' : `${item.stock} u.`}
        </div>
        {item.categoria && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: `${COLOR}dd`, color: '#fff', borderRadius: 20,
            padding: '2px 8px', fontSize: 10, fontWeight: 600,
          }}>{item.categoria}</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.repuesto}</div>
        {item.modelo && <div style={{ fontSize: 11, color: C.muted }}>{item.modelo}</div>}
        <div style={{ marginTop: 6 }}>
          {item.precioVenta
            ? <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{fmtARS(item.precioVenta)}</div>
            : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Sin precio de venta</div>
          }
          {item.costoUnitario > 0 && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              Costo: {fmtARS(item.costoUnitario)}
              {item.precioVenta && item.costoUnitario > 0 && (
                <span style={{ marginLeft: 6, color: '#22c55e', fontWeight: 600 }}>
                  +{Math.round(((item.precioVenta - item.costoUnitario) / item.costoUnitario) * 100)}%
                </span>
              )}
            </div>
          )}
        </div>
        {item.proveedor && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>📦 {item.proveedor}</div>}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
        {confirmDel ? (
          <>
            <button onClick={e => { e.stopPropagation(); onDelete(item) }}
              style={{ flex: 1, padding: '9px 0', border: 'none', background: '#ef444420', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Confirmar
            </button>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(false) }}
              style={{ flex: 1, padding: '9px 0', border: 'none', borderLeft: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button onClick={e => { e.stopPropagation(); onEdit(item) }}
              style={{ flex: 1, padding: '9px 0', border: 'none', background: 'none', color: COLOR, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              ✏️ Editar
            </button>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
              style={{ flex: 1, padding: '9px 0', border: 'none', borderLeft: '1px solid var(--border)', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
              🗑 Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Vista principal ─────────────────────────────────────────────────────────
export default function AccesoriosView() {
  const { data: stockData, loading, refresh } = useApi<{ items: StockItem[]; dolar: number }>('/api/sistema/stock?tipo=accesorios')
  const items = stockData?.items ?? []
  const dolar = stockData?.dolar ?? 1200

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [catFilter, setCatFilter] = useState<string>('Todas')
  const [showNuevoProv, setShowNuevoProv] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)

  // Cargar proveedores cuando se abre el modal
  useEffect(() => {
    if (!modal) return
    fetch('/api/sistema/proveedores').then(r => r.json()).then(data => {
      setProveedores(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [modal])

  const setF = (upd: Partial<FormState>) => {
    setForm(prev => {
      const next = { ...prev, ...upd }
      if ('stock' in upd || 'costoUnitario' in upd || 'moneda' in upd) {
        next.costoTotalARS = Math.round(next.stock * next.costoUnitario * (next.moneda === 'USD $' ? dolar : 1))
      }
      return next
    })
  }

  const openNew = () => { setForm(buildEmpty()); setEditId(null); setShowNuevoProv(false); setModal('new') }
  const openEdit = (item: StockItem) => {
    const { id, updatedAt, tipo, ...rest } = item
    setForm({ ...rest, imagen: rest.imagen ?? '', precioVenta: rest.precioVenta ?? 0, categoria: rest.categoria ?? '' })
    setEditId(id); setShowNuevoProv(false); setModal('edit')
  }

  const save = async () => {
    if (!form.repuesto.trim()) return alert('El nombre del accesorio es obligatorio')
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = modal === 'new'
        ? { ...form, tipo: 'accesorios' } as any
        : { id: editId, ...form, tipo: 'accesorios' } as any
      await fetch('/api/sistema/stock', {
        method: modal === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await refresh(); setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (item: StockItem) => {
    await fetch('/api/sistema/stock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
    await refresh()
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setF({ imagen: reader.result as string })
    reader.readAsDataURL(file)
  }

  // Categorías y proveedores como listas de strings
  const categoriasExistentes = useMemo(() => {
    const cats = [...new Set(items.map(i => i.categoria).filter(Boolean))]
    return (cats as string[]).sort()
  }, [items])

  const proveedoresNombres = useMemo(() =>
    proveedores.map(p => p.nombre).sort(), [proveedores])

  // Filtros
  const filtered = useMemo(() => {
    let list = items
    if (catFilter !== 'Todas') list = list.filter(i => i.categoria === catFilter)
    if (search.trim()) {
      list = list.filter(i =>
        matchesAny([i.repuesto, i.modelo, i.categoria, i.proveedor], search)
      )
    }
    return list
  }, [items, catFilter, search])

  // KPIs
  const totalItems = items.length
  const valorStock = items.reduce((s, i) => s + (i.precioVenta ?? 0) * i.stock, 0)
  const sinStock = items.filter(i => i.stock === 0).length

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: `${COLOR}20` }}>🛍️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Catálogo de Accesorios</h2>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
              Accesorios disponibles para la venta — {totalItems} producto{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setImportOpen(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${COLOR}44`, background: `${COLOR}10`, color: COLOR, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📥 Importar Excel</button>
          <button onClick={openNew} style={{
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR2})`,
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: `0 2px 8px ${COLOR}44`,
          }}>+ Nuevo accesorio</button>
        </div>
      </div>
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); refresh() }}
        title="Importar Accesorios"
        color={COLOR}
        cols={ACC_IMPORT_COLS}
        apiEndpoint="/api/sistema/stock"
        buildPayload={row => ({ ...row, tipo: 'accesorios' })}
        templateRows={ACC_TEMPLATE_ROWS}
        templateFilename="plantilla-accesorios.xlsx"
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total accesorios" value={String(totalItems)} icon="🛍️" color={COLOR} />
        <KPICard label="Valor en stock" value={fmtARS(valorStock)} icon="💰" color="#22c55e" />
        <KPICard label="Sin stock" value={String(sinStock)} icon="⚠️" color={sinStock > 0 ? '#ef4444' : C.muted} />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar accesorio..."
          style={{ ...inputSt, width: 220, flex: 'none' }}
        />
        {categoriasExistentes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Todas', ...categoriasExistentes].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all .15s',
                background: catFilter === cat ? COLOR : 'var(--surface)',
                color: catFilter === cat ? '#fff' : C.muted,
              }}>{cat}</button>
            ))}
          </div>
        )}
        {(search || catFilter !== 'Todas') && (
          <button onClick={() => { setSearch(''); setCatFilter('Todas') }}
            style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            × Limpiar
          </button>
        )}
      </div>

      {/* Grilla */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Cargando accesorios...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {items.length === 0 ? 'Todavía no hay accesorios cargados' : 'No se encontraron resultados'}
          </div>
          <div style={{ fontSize: 13 }}>
            {items.length === 0 ? 'Hacé clic en "+ Nuevo accesorio" para empezar a cargar el catálogo' : 'Probá con otro término de búsqueda'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {filtered.map(item => (
            <AccesorioCard key={item.id} item={item} onEdit={openEdit} onDelete={del} />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <Modal
          title={modal === 'new' ? '+ Nuevo Accesorio' : '✏️ Editar Accesorio'}
          onClose={() => setModal(false)} onSubmit={save} submitting={saving}
          submitColor={COLOR} width={660}
        >
          <FormGrid cols={2}>
            <Field label="Nombre del accesorio" required col={2}>
              <AutoCapInput
                value={form.repuesto}
                onChange={e => setF({ repuesto: e.target.value })}
                placeholder="Ej: Cable USB-C Apple Original"
                style={inputSt}
              />
            </Field>

            {/* Categoría con búsqueda + agregar rápido */}
            <Field label="Categoría">
              <QuickSelect
                value={form.categoria}
                onChange={v => setF({ categoria: v })}
                options={categoriasExistentes}
                placeholder="Cables, Fundas, Cargadores..."
                accentColor={COLOR}
              />
            </Field>

            <Field label="Variante / Modelo">
              <AutoCapInput
                value={form.modelo}
                onChange={e => setF({ modelo: e.target.value })}
                placeholder="Ej: Negro, 1m, 20W..."
                style={inputSt}
              />
            </Field>
          </FormGrid>

          <SectionDivider label="Precios y stock" color={COLOR} />

          <FormGrid cols={3}>
            <Field label="Precio de venta ($)" required>
              <input type="number" min={0} value={form.precioVenta ?? 0}
                onChange={e => setF({ precioVenta: parseFloat(e.target.value) || 0 })}
                style={{ ...inputSt, fontWeight: 700, color: COLOR }} />
            </Field>
            <Field label="Costo de compra">
              <input type="number" min={0} value={form.costoUnitario}
                onChange={e => setF({ costoUnitario: parseFloat(e.target.value) || 0 })}
                style={inputSt} />
            </Field>
            <Field label="Moneda costo">
              <select value={form.moneda} onChange={e => setF({ moneda: e.target.value as Moneda })} style={inputSt}>
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Cantidad en stock">
              <input type="number" min={0} value={form.stock}
                onChange={e => setF({ stock: parseInt(e.target.value) || 0 })}
                style={inputSt} />
            </Field>
            <Field label="Stock mínimo">
              <input type="number" min={0} value={form.stockMinimo}
                onChange={e => setF({ stockMinimo: parseInt(e.target.value) || 1 })}
                style={inputSt} />
            </Field>
            <Field label="Margen de ganancia" calc>
              <input readOnly
                value={form.precioVenta && form.costoUnitario
                  ? `${Math.round(((form.precioVenta - form.costoUnitario) / form.costoUnitario) * 100)}%`
                  : '—'}
                style={{ ...calcSt, color: (form.precioVenta ?? 0) > form.costoUnitario ? '#22c55e' : C.muted }} />
            </Field>
          </FormGrid>

          <SectionDivider label="Imagen del producto" color="#818cf8" />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 120, height: 120, borderRadius: 12, border: `2px dashed ${COLOR}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', background: 'var(--bg)', flexShrink: 0, cursor: 'pointer',
            }} onClick={() => imgRef.current?.click()}>
              {form.imagen
                ? <img src={form.imagen} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: C.muted }}>
                    <div style={{ fontSize: 28 }}>📷</div>
                    <div style={{ fontSize: 10, marginTop: 4 }}>Subir foto</div>
                  </div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
              <button onClick={() => imgRef.current?.click()} style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${COLOR}`, background: 'none', color: COLOR,
                fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8,
              }}>📁 Elegir imagen</button>
              {form.imagen && (
                <button onClick={() => setF({ imagen: '' })} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'none', color: '#ef4444',
                  fontSize: 12, display: 'block',
                }}>× Quitar imagen</button>
              )}
              <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>JPG, PNG o WebP. Se guarda dentro del sistema.</p>
            </div>
          </div>

          <SectionDivider label="Proveedor" color={C.muted} />

          {/* Proveedor con búsqueda y + nuevo */}
          <Field label="Proveedor">
            <QuickSelect
              value={form.proveedor}
              onChange={v => setF({ proveedor: v })}
              options={proveedoresNombres}
              placeholder="Buscar proveedor o escribir nombre..."
              accentColor={COLOR}
              onAddNew={() => setShowNuevoProv(v => !v)}
              addNewLabel="Agregar proveedor rápido"
            />
            {showNuevoProv && (
              <NuevoProveedorForm
                nombreInicial={form.proveedor}
                onCreated={nombre => {
                  setF({ proveedor: nombre })
                  setProveedores(prev => [...prev, { id: Date.now().toString(), nombre, contacto: '', telefono: '', mail: '', web: '', condicionesPago: '', notas: '', direccion: '', createdAt: new Date().toISOString() }])
                  setShowNuevoProv(false)
                }}
                onCancel={() => setShowNuevoProv(false)}
              />
            )}
          </Field>

          <div style={{ marginTop: 12 }} />
          <Field label="Notas">
            <AutoCapInput
              value={form.notas}
              onChange={e => setF({ notas: e.target.value })}
              placeholder="Observaciones..."
              style={inputSt}
            />
          </Field>
        </Modal>
      )}
    </div>
  )
}
