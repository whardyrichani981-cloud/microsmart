'use client'
import { useState } from 'react'
import type { Proveedor } from '@/lib/sistema-types'
import {
  useApi, today,
  C, Modal, Field, FormGrid, PageHeader, DataTable, Badge, KPICard,
  inputSt, selectSt, AutoCapInput,
} from './shared'

const COLOR = '#60a5fa'

type FormState = Omit<Proveedor, 'id' | 'createdAt'>

function buildEmpty(): FormState {
  return {
    nombre: '',
    contacto: '',
    telefono: '',
    mail: '',
    web: '',
    condicionesPago: '',
    notas: '',
  }
}

export default function ProveedoresView() {
  const { data: proveedores, loading, refresh } = useApi<Proveedor[]>('/api/sistema/proveedores')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  const openNew = () => {
    setForm(buildEmpty())
    setEditId(null)
    setModal('new')
  }

  const openEdit = (p: Proveedor) => {
    const { id, createdAt, ...rest } = p
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch(`/api/sistema/proveedores/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (p: Proveedor) => {
    await fetch(`/api/sistema/proveedores/${p.id}`, { method: 'DELETE' })
    await refresh()
  }

  const list = proveedores ?? []
  const filtered = search.trim()
    ? list.filter(p =>
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        p.contacto.toLowerCase().includes(search.toLowerCase()) ||
        p.telefono.includes(search)
      )
    : list

  const cols = [
    { key: 'nombre', label: 'Nombre', render: (r: Proveedor) => <span style={{ fontWeight: 600 }}>{r.nombre}</span> },
    { key: 'contacto', label: 'Contacto', render: (r: Proveedor) => <span style={{ color: C.muted }}>{r.contacto || '—'}</span> },
    { key: 'telefono', label: 'Teléfono', render: (r: Proveedor) => <span style={{ fontFamily: 'monospace' }}>{r.telefono || '—'}</span> },
    { key: 'mail', label: 'Mail', render: (r: Proveedor) => <span style={{ fontSize: 11, color: C.muted }}>{r.mail || '—'}</span> },
    {
      key: 'web', label: 'Web',
      render: (r: Proveedor) => r.web
        ? <a href={r.web.startsWith('http') ? r.web : `https://${r.web}`} target="_blank" rel="noopener noreferrer" style={{ color: COLOR, fontSize: 11, textDecoration: 'none' }}>{r.web}</a>
        : <span style={{ color: C.dim }}>—</span>
    },
    {
      key: 'condicionesPago', label: 'Cond. de Pago',
      render: (r: Proveedor) => r.condicionesPago
        ? <Badge label={r.condicionesPago} color={COLOR} />
        : <span style={{ color: C.dim }}>—</span>
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        icon="🏭"
        title="Proveedores"
        desc="Directorio de proveedores de repuestos y accesorios"
        color={COLOR}
        count={list.length}
        onNew={openNew}
        newLabel="Nuevo proveedor"
        extra={
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, contacto..."
            style={{ ...inputSt, width: 240, flexShrink: 0 }}
          />
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Proveedores" value={String(list.length)} color={COLOR} icon="🏭" />
        <KPICard label="Con Mail" value={String(list.filter(p => p.mail).length)} color={COLOR} icon="📧" />
        <KPICard label="Con Web" value={String(list.filter(p => p.web).length)} color={COLOR} icon="🌐" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <DataTable cols={cols} data={filtered} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay proveedores registrados" />
      )}

      {modal && (
        <Modal
          title={modal === 'new' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitting={saving}
          submitColor={COLOR}
          width={600}
        >
          <FormGrid cols={2}>
            <Field label="Nombre" required col={2}>
              <AutoCapInput value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre o razón social" style={inputSt} />
            </Field>
            <Field label="Persona de Contacto" col={2}>
              <AutoCapInput value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder="Nombre del contacto" style={inputSt} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11..." style={inputSt} />
            </Field>
            <Field label="Mail">
              <input type="email" value={form.mail} onChange={e => set('mail', e.target.value)} placeholder="proveedor@mail.com" style={inputSt} />
            </Field>
            <Field label="Sitio Web" col={2}>
              <input value={form.web} onChange={e => set('web', e.target.value)} placeholder="https://proveedor.com" style={inputSt} />
            </Field>
            <Field label="Condiciones de Pago" col={2}>
              <AutoCapInput value={form.condicionesPago} onChange={e => set('condicionesPago', e.target.value)} placeholder="Ej: Transferencia / 30 días / Efectivo" style={inputSt} />
            </Field>
            <Field label="Notas" col={2}>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} placeholder="Observaciones, catálogos, condiciones especiales..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
