'use client'
import { useState, useEffect, useRef } from 'react'
import type { Turno, EstadoTurno, FuenteCliente, ClientePersona, ClienteB2B } from '@/lib/sistema-types'
import {
  useApi, today, fmtARS,
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

type Tab = 'activos' | 'finalizados' | 'cancelados' | 'eliminados'

// ── Input de hora: tipeo libre + picker nativo via ícono ─────────────────────
function HoraInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hiddenRef = useRef<HTMLInputElement>(null)

  // Formatea mientras el usuario escribe: "930" → "09:30", "14" → "14:", etc.
  const handleChange = (raw: string) => {
    // Eliminar todo lo que no sea número o ":"
    let v = raw.replace(/[^0-9:]/g, '')
    // Auto-insertar ":" después de 2 dígitos si el usuario no la puso
    if (v.length === 2 && !v.includes(':') && value.length < 2) v = v + ':'
    // Limitar a 5 chars "HH:MM"
    if (v.length > 5) v = v.slice(0, 5)
    onChange(v)
  }

  const handleBlur = (raw: string) => {
    // Normalizar al salir: "9:5" → "09:05"
    const match = raw.match(/^(\d{1,2}):?(\d{0,2})$/)
    if (!match) return
    const h = match[1].padStart(2, '0')
    const m = (match[2] || '00').padStart(2, '0')
    const hNum = parseInt(h), mNum = parseInt(m)
    if (hNum > 23 || mNum > 59) return
    onChange(`${h}:${m}`)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={e => handleBlur(e.target.value)}
        placeholder="09:30"
        maxLength={5}
        data-nocap
        style={{ ...inputSt, flex: 1, paddingRight: 36, fontFamily: 'monospace', letterSpacing: '0.05em' }}
      />
      {/* Botón reloj → abre picker nativo oculto */}
      <button
        type="button"
        onClick={() => hiddenRef.current?.showPicker?.()}
        title="Seleccionar con el reloj"
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: 'var(--text-secondary)', padding: 2, lineHeight: 1,
        }}
      >🕐</button>
      {/* Input nativo oculto — solo para el picker */}
      <input
        ref={hiddenRef}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
      />
    </div>
  )
}

// ── Selector de cliente con autocomplete + alta rápida ────────────────────────
interface ClientePickerProps {
  nombre: string
  telefono: string
  mail: string
  clientes: (ClientePersona | ClienteB2B)[]
  onSelect: (nombre: string, telefono: string, mail: string) => void
  onChange: (nombre: string) => void
}

function ClientePickerTurno({ nombre, telefono, mail, clientes, onSelect, onChange }: ClientePickerProps) {
  const [open, setOpen] = useState(false)
  const [showNuevo, setShowNuevo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTel, setNuevoTel] = useState('')
  const [nuevoMail, setNuevoMail] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const matches = nombre.trim().length >= 1
    ? clientes.filter(c => c.nombre.toLowerCase().includes(nombre.toLowerCase())).slice(0, 8)
    : clientes.slice(0, 8)

  const select = (c: ClientePersona | ClienteB2B) => {
    const tel = c.telefono ?? ''
    const m = 'mail' in c ? (c as ClientePersona).mail ?? '' : ''
    onSelect(c.nombre, tel, m)
    setOpen(false)
    setShowNuevo(false)
  }

  const crearCliente = async () => {
    if (!nuevoNombre.trim()) return
    setSaving(true)
    try {
      await fetch('/api/sistema/clientes-personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), telefono: nuevoTel, mail: nuevoMail, dni: '', notas: '' }),
      })
      onSelect(nuevoNombre.trim(), nuevoTel, nuevoMail)
      setShowNuevo(false)
      setNuevoNombre(''); setNuevoTel(''); setNuevoMail('')
    } finally { setSaving(false) }
  }

  return (
    <div ref={ref}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <AutoCapInput
            value={nombre}
            onChange={e => { onChange(e.target.value); setOpen(true); setShowNuevo(false) }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar cliente o escribir nombre..."
            style={inputSt}
            autoComplete="off"
          />
          {open && matches.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
              background: 'var(--surface)', border: `1px solid ${COLOR}`,
              borderRadius: 10, boxShadow: '0 8px 24px var(--shadow)', maxHeight: 220, overflowY: 'auto',
            }}>
              {matches.map(c => (
                <div key={c.id} onMouseDown={() => select(c)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 600, color: C.text }}>{c.nombre}</span>
                  {c.telefono && <span style={{ color: C.muted, marginLeft: 8, fontFamily: 'monospace' }}>{c.telefono}</span>}
                  {'empresa' in c && (c as ClienteB2B).empresa && (
                    <span style={{ color: C.muted, marginLeft: 8, fontSize: 11 }}>— {(c as ClienteB2B).empresa}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setShowNuevo(v => !v); setOpen(false) }}
          style={{
            padding: '0 14px', borderRadius: 8, flexShrink: 0,
            border: `1px solid ${COLOR}`,
            background: showNuevo ? COLOR : 'none',
            color: showNuevo ? '#fff' : COLOR,
            cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >+ Nuevo</button>
      </div>

      {/* Mini-form alta rápida */}
      {showNuevo && (
        <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: `1px solid ${COLOR}44` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✨ Registrar nuevo cliente
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Nombre *</div>
              <AutoCapInput value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre completo" style={inputSt} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Teléfono</div>
              <input value={nuevoTel} onChange={e => setNuevoTel(e.target.value)} placeholder="11 1234-5678" style={inputSt} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Email</div>
              <input type="email" value={nuevoMail} onChange={e => setNuevoMail(e.target.value)} placeholder="cliente@mail.com" style={inputSt} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={crearCliente} disabled={saving || !nuevoNombre.trim()}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: COLOR, color: '#fff', cursor: saving || !nuevoNombre.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12, opacity: !nuevoNombre.trim() ? 0.5 : 1 }}>
              {saving ? 'Guardando...' : '💾 Crear y usar'}
            </button>
            <button onClick={() => setShowNuevo(false)}
              style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TurnosView() {
  const { data: turnos, loading, refresh } = useApi<Turno[]>('/api/sistema/turnos')
  const [tab, setTab] = useState<Tab>('activos')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<Omit<Turno, 'id' | 'createdAt'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [clientes, setClientes] = useState<(ClientePersona | ClienteB2B)[]>([])

  // Cargar clientes al abrir el modal
  useEffect(() => {
    if (!modal) return
    Promise.all([
      fetch('/api/sistema/clientes-personas').then(r => r.json()).catch(() => []),
      fetch('/api/sistema/clientes').then(r => r.json()).catch(() => []),
    ]).then(([pers, b2b]) => {
      const personas: ClientePersona[] = Array.isArray(pers) ? pers : (pers.items ?? [])
      const empresas: ClienteB2B[]     = Array.isArray(b2b)  ? b2b  : (b2b.items  ?? [])
      setClientes([...personas, ...empresas])
    })
  }, [modal])

  const list = turnos ?? []
  const activos     = list.filter(t => t.estado === 'Pendiente' || t.estado === 'Confirmado')
  const finalizados = list.filter(t => t.estado === 'Finalizado')
  const cancelados  = list.filter(t => t.estado === 'Cancelado')
  const eliminados  = list.filter(t => t.estado === 'Eliminado')

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

  // Hard-delete real — solo desde la tab Eliminados
  const borrarDefinitivo = async (t: Turno) => {
    await fetch('/api/sistema/turnos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
    await refresh()
  }

  // Soft-delete: pasa a estado 'Eliminado' en vez de borrar
  const del = async (t: Turno) => {
    await fetch('/api/sistema/turnos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, estado: 'Eliminado' }),
    })
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

  // ── Turno → Orden ────────────────────────────────────────────────────────────
  const [confirmConvertir, setConfirmConvertir] = useState<Turno | null>(null)
  const [convirtiendo, setConvirtiendo]         = useState<string | null>(null)
  const [ordenCreada, setOrdenCreada]           = useState<{ nOrden: number; nombreCliente: string } | null>(null)

  const ejecutarConversion = async (turno: Turno) => {
    setConfirmConvertir(null)
    setConvirtiendo(turno.id)
    try {
      const modelo = (turno.modeloEquipo ?? '').toLowerCase()
      const categoriaDispositivo = modelo.includes('ipad') || modelo.includes('mac') || modelo.includes('watch') ? 'Mac/iPad' : 'iPhone'
      const body = {
        fecha: today(),
        tipo: 'Cliente final',
        estado: 'Entrada',
        prioridad: 'Normal',
        nombreCliente: turno.nombreCliente,
        telefonoCliente: turno.telefono ?? '',
        mailCliente: turno.mail ?? '',
        categoriaDispositivo,
        modeloEquipo: turno.modeloEquipo ?? '',
        imei: '',
        colorEquipo: '',
        descripcionFalla: turno.reparacion ?? '',
        accesorios: '',
        contrasena: '',
        tecnico: 'Ronald',
        fechaEntrega: '',
        garantia: false,
        diasGarantia: 90,
        tipoServicio: 'Otro',
        proveedor: '',
        tipoRepuesto: '',
        repuestosUsados: '',
        costoRepuestoUSD: 0,
        precioDolar: 0,
        costoRepuestoPesos: 0,
        costoRepuestos: 0,
        montoCobrado: 0,
        moneda: 'ARS $',
        equivARS: 0,
        metodoPago: 'Efectivo',
        comisionMP: 0,
        iibb: 0,
        comisionVendedora: 0,
        comisionTecnico: 0,
        gananciaReal: 0,
        presupuesto: 0,
        adelanto: 0,
        ordenItems: [],
        notas: `Generada desde turno del ${turno.fecha}${turno.hora ? ' a las ' + turno.hora : ''} · Fuente: ${turno.fuente}`,
        notas2: '',
        imagenes: [],
        historial: [],
        notasLista: [],
        createdAt: new Date().toISOString(),
      }

      const res = await fetch('/api/sistema/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const created = await res.json()

      // Marcar el turno como Finalizado
      await fetch('/api/sistema/turnos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...turno, estado: 'Finalizado' }),
      })

      await refresh()
      setOrdenCreada({ nOrden: created.nOrden, nombreCliente: turno.nombreCliente })
    } catch (e) {
      alert(`Error al crear la orden: ${String(e)}`)
    } finally {
      setConvirtiendo(null)
    }
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
          <button
            onClick={e => { e.stopPropagation(); setConfirmConvertir(r) }}
            disabled={convirtiendo === r.id}
            title="Convertir en orden de trabajo"
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none',
              background: 'rgba(129,140,248,0.15)', color: '#818cf8',
              cursor: convirtiendo === r.id ? 'not-allowed' : 'pointer',
              opacity: convirtiendo === r.id ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {convirtiendo === r.id ? '⏳' : '📋 Crear orden'}
          </button>
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

  const colsEliminados = [
    { key: 'fecha',         label: 'Fecha',      render: (r: Turno) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    { key: 'hora',          label: 'Hora',        render: (r: Turno) => <span style={{ fontFamily: 'monospace' }}>{r.hora || '—'}</span> },
    { key: 'nombreCliente', label: 'Cliente',     render: (r: Turno) => <span style={{ fontWeight: 600 }}>{r.nombreCliente}</span> },
    { key: 'reparacion',    label: 'Reparación' },
    { key: 'modeloEquipo',  label: 'Modelo' },
    { key: 'telefono',      label: 'Teléfono',    render: (r: Turno) => <span style={{ fontFamily: 'monospace', color: C.blue }}>{r.telefono || '—'}</span> },
    { key: 'fuente',        label: 'Fuente',      render: (r: Turno) => <Badge label={r.fuente} color={FUENTE_COLORS[r.fuente] ?? C.muted} /> },
    {
      key: '_acciones', label: '',
      render: (r: Turno) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <ActionBtn label="↩ Restaurar" color={COLOR} onClick={() => cambiarEstado(r, 'Pendiente')} />
          <ActionBtn label="🗑 Borrar" color={C.red} onClick={() => borrarDefinitivo(r)} />
        </div>
      ),
    },
  ]

  const TABS: { id: Tab; label: string; count: number; color: string; icon: string }[] = [
    { id: 'activos',     label: 'Activos',     count: activos.length,    color: COLOR,   icon: '📅' },
    { id: 'finalizados', label: 'Finalizados', count: finalizados.length, color: C.green, icon: '✅' },
    { id: 'cancelados',  label: 'Cancelados',  count: cancelados.length,  color: C.red,   icon: '❌' },
    { id: 'eliminados',  label: 'Eliminados',  count: eliminados.length,  color: C.muted, icon: '🗑' },
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
            <span>{t.icon} {t.label}</span>
            {t.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: tab === t.id ? 'rgba(255,255,255,0.25)' : `${t.color}22`,
                color: tab === t.id ? '#fff' : t.color,
                padding: '1px 6px', borderRadius: 8, marginLeft: 4,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : tab === 'activos' ? (
        <DataTable cols={colsActivos} data={activos} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay turnos activos" />
      ) : tab === 'finalizados' ? (
        <DataTable cols={colsFinalizados} data={finalizados} onDelete={del} accentColor={C.green} emptyMsg="No hay turnos finalizados aún" />
      ) : tab === 'cancelados' ? (
        <DataTable cols={colsCancelados} data={cancelados} onDelete={del} accentColor={C.red} emptyMsg="No hay turnos cancelados" />
      ) : (
        /* ── Tab Eliminados ── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ fontSize: 16 }}>🗑</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>Turnos eliminados</div>
              <div style={{ fontSize: 11, color: C.muted }}>Podés restaurar un turno a Pendiente o borrarlo definitivamente.</div>
            </div>
          </div>
          <DataTable cols={colsEliminados} data={eliminados} accentColor={C.muted} emptyMsg="No hay turnos eliminados" />
        </div>
      )}

      {/* ── Modal confirmación turno → orden ── */}
      {confirmConvertir && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setConfirmConvertir(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 420, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid #818cf8',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(129,140,248,0.15)',
          }}>
            <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(129,140,248,0.15)', border: '1px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📋</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Convertir turno en orden</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Se creará una orden de trabajo pre-completada</div>
              </div>
            </div>

            <div style={{ margin: '16px 24px', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Cliente</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{confirmConvertir.nombreCliente}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Teléfono</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{confirmConvertir.telefono || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Reparación</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmConvertir.reparacion || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Equipo</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmConvertir.modeloEquipo || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Turno</div>
                  <div style={{ fontWeight: 600, color: COLOR, fontFamily: 'monospace' }}>{confirmConvertir.fecha}{confirmConvertir.hora ? ' · ' + confirmConvertir.hora : ''}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Fuente</div>
                  <div style={{ fontWeight: 600, color: FUENTE_COLORS[confirmConvertir.fuente] ?? C.muted }}>{confirmConvertir.fuente}</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 24px 16px', lineHeight: 1.5 }}>
              La orden se creará en estado <strong style={{ color: '#818cf8' }}>Entrada</strong> con los datos del turno pre-cargados.
              El turno pasará a <strong style={{ color: C.green }}>Finalizado</strong> automáticamente.
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px' }}>
              <button onClick={() => setConfirmConvertir(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => ejecutarConversion(confirmConvertir)}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#818cf8', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                📋 Sí, crear orden
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal éxito turno → orden ── */}
      {ordenCreada && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
            onClick={() => setOrdenCreada(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 380, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid #818cf8',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(129,140,248,0.15)',
          }}>
            <div style={{ padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                ¡Orden creada con éxito!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Turno de <strong style={{ color: '#818cf8' }}>{ordenCreada.nombreCliente}</strong> convertido en
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#818cf8', fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: 8 }}>
                Orden #{String(ordenCreada.nOrden).padStart(4, '0')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                El turno fue marcado como <strong style={{ color: C.green }}>Finalizado</strong>.
                La orden está en estado <strong>Entrada</strong> en Órdenes de trabajo.
              </div>
              <button onClick={() => setOrdenCreada(null)}
                style={{ width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: '#818cf8', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Entendido
              </button>
            </div>
          </div>
        </>
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
              <HoraInput value={form.hora} onChange={v => set('hora', v)} />
            </Field>
            <Field label="Cliente" required col={2}>
              <ClientePickerTurno
                nombre={form.nombreCliente}
                telefono={form.telefono}
                mail={form.mail}
                clientes={clientes}
                onSelect={(nombre, telefono, mail) => setForm(f => ({ ...f, nombreCliente: nombre, telefono, mail }))}
                onChange={nombre => set('nombreCliente', nombre)}
              />
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
            {/* Indicador si el cliente fue seleccionado de la DB */}
            {form.telefono && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.green, marginTop: -4 }}>
                <span>✓</span>
                <span>Datos cargados: <strong>{form.nombreCliente}</strong> · {form.telefono}{form.mail ? ` · ${form.mail}` : ''}</span>
              </div>
            )}
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
