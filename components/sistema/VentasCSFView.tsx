'use client'
import { useState, useEffect } from 'react'
import type { VentaCSF, VentaCaja, MetodoPago, TipoServicio } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, DataTable, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'

const COLOR = '#4ade80'
const TECNICOS = ['Ronald', 'Sharon', 'Saddi'] as const
const METODOS: MetodoPago[] = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito']
const SERVICIOS: TipoServicio[] = ['Cambio pantalla', 'Cambio batería', 'Reparación placa', 'Reparación cámara', 'Reparación conector', 'Desbloqueo', 'Software', 'Otro']

type FormState = Omit<VentaCSF, 'id' | 'createdAt' | 'nOrden'>

function buildEmpty(dolar: number): FormState {
  return {
    fecha: today(),
    nombreCliente: '',
    tecnico: 'Ronald',
    tipoServicio: 'Cambio pantalla',
    modeloEquipo: '',
    proveedor: '',
    tipoRepuesto: '',
    costoRepuestoUSD: 0,
    precioDolar: dolar,
    costoRepuestoPesos: 0,
    ticket: 0,
    metodoPago: 'Efectivo',
    montoNetoRecibido: 0,
    comisionMP: 0,
    iibb: 0,
    comisionVendedora: 0,
    comisionTecnico: 0,
    gananciaReal: 0,
    notas: '',
  }
}

function recalc(f: FormState): FormState {
  const costoRepuestoPesos = Math.round(f.costoRepuestoUSD * f.precioDolar)
  const montoNetoRecibido = f.ticket
  const comisionMP = f.metodoPago === 'Mercado Pago' ? Math.round(f.ticket * 0.045) : 0
  const iibb = Math.round(f.ticket * 0.04)
  const gananciaReal = f.ticket - costoRepuestoPesos - comisionMP - iibb - f.comisionVendedora - f.comisionTecnico
  return { ...f, costoRepuestoPesos, montoNetoRecibido, comisionMP, iibb, gananciaReal }
}

interface ApiResponse { items: VentaCSF[]; nextOrden: number; dolar: number }

export default function VentasCSFView() {
  const { data, loading, refresh } = useApi<ApiResponse>('/api/sistema/ventas-csf')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty(1200))
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dolar = data?.dolar ?? 1200

  const set = (k: string, v: unknown) => {
    setForm(prev => recalc({ ...prev, [k]: v }))
  }

  const openNew = () => {
    setForm(recalc(buildEmpty(dolar)))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (v: VentaCSF) => {
    const { id, createdAt, nOrden, ...rest } = v
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/ventas-csf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/ventas-csf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (v: VentaCSF) => {
    await fetch('/api/sistema/ventas-csf', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) })
    await refresh()
  }

  const [cajaTotalCSF, setCajaTotalCSF] = useState(0)
  const [cajaCountCSF, setCajaCountCSF] = useState(0)
  const [cajaGananciaCSF, setCajaGananciaCSF] = useState(0)
  useEffect(() => {
    fetch('/api/sistema/ventas-caja').then(r => r.json()).then((d: { items: VentaCaja[] }) => {
      const items = (d.items ?? []).filter(v => v.tipoCliente === 'clienteFinal' || (!v.tipoCliente && v.tipoFactura !== 'A'))
      setCajaTotalCSF(items.reduce((s, v) => s + v.total, 0))
      setCajaCountCSF(items.length)
      // Ganancia real de caja: usa el campo calculado si existe, sino 0 (ventas anteriores sin costo)
      setCajaGananciaCSF(items.reduce((s, v) => s + (v.gananciaReal ?? 0), 0))
    }).catch(() => {})
  }, [])

  const list = data?.items ?? []
  const totalTickets = list.reduce((s, v) => s + v.ticket, 0) + cajaTotalCSF
  const totalGanancia = list.reduce((s, v) => s + v.gananciaReal, 0) + cajaGananciaCSF
  const cantidadTotal = list.length + cajaCountCSF

  const cols = [
    { key: 'fecha', label: 'Fecha', render: (r: VentaCSF) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'nOrden', label: 'N°Orden', render: (r: VentaCSF) => <span style={{ fontFamily: 'monospace', color: C.muted }}>#{r.nOrden}</span> },
    { key: 'nombreCliente', label: 'Cliente', render: (r: VentaCSF) => <span style={{ fontWeight: 600 }}>{r.nombreCliente}</span> },
    { key: 'tecnico', label: 'Técnico', render: (r: VentaCSF) => <Badge label={r.tecnico} color={COLOR} /> },
    { key: 'modeloEquipo', label: 'Modelo' },
    { key: 'tipoRepuesto', label: 'Repuesto' },
    { key: 'ticket', label: 'Ticket', align: 'right' as const, render: (r: VentaCSF) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{fmtARS(r.ticket)}</span> },
    { key: 'metodoPago', label: 'Método Pago', render: (r: VentaCSF) => <span style={{ fontSize: 11, color: C.muted }}>{r.metodoPago}</span> },
    {
      key: 'gananciaReal', label: 'Ganancia', align: 'right' as const,
      render: (r: VentaCSF) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.gananciaReal >= 0 ? C.green : C.red }}>{fmtARS(r.gananciaReal)}</span>
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader icon="💚" title="Ventas CSF (B2C)" desc="Ventas al consumidor final" color={COLOR} count={cantidadTotal} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Ventas" value={fmtARS(totalTickets)} color={COLOR} icon="💰" />
        <KPICard label="Ganancia Total" value={fmtARS(totalGanancia)} color={totalGanancia >= 0 ? C.green : C.red} icon="📈" />
        <KPICard label="Cantidad Ventas" value={String(cantidadTotal)} color={COLOR} icon="🧾" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <DataTable cols={cols} data={list} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay ventas registradas" />
      )}

      {modal && (
        <Modal title={modal === 'new' ? 'Nueva Venta CSF' : 'Editar Venta CSF'} onClose={() => setModal(false)} onSubmit={save} submitting={saving} submitColor={COLOR} width={660}>
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Técnico" required>
              <SearchableSelect value={form.tecnico} onChange={v => set('tecnico', v)} options={[...TECNICOS]} placeholder="Seleccionar técnico..." />
            </Field>
            <Field label="Cliente" required col={2}>
              <AutoCapInput value={form.nombreCliente} onChange={e => set('nombreCliente', e.target.value)} placeholder="Nombre del cliente" style={inputSt} />
            </Field>
            <Field label="Tipo de Servicio">
              <SearchableSelect value={form.tipoServicio} onChange={v => set('tipoServicio', v as TipoServicio)} options={SERVICIOS} placeholder="Buscar tipo de servicio..." />
            </Field>
            <Field label="Modelo Equipo">
              <SearchableSelect value={form.modeloEquipo} onChange={v => set('modeloEquipo', v)} options={MODELOS_DISPOSITIVOS} emptyOption="— Seleccionar modelo —" placeholder="Buscar modelo..." />
            </Field>
            <Field label="Proveedor">
              <AutoCapInput value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre del proveedor" style={inputSt} />
            </Field>
            <Field label="Tipo Repuesto">
              <AutoCapInput value={form.tipoRepuesto} onChange={e => set('tipoRepuesto', e.target.value)} placeholder="Ej: Pantalla OLED" style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Costos" color={C.orange} />

          <FormGrid cols={3}>
            <Field label="Costo Repuesto USD">
              <input type="number" min={0} value={form.costoRepuestoUSD} onChange={e => set('costoRepuestoUSD', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Precio Dólar">
              <input type="number" min={0} value={form.precioDolar} onChange={e => set('precioDolar', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Costo Repuesto $" calc>
              <input readOnly value={fmtARS(form.costoRepuestoPesos)} style={calcSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Ticket" color={C.green} />

          <FormGrid cols={2}>
            <Field label="Ticket (precio cobrado)" required>
              <input type="number" min={0} value={form.ticket} onChange={e => set('ticket', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Método de Pago">
              <SearchableSelect value={form.metodoPago} onChange={v => set('metodoPago', v as MetodoPago)} options={METODOS} placeholder="Buscar método..." />
            </Field>
            <Field label="Monto Neto Recibido" calc>
              <input readOnly value={fmtARS(form.montoNetoRecibido)} style={calcSt} />
            </Field>
            <Field label="Comisión MP (4.5%)" calc>
              <input readOnly value={fmtARS(form.comisionMP)} style={calcSt} />
            </Field>
            <Field label="IIBB (4%)" calc>
              <input readOnly value={fmtARS(form.iibb)} style={calcSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Comisiones" color={C.purple} />

          <FormGrid cols={2}>
            <Field label="Comisión Vendedora">
              <input type="number" min={0} value={form.comisionVendedora} onChange={e => set('comisionVendedora', parseFloat(e.target.value) || 0)} style={inputSt} />
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
