'use client'
import { useState, useEffect } from 'react'
import type { VentaGremio, VentaCaja, MetodoPago, Moneda } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, DataTable, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'

const COLOR = '#34d399'
const METODOS: MetodoPago[] = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito']
const MONEDAS: Moneda[] = ['ARS $', 'USD $']

type FormState = Omit<VentaGremio, 'id' | 'createdAt' | 'nOrden'>

function buildEmpty(dolar: number): FormState {
  return {
    fecha: today(),
    cliente: '',
    tipoReparacion: '',
    repuestosUsados: '',
    costoRepuestos: 0,
    montoCobrado: 0,
    moneda: 'ARS $',
    equivARS: 0,
    metodoPago: 'Efectivo',
    montoNeto: 0,
    comisionMP: 0,
    iibb: 0,
    comisionTecnico: 0,
    gananciaReal: 0,
    notas: '',
  }
}

function recalc(f: FormState, dolar: number): FormState {
  const equivARS = f.moneda === 'USD $' ? Math.round(f.montoCobrado * dolar) : Math.round(f.montoCobrado)
  const montoNeto = equivARS
  const comisionMP = f.metodoPago === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
  const iibb = Math.round(equivARS * 0.04)
  const gananciaReal = equivARS - f.costoRepuestos - comisionMP - iibb - f.comisionTecnico
  return { ...f, equivARS, montoNeto, comisionMP, iibb, gananciaReal }
}

interface ApiResponse { items: VentaGremio[]; nextOrden: number; dolar: number }

export default function VentasGremioView() {
  const { data, loading, refresh } = useApi<ApiResponse>('/api/sistema/ventas-gremio')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty(1200))
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dolar = data?.dolar ?? 1200

  const set = (k: string, v: unknown) => {
    setForm(prev => recalc({ ...prev, [k]: v }, dolar))
  }

  const openNew = () => {
    setForm(recalc(buildEmpty(dolar), dolar))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (v: VentaGremio) => {
    const { id, createdAt, nOrden, ...rest } = v
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/ventas-gremio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/ventas-gremio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (v: VentaGremio) => {
    await fetch('/api/sistema/ventas-gremio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) })
    await refresh()
  }

  const [cajaTotalGremio, setCajaTotalGremio] = useState(0)
  const [cajaCountGremio, setCajaCountGremio] = useState(0)
  const [cajaGananciaGremio, setCajaGananciaGremio] = useState(0)
  useEffect(() => {
    fetch('/api/sistema/ventas-caja').then(r => r.json()).then((d: { items: VentaCaja[] }) => {
      const items = (d.items ?? []).filter(v => v.tipoCliente === 'gremio')
      setCajaTotalGremio(items.reduce((s, v) => s + v.total, 0))
      setCajaCountGremio(items.length)
      // Ganancia real de caja: usa el campo calculado si existe, sino 0
      setCajaGananciaGremio(items.reduce((s, v) => s + (v.gananciaReal ?? 0), 0))
    }).catch(() => {})
  }, [])

  const list = data?.items ?? []
  const totalCobrado = list.reduce((s, v) => s + v.equivARS, 0) + cajaTotalGremio
  const totalGanancia = list.reduce((s, v) => s + v.gananciaReal, 0) + cajaGananciaGremio
  const cantidadTotal = list.length + cajaCountGremio

  const cols = [
    { key: 'fecha', label: 'Fecha', render: (r: VentaGremio) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'nOrden', label: 'N°Orden', render: (r: VentaGremio) => <span style={{ fontFamily: 'monospace', color: C.muted }}>#{r.nOrden}</span> },
    { key: 'cliente', label: 'Cliente', render: (r: VentaGremio) => <span style={{ fontWeight: 600 }}>{r.cliente}</span> },
    { key: 'tipoReparacion', label: 'Reparación' },
    {
      key: 'montoCobrado', label: 'Monto Cobrado', align: 'right' as const,
      render: (r: VentaGremio) => <span style={{ fontFamily: 'monospace' }}>{r.moneda === 'USD $' ? `USD ${r.montoCobrado}` : fmtARS(r.montoCobrado)}</span>
    },
    {
      key: 'equivARS', label: 'Equiv. ARS', align: 'right' as const,
      render: (r: VentaGremio) => <span style={{ fontFamily: 'monospace' }}>{fmtARS(r.equivARS)}</span>
    },
    { key: 'metodoPago', label: 'Método Pago', render: (r: VentaGremio) => <span style={{ fontSize: 11, color: C.muted }}>{r.metodoPago}</span> },
    {
      key: 'gananciaReal', label: 'Ganancia', align: 'right' as const,
      render: (r: VentaGremio) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.gananciaReal >= 0 ? C.green : C.red }}>{fmtARS(r.gananciaReal)}</span>
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader icon="🤝" title="Ventas Gremio (B2B)" desc="Ventas a empresas y gremios" color={COLOR} count={cantidadTotal} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Cobrado (ARS)" value={fmtARS(totalCobrado)} color={COLOR} icon="💼" />
        <KPICard label="Ganancia Total" value={fmtARS(totalGanancia)} color={totalGanancia >= 0 ? C.green : C.red} icon="📈" />
        <KPICard label="Cantidad Ventas" value={String(cantidadTotal)} color={COLOR} icon="🧾" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <DataTable cols={cols} data={list} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay ventas registradas" />
      )}

      {modal && (
        <Modal title={modal === 'new' ? 'Nueva Venta Gremio' : 'Editar Venta Gremio'} onClose={() => setModal(false)} onSubmit={save} submitting={saving} submitColor={COLOR} width={660}>
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Cliente" required>
              <AutoCapInput value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Empresa o nombre" style={inputSt} />
            </Field>
            <Field label="Tipo de Reparación" required col={2}>
              <AutoCapInput value={form.tipoReparacion} onChange={e => set('tipoReparacion', e.target.value)} placeholder="Descripción de la reparación" style={inputSt} />
            </Field>
            <Field label="Repuestos Usados" col={2}>
              <textarea value={form.repuestosUsados} onChange={e => set('repuestosUsados', e.target.value)} rows={2} placeholder="Lista de repuestos utilizados..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
            <Field label="Costo Repuestos (ARS)">
              <input type="number" min={0} value={form.costoRepuestos} onChange={e => set('costoRepuestos', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Cobro" color={COLOR} />

          <FormGrid cols={3}>
            <Field label="Monto Cobrado" required>
              <input type="number" min={0} value={form.montoCobrado} onChange={e => set('montoCobrado', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Moneda">
              <SearchableSelect value={form.moneda} onChange={v => set('moneda', v as Moneda)} options={MONEDAS} placeholder="Seleccionar moneda..." />
            </Field>
            <Field label="Equiv. ARS" calc>
              <input readOnly value={fmtARS(form.equivARS)} style={calcSt} />
            </Field>
            <Field label="Método de Pago" col={2}>
              <SearchableSelect value={form.metodoPago} onChange={v => set('metodoPago', v as MetodoPago)} options={METODOS} placeholder="Buscar método..." />
            </Field>
            <Field label="Monto Neto" calc>
              <input readOnly value={fmtARS(form.montoNeto)} style={calcSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Deducciones" color={C.orange} />

          <FormGrid cols={3}>
            <Field label="Comisión MP (4.5%)" calc>
              <input readOnly value={fmtARS(form.comisionMP)} style={calcSt} />
            </Field>
            <Field label="IIBB (4%)" calc>
              <input readOnly value={fmtARS(form.iibb)} style={calcSt} />
            </Field>
            <Field label="Comisión Técnico">
              <input type="number" min={0} value={form.comisionTecnico} onChange={e => set('comisionTecnico', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Resultado" color={form.gananciaReal >= 0 ? C.green : C.red} />

          <Field label="Ganancia Real" calc>
            <input readOnly value={fmtARS(form.gananciaReal)} style={{ ...calcSt, color: form.gananciaReal >= 0 ? C.green : C.red, fontSize: 16 }} />
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
          </Field>
        </Modal>
      )}
    </div>
  )
}
