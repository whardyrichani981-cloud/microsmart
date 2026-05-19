'use client'
import { useState } from 'react'
import type { StockItem, TipoStock, CategoriaStock, Moneda } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, DataTable, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'

const CATEGORIAS: CategoriaStock[] = ['Accesorios', 'Altavoz', 'Batería', 'Cámara', 'Chasis', 'Flex', 'Otro', 'Pantalla/Módulo', 'Parlante', 'Vidrio trasero']
const MONEDAS: Moneda[] = ['ARS $', 'USD $']

interface StockViewProps {
  tipo: TipoStock
}

const TIPO_CONFIG: Record<TipoStock, { title: string; icon: string; color: string; desc: string }> = {
  repuestos: { title: 'Stock de Repuestos', icon: '🔧', color: '#a78bfa', desc: 'Inventario de repuestos Apple' },
  accesorios: { title: 'Stock de Accesorios', icon: '🎧', color: '#fb923c', desc: 'Inventario de accesorios' },
}

type FormState = Omit<StockItem, 'id' | 'updatedAt' | 'tipo'>

function buildEmpty(): FormState {
  return {
    repuesto: '',
    categoria: 'Otro',
    modelo: '',
    proveedor: '',
    stock: 0,
    costoUnitario: 0,
    moneda: 'ARS $',
    costoTotalARS: 0,
    notas: '',
  }
}

function recalc(f: FormState, dolar: number): FormState {
  const costoTotalARS = Math.round(f.stock * f.costoUnitario * (f.moneda === 'USD $' ? dolar : 1))
  return { ...f, costoTotalARS }
}

export default function StockView({ tipo }: StockViewProps) {
  const config = TIPO_CONFIG[tipo]
  const { data: stockData, loading, refresh } = useApi<{ items: StockItem[]; dolar: number }>(`/api/sistema/stock?tipo=${tipo}`, [tipo])
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dolar = stockData?.dolar ?? 1200

  const set = (k: string, v: unknown) => {
    setForm(prev => recalc({ ...prev, [k]: v }, dolar))
  }

  const openNew = () => {
    setForm(recalc(buildEmpty(), dolar))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (item: StockItem) => {
    const { id, updatedAt, tipo: _tipo, ...rest } = item
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
    await fetch('/api/sistema/stock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
    await refresh()
  }

  const list = stockData?.items ?? []
  const totalItems = list.length
  const valorTotal = list.reduce((s, i) => s + i.costoTotalARS, 0)
  const lowStock = list.filter(i => i.stock < 2).length
  const sinStock = list.filter(i => i.stock === 0).length

  const cols = [
    {
      key: 'repuesto', label: 'Repuesto',
      render: (r: StockItem) => <span style={{ fontWeight: 600 }}>{r.repuesto}</span>
    },
    { key: 'categoria', label: 'Categoría', render: (r: StockItem) => <Badge label={r.categoria} color={config.color} /> },
    { key: 'modelo', label: 'Modelo' },
    { key: 'proveedor', label: 'Proveedor', render: (r: StockItem) => <span style={{ color: C.muted }}>{r.proveedor}</span> },
    {
      key: 'stock', label: 'Stock', align: 'right' as const,
      render: (r: StockItem) => (
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          color: r.stock === 0 ? C.red : r.stock < 2 ? '#fb923c' : C.text,
          background: r.stock === 0 ? 'rgba(248,113,113,0.1)' : r.stock < 2 ? 'rgba(251,146,60,0.1)' : 'transparent',
          padding: '2px 6px',
          borderRadius: 4,
        }}>
          {r.stock}
        </span>
      )
    },
    {
      key: 'costoUnitario', label: 'Costo Unit.', align: 'right' as const,
      render: (r: StockItem) => <span style={{ fontFamily: 'monospace' }}>{r.moneda === 'USD $' ? `USD ${r.costoUnitario}` : fmtARS(r.costoUnitario)}</span>
    },
    {
      key: 'costoTotalARS', label: 'Costo Total ARS', align: 'right' as const,
      render: (r: StockItem) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtARS(r.costoTotalARS)}</span>
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon={config.icon}
        title={config.title}
        desc={config.desc}
        color={config.color}
        count={totalItems}
        onNew={openNew}
        newLabel="Agregar item"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Items" value={String(totalItems)} color={config.color} icon="📦" />
        <KPICard label="Valor Total Stock" value={fmtARS(valorTotal)} color={config.color} icon="💰" />
        <KPICard label="Stock Bajo (< 2)" value={String(lowStock)} color={lowStock > 0 ? '#fb923c' : C.muted} icon="⚠️" />
        <KPICard label="Sin Stock" value={String(sinStock)} color={sinStock > 0 ? C.red : C.muted} icon="🚫" />
      </div>

      {lowStock > 0 && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 12, color: '#fb923c' }}>
          ⚠️ {lowStock} item{lowStock > 1 ? 's' : ''} con stock bajo (menos de 2 unidades)
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <DataTable cols={cols} data={list} onEdit={openEdit} onDelete={del} accentColor={config.color} emptyMsg="No hay items en el stock" />
      )}

      {modal && (
        <Modal
          title={modal === 'new' ? `Agregar a ${config.title}` : `Editar Item — ${config.title}`}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={config.color}
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
              <AutoCapInput value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre del proveedor" style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Inventario y Costos" color={config.color} />

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
