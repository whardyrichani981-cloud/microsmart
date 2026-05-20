'use client'
import { useState } from 'react'
import type { ClienteB2B, ClientePersona } from '@/lib/sistema-types'
import {
  useApi,
  C, Modal, Field, FormGrid, PageHeader, DataTable, Badge, KPICard,
  inputSt, selectSt, AutoCapInput,
} from './shared'

const COLOR = '#34d399'
const COLOR_B2C = '#60a5fa'
const COLOR_EMPRESA = '#a78bfa'

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributista', 'Consumidor Final', 'Exento'] as const

// ─── B2B (Gremio / Mayorista) ────────────────────────────────────────────────
type B2BForm = Omit<ClienteB2B, 'id' | 'createdAt'>
function emptyB2B(): B2BForm {
  return { nombre: '', empresa: '', telefono: '', mail: '', cuit: '', condicionIVA: 'Consumidor Final', direccion: '', notas: '' }
}

// ─── B2C (Personas) ───────────────────────────────────────────────────────────
type B2CForm = Omit<ClientePersona, 'id' | 'createdAt'>
function emptyB2C(): B2CForm {
  return { nombre: '', telefono: '', mail: '', dni: '', notas: '' }
}

export default function ClientesView() {
  const [tab, setTab] = useState<'personas' | 'gremio' | 'empresas'>('personas')

  const TABS = [
    { id: 'personas'  as const, label: '👤 Personas (B2C)',      color: COLOR_B2C     },
    { id: 'gremio'    as const, label: '🏢 Gremio / Mayorista',   color: COLOR         },
    { id: 'empresas'  as const, label: '🏛️ Empresas',             color: COLOR_EMPRESA },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ id, label, color }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 20px', border: 'none', borderRadius: '8px 8px 0 0',
              background: active ? `${color}18` : 'transparent',
              borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
              color: active ? color : C.muted,
              fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer',
            }}>{label}</button>
          )
        })}
      </div>

      {tab === 'personas' && <PersonasTab />}
      {tab === 'gremio'   && <EmpresasTab />}
      {tab === 'empresas' && <EmpresasPlaceholderTab />}
    </div>
  )
}

// ─── Personas Tab ─────────────────────────────────────────────────────────────
function PersonasTab() {
  const { data: clientes, loading, refresh } = useApi<ClientePersona[]>('/api/sistema/clientes-personas')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<B2CForm>(emptyB2C())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  const openNew = () => { setForm(emptyB2C()); setEditId(null); setModal('new') }
  const openEdit = (c: ClientePersona) => {
    const { id, createdAt, ...rest } = c
    setForm(rest); setEditId(id); setModal('edit')
  }
  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/clientes-personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/clientes-personas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh(); setModal(false)
    } finally { setSaving(false) }
  }
  const del = async (c: ClientePersona) => {
    await fetch('/api/sistema/clientes-personas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) })
    await refresh()
  }

  const list = clientes ?? []
  const filtered = search.trim()
    ? list.filter(c =>
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.telefono.includes(search) || c.dni.includes(search) || c.mail.toLowerCase().includes(search.toLowerCase()))
    : list

  const cols = [
    { key: 'nombre', label: 'Nombre', render: (r: ClientePersona) => <span style={{ fontWeight: 600 }}>{r.nombre}</span> },
    { key: 'telefono', label: 'Teléfono', render: (r: ClientePersona) => <span style={{ fontFamily: 'monospace' }}>{r.telefono || '—'}</span> },
    { key: 'mail', label: 'Mail', render: (r: ClientePersona) => <span style={{ fontSize: 11, color: C.muted }}>{r.mail || '—'}</span> },
    { key: 'dni', label: 'DNI', render: (r: ClientePersona) => <span style={{ fontFamily: 'monospace' }}>{r.dni || '—'}</span> },
  ]

  return (
    <>
      <PageHeader icon="👤" title="Clientes Personas" desc="Clientes individuales (B2C)" color={COLOR_B2C}
        count={list.length} onNew={openNew} newLabel="Nuevo cliente"
        extra={<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono, DNI..." style={{ ...inputSt, width: 280, flexShrink: 0 }} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total clientes" value={String(list.length)} color={COLOR_B2C} icon="👤" />
        <KPICard label="Con mail" value={String(list.filter(c => c.mail).length)} color={C.teal} icon="📧" />
        <KPICard label="Con DNI" value={String(list.filter(c => c.dni).length)} color={C.purple} icon="🪪" />
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
        : <DataTable cols={cols} data={filtered} onEdit={openEdit} onDelete={del} accentColor={COLOR_B2C} emptyMsg="No hay clientes personas registrados" />}

      {modal && (
        <Modal title={modal === 'new' ? 'Nuevo Cliente Persona' : 'Editar Cliente'} onClose={() => setModal(false)}
          onSubmit={save} submitting={saving} submitColor={COLOR_B2C} width={520}>
          <FormGrid cols={2}>
            <Field label="Nombre completo" required col={2}>
              <AutoCapInput value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan Pérez" style={inputSt} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11..." style={inputSt} />
            </Field>
            <Field label="DNI">
              <input value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="12345678" style={inputSt} />
            </Field>
            <Field label="Mail" col={2}>
              <input type="email" value={form.mail} onChange={e => set('mail', e.target.value)} placeholder="correo@mail.com" style={inputSt} />
            </Field>
            <Field label="Notas" col={2}>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </>
  )
}

// ─── Gremio / Mayorista Tab ──────────────────────────────────────────────────
function EmpresasTab() {
  const { data: clientes, loading, refresh } = useApi<ClienteB2B[]>('/api/sistema/clientes')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<B2BForm>(emptyB2B())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))
  const openNew = () => { setForm(emptyB2B()); setEditId(null); setModal('new') }
  const openEdit = (c: ClienteB2B) => {
    const { id, createdAt, ...rest } = c; setForm(rest); setEditId(id); setModal('edit')
  }
  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/clientes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh(); setModal(false)
    } finally { setSaving(false) }
  }
  const del = async (c: ClienteB2B) => {
    await fetch('/api/sistema/clientes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) })
    await refresh()
  }

  const list = clientes ?? []
  const filtered = search.trim()
    ? list.filter(c =>
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.empresa.toLowerCase().includes(search.toLowerCase()) ||
        c.telefono.includes(search) || c.cuit.includes(search))
    : list

  const cols = [
    { key: 'nombre', label: 'Nombre', render: (r: ClienteB2B) => <span style={{ fontWeight: 600 }}>{r.nombre}</span> },
    { key: 'empresa', label: 'Empresa', render: (r: ClienteB2B) => <span style={{ color: C.muted }}>{r.empresa || '—'}</span> },
    { key: 'telefono', label: 'Teléfono', render: (r: ClienteB2B) => <span style={{ fontFamily: 'monospace' }}>{r.telefono || '—'}</span> },
    { key: 'cuit', label: 'CUIT', render: (r: ClienteB2B) => <span style={{ fontFamily: 'monospace' }}>{r.cuit || '—'}</span> },
    {
      key: 'condicionIVA', label: 'Condición IVA',
      render: (r: ClienteB2B) => {
        const colorMap: Record<string, string> = { 'Responsable Inscripto': C.blue, 'Monotributista': C.purple, 'Consumidor Final': COLOR, 'Exento': C.muted }
        return <Badge label={r.condicionIVA} color={colorMap[r.condicionIVA] ?? C.muted} />
      }
    },
  ]

  return (
    <>
      <PageHeader icon="🏢" title="Gremio / Mayoristas" desc="Mayoristas del rubro y clientes B2B" color={COLOR}
        count={list.length} onNew={openNew} newLabel="Nuevo Gremio/Mayorista"
        extra={<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa, CUIT..." style={{ ...inputSt, width: 280, flexShrink: 0 }} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Gremio/May." value={String(list.length)} color={COLOR} icon="🏢" />
        <KPICard label="Con Empresa" value={String(list.filter(c => c.empresa).length)} color={C.blue} icon="🏷️" />
        <KPICard label="Resp. Inscriptos" value={String(list.filter(c => c.condicionIVA === 'Responsable Inscripto').length)} color={C.blue} icon="🔖" />
        <KPICard label="Monotributistas" value={String(list.filter(c => c.condicionIVA === 'Monotributista').length)} color={C.purple} icon="📋" />
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
        : <DataTable cols={cols} data={filtered} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay gremios/mayoristas registrados" />}

      {modal && (
        <Modal title={modal === 'new' ? 'Nuevo Gremio / Mayorista' : 'Editar Gremio / Mayorista'} onClose={() => setModal(false)}
          onSubmit={save} submitting={saving} submitColor={COLOR} width={600}>
          <FormGrid cols={2}>
            <Field label="Nombre" required col={2}>
              <AutoCapInput value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del contacto" style={inputSt} />
            </Field>
            <Field label="Empresa" col={2}>
              <AutoCapInput value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Razón social" style={inputSt} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11..." style={inputSt} />
            </Field>
            <Field label="Mail">
              <input type="email" value={form.mail} onChange={e => set('mail', e.target.value)} placeholder="correo@mail.com" style={inputSt} />
            </Field>
            <Field label="CUIT">
              <input value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="20-12345678-9" style={inputSt} />
            </Field>
            <Field label="Condición IVA">
              <select value={form.condicionIVA} onChange={e => set('condicionIVA', e.target.value)} style={selectSt}>
                {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Dirección" col={2}>
              <AutoCapInput value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, ciudad" style={inputSt} />
            </Field>
            <Field label="Notas" col={2}>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} placeholder="Observaciones..." style={{ ...inputSt, resize: 'vertical' }} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </>
  )
}

// ─── Empresas Placeholder Tab ─────────────────────────────────────────────────
function EmpresasPlaceholderTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(167,139,250,0.12)', border: '1.5px solid rgba(167,139,250,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
      }}>🏛️</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Empresas</div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 340, lineHeight: 1.6 }}>
          Esta sección está reservada para la gestión de clientes empresariales.
          Próximamente se agregarán lógicas, APIs y funcionalidades específicas para este segmento.
        </div>
      </div>
      <div style={{
        marginTop: 8, padding: '8px 20px', borderRadius: 999,
        background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)',
        fontSize: 12, fontWeight: 600, color: '#a78bfa',
      }}>
        🚧 En desarrollo
      </div>
    </div>
  )
}
