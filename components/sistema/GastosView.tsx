'use client'
import { useState } from 'react'
import type { Gasto, TipoGasto, CategoriaGasto, Moneda } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, DataTable, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'

const CATEGORIAS: CategoriaGasto[] = ['Repuesto/Insumo', 'Alquiler', 'Servicios', 'Sueldos', 'Marketing', 'Equipamiento', 'Impuestos', 'Otros']
const MONEDAS: Moneda[] = ['ARS $', 'USD $']

interface GastosViewProps {
  tipo: TipoGasto
}

const TIPO_CONFIG: Record<TipoGasto, { title: string; icon: string; color: string; desc: string }> = {
  local: { title: 'Gastos del Local', icon: '🧾', color: '#f87171', desc: 'Gastos operativos del local' },
  oficina: { title: 'Gastos de Oficina', icon: '🏠', color: '#fb923c', desc: 'Gastos de oficina y administración' },
  fijos: { title: 'Gastos Fijos', icon: '💰', color: '#a78bfa', desc: 'Gastos fijos mensuales' },
}

type FormState = Omit<Gasto, 'id' | 'createdAt' | 'tipo'>

function buildEmpty(): FormState {
  return {
    fecha: today(),
    descripcion: '',
    categoria: 'Otros',
    pagadoPor: '',
    monto: 0,
    moneda: 'ARS $',
    montoARS: 0,
    notas: '',
  }
}

function recalc(f: FormState, dolar: number): FormState {
  const montoARS = f.moneda === 'USD $' ? Math.round(f.monto * dolar) : Math.round(f.monto)
  return { ...f, montoARS }
}

export default function GastosView({ tipo }: GastosViewProps) {
  const config = TIPO_CONFIG[tipo]
  const { data: gastosData, loading, refresh } = useApi<{ items: Gasto[]; dolar: number }>(`/api/sistema/gastos?tipo=${tipo}`, [tipo])
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dolar = gastosData?.dolar ?? 1200

  const set = (k: string, v: unknown) => {
    setForm(prev => recalc({ ...prev, [k]: v }, dolar))
  }

  const openNew = () => {
    setForm(recalc(buildEmpty(), dolar))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (g: Gasto) => {
    const { id, createdAt, tipo: _tipo, ...rest } = g
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, tipo }
      if (modal === 'new') {
        await fetch('/api/sistema/gastos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        await fetch('/api/sistema/gastos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (g: Gasto) => {
    await fetch('/api/sistema/gastos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id }) })
    await refresh()
  }

  const list = gastosData?.items ?? []
  const totalARS = list.reduce((s, g) => s + g.montoARS, 0)

  // Current month filter for summary
  const currentMonth = today().slice(0, 7)
  const thisMes = list.filter(g => g.fecha.startsWith(currentMonth))
  const totalMes = thisMes.reduce((s, g) => s + g.montoARS, 0)

  const cols = [
    { key: 'fecha', label: 'Fecha', render: (r: Gasto) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'descripcion', label: 'Descripción', render: (r: Gasto) => <span style={{ fontWeight: 600 }}>{r.descripcion}</span> },
    { key: 'categoria', label: 'Categoría', render: (r: Gasto) => <Badge label={r.categoria} color={config.color} /> },
    { key: 'pagadoPor', label: 'Pagado por', render: (r: Gasto) => <span style={{ color: C.muted }}>{r.pagadoPor}</span> },
    {
      key: 'monto', label: 'Monto', align: 'right' as const,
      render: (r: Gasto) => <span style={{ fontFamily: 'monospace' }}>{r.moneda === 'USD $' ? `USD ${r.monto}` : fmtARS(r.monto)}</span>
    },
    {
      key: 'montoARS', label: 'Monto ARS', align: 'right' as const,
      render: (r: Gasto) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtARS(r.montoARS)}</span>
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon={config.icon}
        title={config.title}
        desc={config.desc}
        color={config.color}
        count={list.length}
        onNew={openNew}
        newLabel="Nuevo gasto"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Gastos (ARS)" value={fmtARS(totalARS)} color={config.color} icon="💸" />
        <KPICard label="Total Mes Actual" value={fmtARS(totalMes)} color={config.color} icon="📅" sub={currentMonth} />
        <KPICard label="Cantidad Registros" value={String(list.length)} color={config.color} icon="🧾" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <DataTable cols={cols} data={list} onEdit={openEdit} onDelete={del} accentColor={config.color} emptyMsg="No hay gastos registrados" />
      )}

      {modal && (
        <Modal
          title={modal === 'new' ? `Nuevo Gasto — ${config.title}` : `Editar Gasto — ${config.title}`}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={config.color}
          width={600}
        >
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Categoría" required>
              <SearchableSelect value={form.categoria} onChange={v => set('categoria', v as CategoriaGasto)} options={CATEGORIAS} placeholder="Buscar categoría..." />
            </Field>
            <Field label="Descripción" required col={2}>
              <AutoCapInput value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del gasto" style={inputSt} />
            </Field>
            <Field label="Pagado por" col={2}>
              <AutoCapInput value={form.pagadoPor} onChange={e => set('pagadoPor', e.target.value)} placeholder="Nombre o método de pago" style={inputSt} />
            </Field>
            <Field label="Monto" required>
              <input type="number" min={0} value={form.monto} onChange={e => set('monto', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Moneda">
              <SearchableSelect value={form.moneda} onChange={v => set('moneda', v as Moneda)} options={MONEDAS} placeholder="Seleccionar moneda..." />
            </Field>
            <Field label="Monto en ARS" calc col={2}>
              <input readOnly value={fmtARS(form.montoARS)} style={calcSt} />
            </Field>
            <Field label="Notas" col={2}>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
