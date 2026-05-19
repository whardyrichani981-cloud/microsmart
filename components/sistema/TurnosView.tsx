'use client'
import { useState } from 'react'
import type { Turno, EstadoTurno, FuenteCliente } from '@/lib/sistema-types'
import {
  useApi, today,
  C, Modal, Field, FormGrid, PageHeader, DataTable, Badge, KPICard,
  inputSt, selectSt, AutoCapInput, SearchableSelect,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'

const COLOR = '#60a5fa'

const FUENTE_COLORS: Record<FuenteCliente, string> = {
  Instagram: '#a78bfa',
  Facebook: '#60a5fa',
  TikTok: '#1D1D1F',
  WhatsApp: '#4ade80',
  Referido: '#fb923c',
  Otro: 'var(--text-secondary)',
}

const EMPTY: Omit<Turno, 'id' | 'createdAt'> = {
  fecha: today(),
  hora: '',
  nombreCliente: '',
  reparacion: '',
  modeloEquipo: '',
  telefono: '',
  mail: '',
  fuente: 'Instagram',
  estado: 'Pendiente',
  notas: '',
}

type Tab = 'activos' | 'finalizados' | 'cancelados'

export default function TurnosView() {
  const { data: turnos, loading, refresh } = useApi<Turno[]>('/api/sistema/turnos')
  const [tab, setTab] = useState<Tab>('activos')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<Omit<Turno, 'id' | 'createdAt'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const list = turnos ?? []
  const activos     = list.filter(t => t.estado === 'Pendiente' || t.estado === 'Confirmado')
  const finalizados = list.filter(t => t.estado === 'Finalizado')
  const cancelados  = list.filter(t => t.estado === 'Cancelado')

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const openNew = () => {
    setForm({ ...EMPTY, fecha: today() })
    setEditId(null)
    setModal('new')
  }

  const openEdit = (t: Turno) => {
    const { id, createdAt, ...rest } = t
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/turnos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/turnos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (t: Turno) => {
    await fetch('/api/sistema/turnos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
    await refresh()
  }

  const cambiarEstado = async (t: Turno, estado: EstadoTurno) => {
    await fetch('/api/sistema/turnos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, estado }),
    })
    refresh()
  }

  const colsActivos = [
    { key: 'fecha', label: 'Fecha', render: (r: Turno) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'hora', label: 'Hora', render: (r: Turno) => <span style={{ fontFamily: 'monospace' }}>{r.hora}</span> },
    { key: 'nombreCliente', label: 'Cliente', render: (r: Turno) => <span style={{ fontWeight: 600 }}>{r.nombreCliente}</span> },
    { key: 'reparacion', label: 'Reparación' },
    { key: 'modeloEquipo', label: 'Modelo' },
    { key: 'telefono', label: 'Teléfono', render: (r: Turno) => <span style={{ fontFamily: 'monospace' }}>{r.telefono}</span> },
    { key: 'fuente', label: 'Fuente', render: (r: Turno) => <Badge label={r.fuente} color={FUENTE_COLORS[r.fuente] ?? C.muted} /> },
    {
      key: '_acciones', label: '',
      render: (r: Turno) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <ActionBtn label="✓ Finalizado" color="#4ade80" onClick={() => cambiarEstado(r, 'Finalizado')} />
          <ActionBtn label="✕ Cancelado" color="#f87171" onClick={() => cambiarEstado(r, 'Cancelado')} />
        </div>
      ),
    },
  ]

  const colsFinalizados = [
    { key: 'fecha', label: 'Fecha', render: (r: Turno) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'hora', label: 'Hora', render: (r: Turno) => <span style={{ fontFamily: 'monospace' }}>{r.hora}</span> },
    { key: 'nombreCliente', label: 'Cliente', render: (r: Turno) => <span style={{ fontWeight: 600 }}>{r.nombreCliente}</span> },
    { key: 'reparacion', label: 'Reparación' },
    { key: 'modeloEquipo', label: 'Modelo' },
    { key: 'telefono', label: 'Teléfono', render: (r: Turno) => <span style={{ fontFamily: 'monospace' }}>{r.telefono}</span> },
    { key: 'fuente', label: 'Fuente', render: (r: Turno) => <Badge label={r.fuente} color={FUENTE_COLORS[r.fuente] ?? C.muted} /> },
  ]

  const colsCancelados = [
    { key: 'fecha', label: 'Fecha', render: (r: Turno) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'nombreCliente', label: 'Cliente', render: (r: Turno) => <span style={{ fontWeight: 600 }}>{r.nombreCliente}</span> },
    { key: 'reparacion', label: 'Reparación' },
    { key: 'modeloEquipo', label: 'Modelo' },
    { key: 'telefono', label: 'Teléfono', render: (r: Turno) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: C.blue }}>{r.telefono}</span> },
    { key: 'fuente', label: 'Fuente', render: (r: Turno) => <Badge label={r.fuente} color={FUENTE_COLORS[r.fuente] ?? C.muted} /> },
    { key: 'notas', label: 'Notas', render: (r: Turno) => <span style={{ color: C.muted, fontSize: 11 }}>{r.notas || '—'}</span> },
    {
      key: '_reactivar', label: '',
      render: (r: Turno) => (
        <ActionBtn label="↩ Reagendar" color={COLOR} onClick={() => cambiarEstado(r, 'Pendiente')} />
      ),
    },
  ]

  const TABS: { id: Tab; label: string; count: number; color: string }[] = [
    { id: 'activos',     label: 'Activos',     count: activos.length,     color: COLOR },
    { id: 'finalizados', label: 'Finalizados',  count: finalizados.length, color: C.green },
    { id: 'cancelados',  label: 'Cancelados',   count: cancelados.length,  color: C.red },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon="📅"
        title="Turnos"
        desc="Gestión de turnos y citas"
        color={COLOR}
        count={activos.length}
        onNew={openNew}
        newLabel="Nuevo turno"
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Pendientes"  value={String(list.filter(t => t.estado === 'Pendiente').length)}  color={C.yellow} icon="⏳" />
        <KPICard label="Confirmados" value={String(list.filter(t => t.estado === 'Confirmado').length)} color={C.blue}   icon="✅" />
        <KPICard label="Finalizados" value={String(finalizados.length)} color={C.green} icon="🏁" />
        <KPICard label="Cancelados"  value={String(cancelados.length)}  color={C.red}   icon="❌" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none',
              color: tab === t.id ? t.color : C.muted,
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.12s',
            }}
          >
            {t.label} <span style={{ fontSize: 11, opacity: 0.8 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : tab === 'activos' ? (
        <DataTable cols={colsActivos} data={activos} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay turnos activos" />
      ) : tab === 'finalizados' ? (
        <DataTable cols={colsFinalizados} data={finalizados} onDelete={del} accentColor={C.green} emptyMsg="No hay turnos finalizados aún" />
      ) : (
        <DataTable cols={colsCancelados} data={cancelados} onDelete={del} accentColor={C.red} emptyMsg="No hay turnos cancelados" />
      )}

      {modal && (
        <Modal
          title={modal === 'new' ? 'Nuevo Turno' : 'Editar Turno'}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={COLOR}
          width={600}
        >
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Hora">
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Cliente" required col={2}>
              <AutoCapInput value={form.nombreCliente} onChange={e => set('nombreCliente', e.target.value)} placeholder="Nombre del cliente" style={inputSt} />
            </Field>
            <Field label="Reparación" required col={2}>
              <AutoCapInput value={form.reparacion} onChange={e => set('reparacion', e.target.value)} placeholder="Ej: Cambio de pantalla" style={inputSt} />
            </Field>
            <Field label="Modelo del Equipo">
              <SearchableSelect value={form.modeloEquipo} onChange={v => set('modeloEquipo', v)} options={MODELOS_DISPOSITIVOS} emptyOption="— Seleccionar modelo —" placeholder="Buscar modelo..." />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11..." style={inputSt} />
            </Field>
            <Field label="Mail" col={2}>
              <input type="email" value={form.mail} onChange={e => set('mail', e.target.value)} placeholder="cliente@mail.com" style={inputSt} />
            </Field>
            <Field label="Fuente" col={2}>
              <SearchableSelect value={form.fuente} onChange={v => set('fuente', v)} options={['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Referido', 'Otro']} placeholder="Buscar fuente..." />
            </Field>
            <Field label="Notas" col={2}>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} placeholder="Observaciones adicionales..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        padding: '4px 10px', borderRadius: 6,
        border: `1px solid ${color}55`,
        background: `${color}10`, color,
        cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}10`}
    >
      {label}
    </button>
  )
}
