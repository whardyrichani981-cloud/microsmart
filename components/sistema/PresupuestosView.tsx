'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { Presupuesto, PresupuestoItem, Servicio, StockItem, ClientePersona, ClienteB2B } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, DataTable, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'
import { printPresupuesto } from '@/lib/print-presupuesto'
import { MODELOS_DISPOSITIVOS } from './modelos'

const COLOR = '#818cf8'
const TECNICOS = ['Ronald', 'Sharon', 'Saddi'] as const

const CLIENTE_TIPO_LABEL: Record<string, string> = {
  clienteFinal: 'Cliente Final',
  empresa: 'Empresa',
  gremio: 'Gremio',
}

const ITEM_TIPO_LABEL: Record<PresupuestoItem['tipo'], string> = {
  servicio: 'Servicio',
  repuesto: 'Repuesto / Producto',
  otro: 'Otro (manual)',
}

const ESTADO_COLOR: Record<Presupuesto['estado'], string> = {
  pendiente: C.orange,
  aceptado: C.green,
  rechazado: C.red,
  vencido: C.muted,
}

// Mapeo: qué tipo de servicio (en BD) corresponde a cada clienteTipo
function tipoServicioParaCliente(clienteTipo: string): string {
  return clienteTipo === 'gremio' ? 'Gremio' : 'Cliente final'
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

function addDays(fecha: string, days: number): string {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isVencido(fechaVenc: string): boolean { return today() > fechaVenc }

type ClienteTipo = Presupuesto['clienteTipo']
type FormState = Omit<Presupuesto, 'id' | 'createdAt' | 'nPresupuesto'>

function buildEmpty(): FormState {
  const fecha = today()
  return {
    fecha, vigenciaDias: 7, fechaVencimiento: addDays(fecha, 7),
    estado: 'pendiente', clienteTipo: 'clienteFinal',
    clienteNombre: '', clienteTelefono: '', clienteEmail: '', clienteCuit: '',
    equipoMarca: 'Apple', equipoModelo: '', equipoIMEI: '', equipoProblema: '',
    items: [], subtotal: 0, descuento: 0, total: 0,
    tecnico: 'Ronald', notas: '',
  }
}

function recalcTotals(f: FormState): FormState {
  const subtotal = f.items.reduce((s, i) => s + i.subtotal, 0)
  return { ...f, subtotal, total: Math.max(0, subtotal - f.descuento) }
}

// ── Autocomplete de clientes ──────────────────────────────────────────────────
interface ClienteAutoCompleteProps {
  value: string
  onChange: (val: string) => void
  onSelect: (nombre: string, telefono: string, email: string, cuit: string) => void
  clientes: (ClientePersona | ClienteB2B)[]
  clienteTipo: ClienteTipo
  placeholder?: string
}

function ClienteAutoComplete({ value, onChange, onSelect, clientes, clienteTipo, placeholder }: ClienteAutoCompleteProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Filtrar clientes según tipo
  const filtrados = clientes.filter(c => {
    if (clienteTipo === 'clienteFinal') return !('empresa' in c)
    return 'empresa' in c  // ClienteB2B para empresa/gremio
  })

  const matches = value.trim().length >= 1
    ? filtrados.filter(c => c.nombre.toLowerCase().includes(value.toLowerCase()))
    : filtrados.slice(0, 8)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const select = (c: ClientePersona | ClienteB2B) => {
    const email = 'mail' in c ? c.mail : ''
    const cuit = 'dni' in c ? c.dni : ('cuit' in c ? (c as ClienteB2B).cuit : '')
    onSelect(c.nombre, c.telefono, email, cuit)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Nombre del cliente'}
        style={inputSt}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface)', border: `1px solid ${COLOR}`,
          borderRadius: 10, boxShadow: '0 8px 24px var(--shadow)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {matches.map(c => (
            <div
              key={c.id}
              onMouseDown={() => select(c)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600, color: C.text }}>{c.nombre}</span>
              {c.telefono && <span style={{ color: C.muted, marginLeft: 8 }}>{c.telefono}</span>}
              {'empresa' in c && (c as ClienteB2B).empresa && (
                <span style={{ color: C.muted, marginLeft: 8, fontSize: 11 }}>— {(c as ClienteB2B).empresa}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: PresupuestoItem
  servicios: Servicio[]
  stockItems: StockItem[]
  clienteTipo: ClienteTipo
  onChange: (id: string, patch: Partial<PresupuestoItem>) => void
  onRemove: (id: string) => void
}

function ItemRow({ item, servicios, stockItems, clienteTipo, onChange, onRemove }: ItemRowProps) {
  const handleTipo = (tipo: PresupuestoItem['tipo']) => {
    onChange(item.id, { tipo, descripcion: '', refId: undefined, precioUnitario: 0, subtotal: 0 })
  }

  const handleServicio = (nombre: string) => {
    const s = servicios.find(x => x.nombre === nombre)
    if (!s) return
    onChange(item.id, { descripcion: s.nombre, refId: s.id, precioUnitario: s.precio, subtotal: item.cantidad * s.precio })
  }

  const handleRepuesto = (nombre: string) => {
    const s = stockItems.find(x => `${x.repuesto}${x.modelo ? ' ' + x.modelo : ''}` === nombre)
    if (!s) return
    onChange(item.id, { descripcion: nombre, refId: s.id, precioUnitario: s.costoUnitario, subtotal: item.cantidad * s.costoUnitario })
  }

  const handleCantidad = (cantidad: number) => {
    onChange(item.id, { cantidad, subtotal: cantidad * item.precioUnitario })
  }

  const handlePrecio = (precioUnitario: number) => {
    onChange(item.id, { precioUnitario, subtotal: item.cantidad * precioUnitario })
  }

  // Filtrar servicios según tipo de cliente
  const tipoServicio = tipoServicioParaCliente(clienteTipo)
  const serviciosFiltrados = servicios.filter(s => s.tipo === tipoServicio)
  const servicioNames = serviciosFiltrados.map(s => s.nombre)
  const stockNames = stockItems.map(s => `${s.repuesto}${s.modelo ? ' ' + s.modelo : ''}`)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr 72px 100px 105px 28px',
      gap: 6, alignItems: 'start', padding: '8px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Tipo */}
      <select
        value={item.tipo}
        onChange={e => handleTipo(e.target.value as PresupuestoItem['tipo'])}
        style={{ ...inputSt, fontSize: 11, padding: '5px 8px' }}
      >
        {(Object.keys(ITEM_TIPO_LABEL) as PresupuestoItem['tipo'][]).map(t => (
          <option key={t} value={t}>{ITEM_TIPO_LABEL[t]}</option>
        ))}
      </select>

      {/* Descripción / búsqueda */}
      {item.tipo === 'servicio' ? (
        <SearchableSelect
          value={item.descripcion}
          onChange={handleServicio}
          options={servicioNames}
          placeholder={`Buscar servicio (${tipoServicio})...`}
          emptyOption="— Seleccionar servicio —"
        />
      ) : item.tipo === 'repuesto' ? (
        <SearchableSelect
          value={item.descripcion}
          onChange={handleRepuesto}
          options={stockNames}
          placeholder="Buscar repuesto / producto..."
          emptyOption="— Seleccionar ítem —"
        />
      ) : (
        <AutoCapInput
          value={item.descripcion}
          onChange={e => onChange(item.id, { descripcion: e.target.value })}
          placeholder="Descripción del ítem"
          style={{ ...inputSt, fontSize: 12 }}
        />
      )}

      {/* Cantidad */}
      <input
        type="number" min={1} value={item.cantidad}
        onChange={e => handleCantidad(parseInt(e.target.value) || 1)}
        style={{ ...inputSt, fontSize: 12, textAlign: 'right' }}
      />

      {/* Precio unitario */}
      <input
        type="number" min={0} value={item.precioUnitario}
        onChange={e => handlePrecio(parseFloat(e.target.value) || 0)}
        style={{ ...inputSt, fontSize: 12, textAlign: 'right' }}
      />

      {/* Subtotal */}
      <input readOnly value={fmtARS(item.subtotal)} style={{ ...calcSt, fontSize: 12, textAlign: 'right' }} />

      {/* Eliminar */}
      <button
        onClick={() => onRemove(item.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 18, padding: 0, lineHeight: 1 }}
      >×</button>
    </div>
  )
}

// ── Mini form nuevo cliente ────────────────────────────────────────────────────
interface NuevoClienteFormProps {
  clienteTipo: ClienteTipo
  nombreInicial?: string
  onCreated: (nombre: string, telefono: string, email: string, cuit: string) => void
  onCancel: () => void
}

function NuevoClienteForm({ clienteTipo, nombreInicial, onCreated, onCancel }: NuevoClienteFormProps) {
  const [nombre, setNombre] = useState(nombreInicial ?? '')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cuit, setCuit] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [saving, setSaving] = useState(false)

  const esPersona = clienteTipo === 'clienteFinal'

  const crear = async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    try {
      if (esPersona) {
        const res = await fetch('/api/sistema/clientes-personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombre.trim(), telefono, mail: email, dni: cuit, notas: '' }),
        })
        await res.json()
      } else {
        const res = await fetch('/api/sistema/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombre.trim(), empresa, telefono, mail: email, cuit, condicionIVA: '', direccion: '', notas: '' }),
        })
        await res.json()
      }
      onCreated(nombre.trim(), telefono, email, cuit)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${COLOR}`, borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        ✨ Nuevo {CLIENTE_TIPO_LABEL[clienteTipo]}
      </div>
      <FormGrid cols={2}>
        <Field label="Nombre *">
          <AutoCapInput value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" style={inputSt} />
        </Field>
        {!esPersona && (
          <Field label="Empresa / Razón social">
            <AutoCapInput value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre de la empresa" style={inputSt} />
          </Field>
        )}
        <Field label="Teléfono">
          <input value={telefono} onChange={e => setTelefono(e.target.value)} style={inputSt} placeholder="11 1234-5678" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputSt} placeholder="cliente@email.com" />
        </Field>
        <Field label={esPersona ? 'DNI' : 'CUIT'}>
          <input value={cuit} onChange={e => setCuit(e.target.value)} style={inputSt} placeholder={esPersona ? '12345678' : 'XX-XXXXXXXX-X'} />
        </Field>
      </FormGrid>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={crear} disabled={saving}
          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: COLOR, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
        >
          {saving ? 'Guardando...' : '💾 Crear cliente'}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────────
interface ApiResponse { items: Presupuesto[]; nextNum: number }

export default function PresupuestosView() {
  const { data, loading, refresh } = useApi<ApiResponse>('/api/sistema/presupuestos')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [form, setForm] = useState<FormState>(buildEmpty())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterEstado, setFilterEstado] = useState<string>('todos')

  const [servicios, setServicios] = useState<Servicio[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [clientes, setClientes] = useState<(ClientePersona | ClienteB2B)[]>([])
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)

  useEffect(() => {
    if (!modal) return
    Promise.all([
      fetch('/api/sistema/servicios').then(r => r.json()),
      fetch('/api/sistema/stock').then(r => r.json()),
      fetch('/api/sistema/clientes-personas').then(r => r.json()),
      fetch('/api/sistema/clientes').then(r => r.json()),
    ]).then(([svcs, stk, pers, b2b]) => {
      setServicios(Array.isArray(svcs) ? svcs : (svcs.items ?? []))
      setStockItems(stk?.items ?? [])
      const personas: ClientePersona[] = Array.isArray(pers) ? pers : (pers.items ?? [])
      const empresas: ClienteB2B[] = Array.isArray(b2b) ? b2b : (b2b.items ?? [])
      setClientes([...personas, ...empresas])
    }).catch(() => {})
  }, [modal])

  const setF = (updates: Partial<FormState>) => {
    setForm(prev => recalcTotals({ ...prev, ...updates }))
  }

  // Al cambiar tipo de cliente, limpiar ítems de servicio (ya que cambian los disponibles)
  const setClienteTipo = (tipo: ClienteTipo) => {
    setF({
      clienteTipo: tipo,
      items: form.items.map(i =>
        i.tipo === 'servicio' ? { ...i, descripcion: '', refId: undefined, precioUnitario: 0, subtotal: 0 } : i
      ),
    })
    setShowNuevoCliente(false)
  }

  const openNew = () => { setForm(buildEmpty()); setEditId(null); setShowNuevoCliente(false); setModal('new') }
  const openEdit = (v: Presupuesto) => {
    const { id, createdAt, nPresupuesto, ...rest } = v
    setForm(rest); setEditId(id); setShowNuevoCliente(false); setModal('edit')
  }

  const save = async () => {
    if (!form.clienteNombre.trim()) return alert('El nombre del cliente es obligatorio')
    if (form.items.length === 0) return alert('Agregá al menos un ítem al presupuesto')
    setSaving(true)
    try {
      await fetch('/api/sistema/presupuestos', {
        method: modal === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modal === 'new'
          ? { ...form, createdAt: new Date().toISOString() }
          : { id: editId, ...form }),
      })
      await refresh(); setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (v: Presupuesto) => {
    await fetch('/api/sistema/presupuestos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) })
    await refresh()
  }

  // ── Convertir presupuesto en orden ───────────────────────────────────────────
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null)
  const [ordenCreada, setOrdenCreada] = useState<{ nOrden: number; nPresupuesto: number } | null>(null)
  const [confirmConvertir, setConfirmConvertir] = useState<Presupuesto | null>(null)
  const [confirmRechazar, setConfirmRechazar] = useState<Presupuesto | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)

  const convertirEnOrden = async (pres: Presupuesto) => {
    setConfirmConvertir(pres)
  }

  const ejecutarConversion = async (pres: Presupuesto) => {
    setConfirmConvertir(null)
    setConvirtiendo(pres.id)
    try {
      // Mapear ítems de presupuesto → ordenItems
      const ordenItems = pres.items.map(item => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        tipo: item.tipo === 'servicio' ? 'servicio' : item.tipo === 'repuesto' ? 'producto' : 'manual',
        refId: item.refId ?? '',
        nombre: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
      }))

      // Detectar categoría del dispositivo
      const modelo = (pres.equipoModelo ?? '').toLowerCase()
      const categoriaDispositivo = modelo.includes('ipad') || modelo.includes('mac') || modelo.includes('watch') ? 'Mac/iPad' : 'iPhone'

      // Mapear tipo de cliente
      const tipo = pres.clienteTipo === 'gremio' ? 'Gremio' : 'Cliente final'

      const body = {
        fecha: today(),
        tipo,
        estado: 'Entrada',
        prioridad: 'Normal',
        nombreCliente: pres.clienteNombre,
        telefonoCliente: pres.clienteTelefono ?? '',
        mailCliente: pres.clienteEmail ?? '',
        categoriaDispositivo,
        modeloEquipo: pres.equipoModelo ?? '',
        imei: pres.equipoIMEI ?? '',
        colorEquipo: '',
        descripcionFalla: pres.equipoProblema ?? '',
        accesorios: '',
        contrasena: '',
        tecnico: pres.tecnico ?? 'Ronald',
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
        montoCobrado: pres.total,
        moneda: 'ARS $',
        equivARS: pres.total,
        metodoPago: 'Efectivo',
        comisionMP: 0,
        iibb: 0,
        comisionVendedora: 0,
        comisionTecnico: 0,
        gananciaReal: 0,
        presupuesto: pres.total,
        adelanto: 0,
        nPresupuestoRef: pres.nPresupuesto,
        ordenItems,
        notas: `Generada desde presupuesto #${String(pres.nPresupuesto).padStart(4,'0')}`,
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
      // Marcar el presupuesto como aceptado si no lo estaba
      if (pres.estado !== 'aceptado') {
        await fetch('/api/sistema/presupuestos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pres.id, estado: 'aceptado' }),
        })
      }
      await refresh()
      setOrdenCreada({ nOrden: created.nOrden, nPresupuesto: pres.nPresupuesto })
    } catch (e) {
      setErrorMsg(`Error al crear la orden: ${String(e)}`)
    } finally {
      setConvirtiendo(null)
    }
  }

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const ejecutarRechazo = async (pres: Presupuesto) => {
    setConfirmRechazar(null)
    setRechazando(pres.id)
    try {
      await fetch('/api/sistema/presupuestos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pres.id, estado: 'rechazado' }),
      })
      await refresh()
    } finally {
      setRechazando(null)
    }
  }

  const ejecutarAceptar = async (pres: Presupuesto) => {
    await fetch('/api/sistema/presupuestos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pres.id, estado: 'aceptado' }),
    })
    await refresh()
  }

  // ── Auto-marcar vencidos en la BD cuando se carga el listado ────────────────
  useEffect(() => {
    if (!data?.items) return
    const vencidos = data.items.filter(v => v.estado === 'pendiente' && isVencido(v.fechaVencimiento))
    if (vencidos.length === 0) return
    // Actualizar en paralelo sin bloquear UI
    Promise.all(vencidos.map(v =>
      fetch('/api/sistema/presupuestos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, estado: 'vencido' }),
      })
    )).then(() => refresh()).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const changeEstado = async (v: Presupuesto, estado: Presupuesto['estado']) => {
    await fetch('/api/sistema/presupuestos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, estado }) })
    await refresh()
  }

  const addItem = () => {
    setForm(prev => recalcTotals({ ...prev, items: [...prev.items, { id: uid(), descripcion: '', tipo: 'servicio', cantidad: 1, precioUnitario: 0, subtotal: 0 }] }))
  }

  const updateItem = useCallback((id: string, patch: Partial<PresupuestoItem>) => {
    setForm(prev => recalcTotals({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, ...patch } : i) }))
  }, [])

  const removeItem = useCallback((id: string) => {
    setForm(prev => recalcTotals({ ...prev, items: prev.items.filter(i => i.id !== id) }))
  }, [])

  const raw = (data?.items ?? []).map(v => ({
    ...v,
    estado: isVencido(v.fechaVencimiento) && v.estado === 'pendiente' ? 'vencido' as const : v.estado,
  }))
  const list = filterEstado === 'todos' ? raw : raw.filter(v => v.estado === filterEstado)
  const totalPresupuestado = raw.reduce((s, v) => s + v.total, 0)
  const countPorEstado = {
    todos: raw.length,
    pendiente: raw.filter(v => v.estado === 'pendiente').length,
    aceptado: raw.filter(v => v.estado === 'aceptado').length,
    rechazado: raw.filter(v => v.estado === 'rechazado').length,
    vencido: raw.filter(v => v.estado === 'vencido').length,
  }

  const TABS = [
    { key: 'todos',     label: 'Todos',      icon: '📋', color: COLOR },
    { key: 'pendiente', label: 'Pendientes',  icon: '⏳', color: C.orange },
    { key: 'aceptado',  label: 'Aceptados',   icon: '✅', color: C.green },
    { key: 'rechazado', label: 'Rechazados',  icon: '❌', color: C.red },
    { key: 'vencido',   label: 'Vencidos',    icon: '⌛', color: C.muted },
  ] as const

  const cols = [
    { key: 'nPresupuesto', label: 'N°', render: (r: Presupuesto) => <span style={{ fontFamily: 'monospace', color: C.muted }}>#{String(r.nPresupuesto).padStart(4, '0')}</span> },
    { key: 'fecha', label: 'Fecha', render: (r: Presupuesto) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.fecha}</span> },
    {
      key: 'clienteNombre', label: 'Cliente',
      render: (r: Presupuesto) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.clienteNombre}</span>
          <span style={{ marginLeft: 6, fontSize: 10, color: C.muted }}>({CLIENTE_TIPO_LABEL[r.clienteTipo] ?? r.clienteTipo})</span>
        </div>
      )
    },
    { key: 'equipoModelo', label: 'Equipo', render: (r: Presupuesto) => <span style={{ fontSize: 11, color: C.muted }}>{r.equipoModelo || '—'}</span> },
    {
      key: 'fechaVencimiento', label: 'Vence',
      render: (r: Presupuesto) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: isVencido(r.fechaVencimiento) ? C.red : C.muted }}>{r.fechaVencimiento}</span>
    },
    { key: 'total', label: 'Total', align: 'right' as const, render: (r: Presupuesto) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtARS(r.total)}</span> },
    {
      key: 'estado', label: 'Estado',
      render: (r: Presupuesto) => {
        const estado = isVencido(r.fechaVencimiento) && r.estado === 'pendiente' ? 'vencido' : r.estado
        const col = ESTADO_COLOR[estado as Presupuesto['estado']]
        const labels: Record<string, string> = { pendiente: '⏳ Pendiente', aceptado: '✅ Aceptado', rechazado: '❌ Rechazado', vencido: '⌛ Vencido' }
        return (
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
            background: `${col}20`, border: `1px solid ${col}55`,
            color: col, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {labels[estado] ?? estado}
          </span>
        )
      }
    },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader icon="📋" title="Presupuestos" desc="Cotizaciones formales para clientes" color={COLOR} count={raw.length} onNew={openNew} newLabel="Nuevo presupuesto" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Total Presupuestado" value={fmtARS(totalPresupuestado)} color={COLOR} icon="💰" />
        <KPICard label="Pendientes" value={String(countPorEstado.pendiente)} color={C.orange} icon="⏳" />
        <KPICard label="Aceptados" value={String(countPorEstado.aceptado)} color={C.green} icon="✅" />
        <KPICard label="Rechazados" value={String(countPorEstado.rechazado)} color={C.red} icon="❌" />
      </div>

      {/* ── Pestañas de estado ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(tab => {
          const active = filterEstado === tab.key
          const count = countPorEstado[tab.key]
          return (
            <button key={tab.key} onClick={() => setFilterEstado(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10,
              border: active ? 'none' : `1px solid var(--border)`,
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: active ? tab.color : 'var(--surface)',
              color: active ? '#fff' : 'var(--text-secondary)',
              transition: 'all .15s',
              boxShadow: active ? `0 2px 8px ${tab.color}44` : 'none',
            }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : `${tab.color}22`,
                  color: active ? '#fff' : tab.color,
                  borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800, minWidth: 20, textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div> : (
        <DataTable cols={cols} data={list} onEdit={openEdit} onDelete={del} accentColor={COLOR} emptyMsg="No hay presupuestos registrados"
          extraActions={(row: Presupuesto) => (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
              {/* Aceptar — solo si está pendiente */}
              {row.estado === 'pendiente' && (
                <button
                  onClick={e => { e.stopPropagation(); ejecutarAceptar(row) }}
                  title="Marcar como aceptado"
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700, border: 'none', background: `${C.green}22`, color: C.green, transition: 'all 0.15s' }}
                >✅ Aceptar</button>
              )}
              {/* Rechazar — si no está rechazado ni vencido */}
              {row.estado !== 'rechazado' && row.estado !== 'vencido' && (
                <button
                  onClick={e => { e.stopPropagation(); setConfirmRechazar(row) }}
                  disabled={rechazando === row.id}
                  title="Marcar como rechazado por el cliente"
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: rechazando === row.id ? 'not-allowed' : 'pointer', fontWeight: 700, border: 'none', background: `${C.red}22`, color: C.red, opacity: rechazando === row.id ? 0.6 : 1, transition: 'all 0.15s' }}
                >❌ Rechazar</button>
              )}
              {/* Crear orden — si no está rechazado ni vencido */}
              {row.estado !== 'rechazado' && row.estado !== 'vencido' && (
                <button
                  onClick={e => { e.stopPropagation(); convertirEnOrden(row) }}
                  disabled={convirtiendo === row.id}
                  title="Convertir en orden de trabajo"
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: convirtiendo === row.id ? 'not-allowed' : 'pointer', fontWeight: 700, border: 'none', background: row.estado === 'aceptado' ? COLOR : 'rgba(129,140,248,0.15)', color: row.estado === 'aceptado' ? '#fff' : COLOR, opacity: convirtiendo === row.id ? 0.6 : 1, transition: 'all 0.15s' }}
                >
                  {convirtiendo === row.id ? '⏳' : '📋 Crear orden'}
                </button>
              )}
              {/* Imprimir — siempre */}
              <button onClick={e => { e.stopPropagation(); printPresupuesto(row) }}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLOR}`, background: 'none', color: COLOR, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                🖨 Imprimir
              </button>
            </div>
          )}
        />
      )}

      {/* ── Modal confirmación rechazar ── */}
      {confirmRechazar && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setConfirmRechazar(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 400, borderRadius: 16,
            background: 'var(--surface)', border: `1px solid rgba(239,68,68,0.5)`,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>❌</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                  Rechazar presupuesto
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  El cliente no aceptó esta cotización
                </div>
              </div>
            </div>

            <div style={{ margin: '16px 24px', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Presupuesto</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: C.red, fontSize: 14 }}>
                    #{String(confirmRechazar.nPresupuesto).padStart(4,'0')}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                    {fmtARS(confirmRechazar.total)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Cliente</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmRechazar.clienteNombre}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Equipo</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmRechazar.equipoModelo || '—'}</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 24px 16px', lineHeight: 1.5 }}>
              El presupuesto pasará a <strong style={{ color: C.red }}>Rechazado</strong> y no podrá convertirse en orden.
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px' }}>
              <button onClick={() => setConfirmRechazar(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => ejecutarRechazo(confirmRechazar)}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ❌ Sí, rechazar presupuesto
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal confirmación convertir ── */}
      {confirmConvertir && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setConfirmConvertir(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 420, borderRadius: 16,
            background: 'var(--surface)', border: `1px solid ${COLOR}`,
            boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px ${COLOR}22`,
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `rgba(129,140,248,0.15)`, border: `1px solid ${COLOR}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>📋</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                  Convertir en orden de trabajo
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Esta acción generará una nueva orden desde el presupuesto
                </div>
              </div>
            </div>

            {/* Detalle del presupuesto */}
            <div style={{ margin: '16px 24px', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Presupuesto</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: COLOR, fontSize: 14 }}>
                    #{String(confirmConvertir.nPresupuesto).padStart(4,'0')}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                    {fmtARS(confirmConvertir.total)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Cliente</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmConvertir.clienteNombre}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Equipo</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{confirmConvertir.equipoModelo || '—'}</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 24px 16px', lineHeight: 1.5 }}>
              Se creará la orden en estado <strong style={{ color: COLOR }}>Entrada</strong> con todos los datos e ítems pre-cargados.
              {confirmConvertir.estado !== 'aceptado' && <> El presupuesto pasará a <strong style={{ color: 'var(--text-primary)' }}>Aceptado</strong> automáticamente.</>}
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px' }}>
              <button
                onClick={() => setConfirmConvertir(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => ejecutarConversion(confirmConvertir)}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: COLOR, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                📋 Sí, crear orden
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal de error ── */}
      {errorMsg && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setErrorMsg(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 360, borderRadius: 14,
            background: 'var(--surface)', border: `1px solid rgba(239,68,68,0.5)`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)', padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>Error al crear la orden</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)}
              style={{ padding: '9px 28px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </>
      )}

      {/* ── Modal de éxito ── */}
      {ordenCreada && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
            onClick={() => setOrdenCreada(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 10000, width: 380, borderRadius: 16,
            background: 'var(--surface)', border: `1px solid ${COLOR}`,
            boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px ${COLOR}22`, overflow: 'hidden',
          }}>
            <div style={{ padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                ¡Orden creada con éxito!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Presupuesto <strong style={{ color: COLOR }}>#{String(ordenCreada.nPresupuesto).padStart(4,'0')}</strong> convertido en
              </div>
              <div style={{
                fontSize: 28, fontWeight: 900, color: COLOR,
                fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: 20,
              }}>
                Orden #{String(ordenCreada.nOrden).padStart(4,'0')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                La orden fue creada en estado <strong>Entrada</strong> con todos los datos del presupuesto pre-cargados.
                Podés verla en el módulo de Órdenes de trabajo.
              </div>
              <button
                onClick={() => setOrdenCreada(null)}
                style={{
                  width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                  background: COLOR, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >Entendido</button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {modal && (
        <Modal title={modal === 'new' ? 'Nuevo Presupuesto' : 'Editar Presupuesto'} onClose={() => setModal(false)} onSubmit={save} submitting={saving} submitColor={COLOR} width={740}>

          {/* Fecha y vigencia */}
          <FormGrid cols={3}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha}
                onChange={e => setF({ fecha: e.target.value, fechaVencimiento: addDays(e.target.value, form.vigenciaDias) })}
                style={inputSt} />
            </Field>
            <Field label="Validez (días)">
              <input type="number" min={1} max={365} value={form.vigenciaDias}
                onChange={e => { const d = parseInt(e.target.value) || 7; setF({ vigenciaDias: d, fechaVencimiento: addDays(form.fecha, d) }) }}
                style={inputSt} />
            </Field>
            <Field label="Vence el" calc>
              <input readOnly value={form.fechaVencimiento} style={calcSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Cliente" color={COLOR} />

          <FormGrid cols={2}>
            {/* Tipo */}
            <Field label="Tipo de cliente">
              <SearchableSelect
                value={form.clienteTipo}
                onChange={v => setClienteTipo(v as ClienteTipo)}
                options={['clienteFinal', 'empresa', 'gremio']}
                labelMap={CLIENTE_TIPO_LABEL}
                placeholder="Tipo..."
              />
            </Field>
            {/* Técnico */}
            <Field label="Técnico">
              <SearchableSelect value={form.tecnico ?? ''} onChange={v => setF({ tecnico: v })} options={[...TECNICOS]} placeholder="Técnico..." />
            </Field>

            {/* Nombre con autocomplete */}
            <Field label="Nombre / Razón social" required col={2}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <ClienteAutoComplete
                    value={form.clienteNombre}
                    onChange={v => setF({ clienteNombre: v })}
                    onSelect={(nombre, telefono, email, cuit) => {
                      setF({ clienteNombre: nombre, clienteTelefono: telefono, clienteEmail: email, clienteCuit: cuit })
                      setShowNuevoCliente(false)
                    }}
                    clientes={clientes}
                    clienteTipo={form.clienteTipo}
                    placeholder={`Buscar ${CLIENTE_TIPO_LABEL[form.clienteTipo].toLowerCase()} o escribir nuevo...`}
                  />
                </div>
                <button
                  onClick={() => setShowNuevoCliente(v => !v)}
                  style={{
                    padding: '0 14px', borderRadius: 8,
                    border: `1px solid ${COLOR}`,
                    background: showNuevoCliente ? COLOR : 'none',
                    color: showNuevoCliente ? '#fff' : COLOR,
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  + Nuevo
                </button>
              </div>
              {showNuevoCliente && (
                <NuevoClienteForm
                  clienteTipo={form.clienteTipo}
                  nombreInicial={form.clienteNombre}
                  onCreated={(nombre, telefono, email, cuit) => {
                    setF({ clienteNombre: nombre, clienteTelefono: telefono, clienteEmail: email, clienteCuit: cuit })
                    setClientes(prev => [...prev, { id: uid(), nombre, telefono, mail: email, dni: cuit, notas: '', createdAt: new Date().toISOString() } as ClientePersona])
                    setShowNuevoCliente(false)
                  }}
                  onCancel={() => setShowNuevoCliente(false)}
                />
              )}
            </Field>

            <Field label="Teléfono">
              <input type="tel" value={form.clienteTelefono ?? ''} onChange={e => setF({ clienteTelefono: e.target.value })} style={inputSt} placeholder="Ej: 11 1234-5678" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.clienteEmail ?? ''} onChange={e => setF({ clienteEmail: e.target.value })} style={inputSt} placeholder="cliente@email.com" />
            </Field>
            <Field label="CUIT / DNI">
              <input value={form.clienteCuit ?? ''} onChange={e => setF({ clienteCuit: e.target.value })} style={inputSt} placeholder="XX-XXXXXXXX-X" />
            </Field>
          </FormGrid>

          <SectionDivider label="Equipo" color={C.orange} />

          <FormGrid cols={3}>
            <Field label="Marca">
              <AutoCapInput value={form.equipoMarca ?? ''} onChange={e => setF({ equipoMarca: e.target.value })} placeholder="Apple" style={inputSt} />
            </Field>
            <Field label="Modelo" col={2}>
              <SearchableSelect value={form.equipoModelo ?? ''} onChange={v => setF({ equipoModelo: v })} options={MODELOS_DISPOSITIVOS} emptyOption="— Seleccionar modelo —" placeholder="Buscar modelo..." />
            </Field>
            <Field label="IMEI / Serie">
              <input value={form.equipoIMEI ?? ''} onChange={e => setF({ equipoIMEI: e.target.value })} style={inputSt} placeholder="15 dígitos" />
            </Field>
            <Field label="Problema / Síntoma" col={2}>
              <AutoCapInput value={form.equipoProblema ?? ''} onChange={e => setF({ equipoProblema: e.target.value })} placeholder="Ej: Pantalla rota, no carga..." style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Ítems del presupuesto" color={C.green} />

          {/* Indicador de filtro de servicios */}
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, padding: '4px 0' }}>
            💡 Los servicios mostrados corresponden a <strong style={{ color: COLOR }}>{CLIENTE_TIPO_LABEL[form.clienteTipo]}</strong>
            {form.clienteTipo !== 'gremio' ? ' y Empresa (misma lista)' : ''}
          </div>

          {/* Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 72px 100px 105px 28px', gap: 6, padding: '4px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.muted, borderBottom: `1px solid ${C.border}` }}>
            <span>Tipo</span><span>Descripción</span>
            <span style={{ textAlign: 'right' }}>Cant.</span>
            <span style={{ textAlign: 'right' }}>Precio</span>
            <span style={{ textAlign: 'right' }}>Subtotal</span>
            <span />
          </div>

          {form.items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: C.muted, fontSize: 12 }}>
              No hay ítems. Usá el botón de abajo para agregar servicios o repuestos.
            </div>
          )}

          {form.items.map(item => (
            <ItemRow key={item.id} item={item} servicios={servicios} stockItems={stockItems} clienteTipo={form.clienteTipo} onChange={updateItem} onRemove={removeItem} />
          ))}

          <button onClick={addItem}
            style={{ marginTop: 8, width: '100%', padding: '8px 0', border: `1px dashed ${COLOR}`, borderRadius: 8, background: 'none', color: COLOR, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Agregar ítem
          </button>

          <SectionDivider label="Totales" color={C.purple} />

          <FormGrid cols={3}>
            <Field label="Subtotal" calc>
              <input readOnly value={fmtARS(form.subtotal)} style={calcSt} />
            </Field>
            <Field label="Descuento ($)">
              <input type="number" min={0} value={form.descuento} onChange={e => setF({ descuento: parseFloat(e.target.value) || 0 })} style={inputSt} />
            </Field>
            <Field label="Total" calc>
              <input readOnly value={fmtARS(form.total)} style={{ ...calcSt, color: COLOR, fontSize: 16 }} />
            </Field>
          </FormGrid>

          <Field label="Notas / Condiciones">
            <textarea value={form.notas ?? ''} onChange={e => setF({ notas: e.target.value })} rows={2}
              placeholder="Condiciones, aclaraciones, garantías..." style={{ ...inputSt, resize: 'vertical' }} />
          </Field>
        </Modal>
      )}
    </div>
  )
}
