'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { MetodoPago, StockItem, EquipoUsado, Orden, CartItem, VentaCaja, Proveedor, ClientePersona, ClienteB2B } from '@/lib/sistema-types'
import { fmtARS, C, inputSt } from './shared'
import { printTicket, printFactura } from '@/lib/print-caja'

const COLOR = '#4ade80'
const METODOS: MetodoPago[] = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito', 'Cheque']

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

// ─── ProveedorCombo ───────────────────────────────────────────────────────────
// Muestra proveedores existentes + opción de agregar nuevo rápidamente
function ProveedorCombo({
  value, onChange, proveedores, onProveedorCreado,
}: {
  value: string
  onChange: (v: string) => void
  proveedores: Proveedor[]
  onProveedorCreado: (p: Proveedor) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const q = value.trim().toLowerCase()
  const filtered = proveedores.filter(p => !q || p.nombre.toLowerCase().includes(q)).slice(0, 8)
  const exactMatch = proveedores.some(p => p.nombre.toLowerCase() === q)
  const showAdd = q.length > 0 && !exactMatch

  const crearProveedor = async () => {
    if (!value.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/sistema/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: value.trim(), contacto: '', telefono: '', mail: '', notas: '' }),
      })
      if (res.ok) {
        const nuevo: Proveedor = await res.json()
        onProveedorCreado(nuevo)
        onChange(nuevo.nombre)
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Buscar o escribir proveedor..."
        style={{ ...inputSt, fontSize: 12 }}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div
          onWheel={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 600,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
          <div className="dropdown-scroll" style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden' }} onWheel={e => e.stopPropagation()}>
          {filtered.map(p => (
            <button
              key={p.id}
              onMouseDown={() => { onChange(p.nombre); setOpen(false) }}
              style={{
                width: '100%', padding: '9px 12px', textAlign: 'left', background: 'none',
                border: 'none', borderBottom: '1px solid var(--row-border)',
                cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: COLOR, display: 'inline-block',
              }} />
              <span style={{ flex: 1 }}>{p.nombre}</span>
              {p.telefono && <span style={{ fontSize: 10, color: C.muted }}>{p.telefono}</span>}
            </button>
          ))}
          {showAdd && (
            <button
              onMouseDown={crearProveedor}
              disabled={saving}
              style={{
                width: '100%', padding: '9px 12px', textAlign: 'left',
                border: 'none', borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none',
                background: `${COLOR}0d`, cursor: saving ? 'wait' : 'pointer',
                fontSize: 12, color: COLOR, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${COLOR}1a`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${COLOR}0d`)}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: `${COLOR}25`, border: `1px solid ${COLOR}60`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: COLOR, fontWeight: 700, lineHeight: 1,
              }}>+</span>
              {saving ? 'Guardando...' : `Agregar "${value.trim()}" como nuevo proveedor`}
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ClienteCombo ─────────────────────────────────────────────────────────────
// Busca clientes existentes (CSF + B2B) y permite agregar uno nuevo rápido
function ClienteCombo({
  value, onChange, onTelefonoChange, onCuitChange, onClienteSelect,
  clientesPersonas, clientesB2B, onClienteCreado,
}: {
  value: string
  onChange: (v: string) => void
  onTelefonoChange: (v: string) => void
  onCuitChange: (v: string) => void
  onClienteSelect: (tipo: 'clienteFinal' | 'gremio') => void
  clientesPersonas: ClientePersona[]
  clientesB2B: ClienteB2B[]
  onClienteCreado: (c: ClientePersona) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const q = value.trim().toLowerCase()

  const matchedPersonas = clientesPersonas
    .filter(c => !q || c.nombre.toLowerCase().includes(q) || c.telefono.includes(q) || c.dni.includes(q))
    .slice(0, 6)

  const matchedB2B = clientesB2B
    .filter(c => !q || c.nombre.toLowerCase().includes(q) || (c.empresa || '').toLowerCase().includes(q) || (c.cuit || '').includes(q))
    .slice(0, 6)

  const exactMatch =
    clientesPersonas.some(c => c.nombre.toLowerCase() === q) ||
    clientesB2B.some(c => c.nombre.toLowerCase() === q || (c.empresa || '').toLowerCase() === q)
  const showAdd = q.length >= 2 && !exactMatch
  const total = matchedPersonas.length + matchedB2B.length

  const crearCliente = async () => {
    if (!value.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/sistema/clientes-personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: value.trim(), telefono: '', mail: '', dni: '', notas: '' }),
      })
      if (res.ok) {
        const nuevo: ClientePersona = await res.json()
        onClienteCreado(nuevo)
        onClienteSelect('clienteFinal')
        setOpen(false)
      }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Nombre del cliente"
        style={{ ...inputSt, fontSize: 12, padding: '7px 10px' }}
      />
      {open && (total > 0 || showAdd) && (
        <div
          onWheel={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 700,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', overflow: 'hidden',
          }}
        >
          <div className="dropdown-scroll" style={{ maxHeight: 300, overflowY: 'auto' }} onWheel={e => e.stopPropagation()}>
            {matchedPersonas.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--surface2)', borderBottom: '1px solid var(--row-border)' }}>
                  👤 Clientes Finales
                </div>
                {matchedPersonas.map(c => (
                  <button key={c.id}
                    onMouseDown={() => { onChange(c.nombre); onTelefonoChange(c.telefono); onCuitChange(c.dni); onClienteSelect('clienteFinal'); setOpen(false) }}
                    style={{ width: '100%', padding: '9px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--row-border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{c.nombre}</span>
                    {c.telefono && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.telefono}</span>}
                    {c.dni && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>DNI {c.dni}</span>}
                  </button>
                ))}
              </>
            )}
            {matchedB2B.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--surface2)', borderTop: matchedPersonas.length > 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--row-border)' }}>
                  🏢 Gremio / Empresas
                </div>
                {matchedB2B.map(c => (
                  <button key={c.id}
                    onMouseDown={() => { onChange(c.nombre || c.empresa); onTelefonoChange(c.telefono); onCuitChange(c.cuit); onClienteSelect('gremio'); setOpen(false) }}
                    style={{ width: '100%', padding: '9px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--row-border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{c.nombre}{c.empresa && c.empresa !== c.nombre ? <span style={{ color: 'var(--text-dim)' }}> · {c.empresa}</span> : null}</span>
                    {c.cuit && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.cuit}</span>}
                  </button>
                ))}
              </>
            )}
            {showAdd && (
              <button
                onMouseDown={crearCliente}
                disabled={saving}
                style={{ width: '100%', padding: '9px 12px', textAlign: 'left', border: 'none', borderTop: total > 0 ? '1px solid var(--border)' : 'none', background: 'rgba(74,222,128,0.07)', cursor: saving ? 'wait' : 'pointer', fontSize: 12, color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.07)')}
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.5)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#4ade80', fontWeight: 700 }}>+</span>
                {saving ? 'Guardando...' : `Guardar "${value.trim()}" como nuevo cliente`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Product search helpers ───────────────────────────────────────────────────
const ALIASES: Record<string, string[]> = {
  pantalla: ['pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'display', 'incell'],
  modulo: ['modulo', 'módulo', 'pantalla', 'lcd', 'oled', 'display', 'incell'],
  módulo: ['modulo', 'módulo', 'pantalla', 'lcd', 'oled', 'display', 'incell'],
  lcd: ['lcd', 'pantalla', 'modulo', 'módulo', 'oled', 'display', 'incell'],
  oled: ['oled', 'pantalla', 'modulo', 'módulo', 'lcd', 'display', 'incell'],
  display: ['display', 'pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'incell'],
  incell: ['incell', 'pantalla', 'modulo', 'módulo', 'lcd', 'oled', 'display'],
  bateria: ['bateria', 'bat', 'battery', 'batería'],
  batería: ['bateria', 'bat', 'battery', 'batería'],
  camara: ['camara', 'cam', 'camera', 'cámara'],
  cámara: ['camara', 'cam', 'camera', 'cámara'],
}

function matchText(text: string, query: string): boolean {
  const lq = query.toLowerCase().trim()
  const lt = text.toLowerCase()
  const terms = ALIASES[lq] ?? [lq]
  return terms.some(t => lt.includes(t))
}

// ─── Tab type ─────────────────────────────────────────────────────────────────
type TabId = 'repuestos' | 'accesorios' | 'telefonos' | 'ordenes'

interface StockProduct {
  id: string
  nombre: string
  modelo: string
  stock: number
  precio: number
  tipo: 'repuesto' | 'accesorio'
}

interface EquipoProduct {
  id: string
  nombre: string
  modelo: string
  stock: number
  precio: number
  tipo: 'telefono'
}

interface OrdenProduct {
  id: string
  nombre: string
  modelo: string
  stock: number
  precio: number
  tipo: 'orden'
  ordenId: string
  nOrden: number
}

type AnyProduct = StockProduct | EquipoProduct | OrdenProduct

// ─── Main component ───────────────────────────────────────────────────────────
export default function CajaView() {
  // Data
  const [repuestos, setRepuestos] = useState<StockProduct[]>([])
  const [accesorios, setAccesorios] = useState<StockProduct[]>([])
  const [telefonos, setTelefonos] = useState<EquipoProduct[]>([])
  const [ordenes, setOrdenes] = useState<OrdenProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [clientesPersonas, setClientesPersonas] = useState<ClientePersona[]>([])
  const [clientesB2B, setClientesB2B] = useState<ClienteB2B[]>([])
  const [clienteTipoPreset, setClienteTipoPreset] = useState<'clienteFinal' | 'gremio'>('clienteFinal')

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [descuento, setDescuento] = useState(0)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteCuit, setClienteCuit] = useState('')
  const [clienteOpen, setClienteOpen] = useState(false)
  const [observaciones, setObservaciones] = useState('')

  // Search / tabs
  const [tab, setTab] = useState<TabId>('repuestos')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Barcode detection
  const lastKeyTimeRef = useRef<number>(0)
  const barcodeBufferRef = useRef<string>('')

  // Modal de confirmación genérico
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; icon?: string
    onConfirm: () => void
  } | null>(null)

  const showConfirm = (title: string, message: string, icon: string, onConfirm: () => void) => {
    setConfirmModal({ title, message, icon, onConfirm })
  }

  // Modal "reponer stock" — se muestra cuando se agrega un producto sin stock
  const [stockModal, setStockModal] = useState<AnyProduct | null>(null)
  const [stockModalStep, setStockModalStep] = useState<'choose' | 'form'>('choose')
  const [stockModalCantidad, setStockModalCantidad] = useState(1)
  const [stockModalProveedor, setStockModalProveedor] = useState('')
  const [stockModalCosto, setStockModalCosto] = useState(0)
  const [stockModalSaving, setStockModalSaving] = useState(false)

  // Cobrar modal
  const [showCobrar, setShowCobrar] = useState(false)
  const [tipoFactura, setTipoFactura] = useState<'none' | 'A' | 'B'>('none')
  const [tipoCliente, setTipoCliente] = useState<'clienteFinal' | 'gremio' | 'empresa'>('clienteFinal')
  const [cobrarCuit, setCobrarCuit] = useState('')
  const [cobrarLoading, setCobrarLoading] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<VentaCaja | null>(null)

  // Edición inline de precio
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceVal, setEditingPriceVal] = useState('')

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [stockRes, equiposRes, ordenesRes, provRes, cpersonasRes, cb2bRes] = await Promise.all([
        fetch('/api/sistema/stock'),
        fetch('/api/sistema/equipos'),
        fetch('/api/sistema/ordenes'),
        fetch('/api/sistema/proveedores'),
        fetch('/api/sistema/clientes-personas'),
        fetch('/api/sistema/clientes'),
      ])
      if (provRes.ok) {
        const provData = await provRes.json()
        setProveedores(Array.isArray(provData) ? provData : (provData?.items ?? []))
      }
      if (cpersonasRes.ok) {
        const data = await cpersonasRes.json()
        setClientesPersonas(Array.isArray(data) ? data : [])
      }
      if (cb2bRes.ok) {
        const data = await cb2bRes.json()
        setClientesB2B(Array.isArray(data) ? data : [])
      }
      if (stockRes.ok) {
        const { items } = await stockRes.json() as { items: StockItem[] }
        setRepuestos(items.filter(i => i.tipo === 'repuestos').map(i => ({
          id: i.id, nombre: i.repuesto, modelo: i.modelo, stock: i.stock,
          precio: i.costoUnitario, tipo: 'repuesto' as const,
        })))
        setAccesorios(items.filter(i => i.tipo === 'accesorios').map(i => ({
          id: i.id, nombre: i.repuesto, modelo: i.modelo, stock: i.stock,
          precio: i.costoUnitario, tipo: 'accesorio' as const,
        })))
      }
      if (equiposRes.ok) {
        // La API de equipos devuelve un array directo (no { items: [...] })
        const equiposData = await equiposRes.json()
        const equiposList: EquipoUsado[] = Array.isArray(equiposData)
          ? equiposData
          : (equiposData?.items ?? [])
        setTelefonos(equiposList.filter(i => i.estado === 'En stock').map(i => ({
          id: i.id, nombre: i.modelo, modelo: `${i.color} ${i.capacidad}`.trim(),
          stock: 1, precio: i.precioVenta, tipo: 'telefono' as const,
        })))
      }
      if (ordenesRes.ok) {
        const { items } = await ordenesRes.json() as { items: Orden[] }
        setOrdenes(items.filter(o => o.estado !== 'Entregado').map(o => ({
          id: o.id, nombre: `${o.nombreCliente} — ${o.modeloEquipo}`,
          modelo: o.tipoServicio ?? '', stock: 1, precio: o.montoCobrado,
          tipo: 'orden' as const, ordenId: o.id, nOrden: o.nOrden,
        })))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Computed ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0)
  const total = Math.max(0, subtotal - descuento)

  const currentProducts: AnyProduct[] = (() => {
    switch (tab) {
      case 'repuestos': return repuestos
      case 'accesorios': return accesorios
      case 'telefonos': return telefonos
      case 'ordenes': return ordenes
    }
  })()

  const filtered = search.trim()
    ? currentProducts.filter(p => matchText(p.nombre, search) || matchText(p.modelo, search))
    : currentProducts

  // ── Cart actions ─────────────────────────────────────────────────────────────
  const doAddToCart = useCallback((product: AnyProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.refId === product.id)
      if (existing) {
        return prev.map(i => i.refId === product.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
          : i)
      }
      return [...prev, {
        id: uid(), nombre: product.nombre, cantidad: 1,
        precioUnitario: product.precio, subtotal: product.precio,
        tipo: product.tipo as CartItem['tipo'], refId: product.id,
      }]
    })
  }, [])

  const addToCart = useCallback((product: AnyProduct) => {
    if (product.tipo !== 'orden' && (product.stock ?? 0) <= 0) {
      setStockModal(product)
      setStockModalStep('choose')
      setStockModalCantidad(1)
      setStockModalProveedor('')
      setStockModalCosto(product.precio)
      return
    }
    doAddToCart(product)
  }, [doAddToCart])

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.flatMap(i => {
      if (i.id !== id) return [i]
      const qty = i.cantidad + delta
      if (qty <= 0) return []
      return [{ ...i, cantidad: qty, subtotal: qty * i.precioUnitario }]
    }))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const startEditPrice = (item: CartItem) => {
    setEditingPriceId(item.id)
    setEditingPriceVal(String(item.precioUnitario))
  }

  const commitEditPrice = (id: string) => {
    const val = parseFloat(editingPriceVal)
    if (!isNaN(val) && val >= 0) {
      setCart(prev => prev.map(i => i.id === id
        ? { ...i, precioUnitario: val, subtotal: val * i.cantidad }
        : i))
    }
    setEditingPriceId(null)
  }

  const addManualItem = () => {
    const nombre = prompt('Descripción del ítem:')
    if (!nombre?.trim()) return
    const precioStr = prompt('Precio unitario (ARS):')
    const precio = parseFloat(precioStr ?? '')
    if (isNaN(precio) || precio < 0) return
    const item: CartItem = {
      id: uid(), nombre: nombre.trim(), cantidad: 1,
      precioUnitario: precio, subtotal: precio, tipo: 'manual',
    }
    setCart(prev => [...prev, item])
  }

  // ── Barcode scanner ──────────────────────────────────────────────────────────
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()
    const gap = now - lastKeyTimeRef.current
    lastKeyTimeRef.current = now

    if (e.key !== 'Enter') {
      if (gap < 80) {
        barcodeBufferRef.current += e.key
      } else {
        barcodeBufferRef.current = e.key
      }
      return
    }
    // Enter key
    const isBarcode = gap < 80 || barcodeBufferRef.current.length > 3
    if (isBarcode && barcodeBufferRef.current) {
      const query = barcodeBufferRef.current
      barcodeBufferRef.current = ''
      const all: AnyProduct[] = [...repuestos, ...accesorios, ...telefonos, ...ordenes]
      const matches = all.filter(p => matchText(p.nombre, query) || matchText(p.modelo, query))
      if (matches.length === 1) {
        addToCart(matches[0])
        setSearch('')
        return
      }
    }
    // Regular Enter: add first filtered result
    if (filtered.length === 1) {
      addToCart(filtered[0])
      setSearch('')
    }
  }

  // ── Cobrar ────────────────────────────────────────────────────────────────────
  const openCobrar = () => {
    if (cart.length === 0) return
    setTipoFactura('none')
    setTipoCliente(clienteTipoPreset)
    setCobrarCuit(clienteCuit)
    setVentaCreada(null)
    setShowCobrar(true)
  }

  const confirmarCobro = async () => {
    setCobrarLoading(true)
    try {
      const now = new Date()
      const ventaBody = {
        fecha: now.toISOString().slice(0, 10),
        hora: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        items: cart,
        subtotal,
        descuento,
        total,
        metodoPago,
        clienteNombre: clienteNombre || undefined,
        clienteTelefono: clienteTelefono || undefined,
        clienteCuit: cobrarCuit || clienteCuit || undefined,
        tipoFactura: tipoFactura === 'none' ? null : tipoFactura,
        // Si elige Factura A, siempre es empresa; si no, usa la selección manual
        tipoCliente: tipoFactura === 'A' ? 'empresa' : tipoCliente,
        observaciones: observaciones || undefined,
      }
      const res = await fetch('/api/sistema/ventas-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ventaBody),
      })
      if (!res.ok) throw new Error('Error al guardar la venta')
      const venta: VentaCaja = await res.json()
      setVentaCreada(venta)

      // Descontar stock — re-fetch para tener datos frescos y completos
      const stockItems = cart.filter(i => (i.tipo === 'repuesto' || i.tipo === 'accesorio') && i.refId)
      if (stockItems.length > 0) {
        const [repRes, accRes] = await Promise.all([
          fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()).catch(() => ({ items: [] })),
          fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()).catch(() => ({ items: [] })),
        ])
        const allStock: StockItem[] = [...(repRes?.items ?? []), ...(accRes?.items ?? [])]
        for (const cartItem of stockItems) {
          const stockItem = allStock.find(s => s.id === cartItem.refId)
          if (!stockItem) continue
          const nuevoStock = Math.max(0, (stockItem.stock ?? 0) - cartItem.cantidad)
          await fetch('/api/sistema/stock', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Enviamos el item completo para que calcStock recalcule costoTotalARS correctamente
            body: JSON.stringify({ ...stockItem, stock: nuevoStock }),
          })
        }
      }
      // Marcar órdenes como entregadas
      for (const item of cart.filter(i => i.tipo === 'orden' && i.refId)) {
        await fetch(`/api/sistema/ordenes/${item.refId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'Entregado' }),
        })
      }

      // Reset cart y búsqueda
      setCart([])
      setDescuento(0)
      setClienteNombre('')
      setClienteTelefono('')
      setClienteCuit('')
      setObservaciones('')
      setSearch('')
      setClienteTipoPreset('clienteFinal')
      loadData()
    } catch (e) {
      alert(`Error: ${String(e)}`)
    } finally {
      setCobrarLoading(false)
    }
  }

  // ── Reponer stock y agregar al carrito ────────────────────────────────────
  const confirmarReponerStock = async () => {
    if (!stockModal) return
    setStockModalSaving(true)
    try {
      // Buscar el stock item completo para hacer el PUT correctamente
      const [repRes, accRes] = await Promise.all([
        fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()).catch(() => ({ items: [] })),
      ])
      const allStock: StockItem[] = [...(repRes?.items ?? []), ...(accRes?.items ?? [])]
      const stockItem = allStock.find(s => s.id === stockModal.id)
      if (stockItem) {
        const nuevoStock = (stockItem.stock ?? 0) + stockModalCantidad
        await fetch('/api/sistema/stock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...stockItem,
            stock: nuevoStock,
            costoUnitario: stockModalCosto || stockItem.costoUnitario,
            proveedor: stockModalProveedor || stockItem.proveedor,
          }),
        })
      }
      doAddToCart(stockModal)
      setStockModal(null)
      loadData()
    } catch { alert('Error al actualizar el stock') }
    finally { setStockModalSaving(false) }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: 'repuestos', label: 'Repuestos', count: repuestos.length },
    { id: 'accesorios', label: 'Accesorios', count: accesorios.length },
    { id: 'telefonos', label: 'Teléfonos', count: telefonos.length },
    { id: 'ordenes', label: 'Órdenes', count: ordenes.length },
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', gap: 0 }}>
      {/* ── Left panel: catalog ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}18`, border: `1.5px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖥️</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Caja de mostrador</div>
              <div style={{ fontSize: 11, color: C.muted }}>Seleccioná productos para agregar al carrito</div>
            </div>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.muted, pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar producto o escanear código de barras…"
              style={{ ...inputSt, paddingLeft: 34 }}
            />
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch('') }}
                style={{
                  padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, borderBottom: `2px solid ${tab === t.id ? COLOR : 'transparent'}`,
                  color: tab === t.id ? COLOR : C.muted, transition: 'all 0.15s', borderRadius: '6px 6px 0 0',
                }}
              >
                {t.label}
                <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 6px', borderRadius: 10, background: tab === t.id ? `${COLOR}20` : 'var(--surface2)', color: tab === t.id ? COLOR : C.muted }}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Cargando productos…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin resultados{search ? ` para "${search}"` : ''}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${COLOR}50`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                    {p.modelo && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{p.modelo}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {p.tipo !== 'orden' && (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: (p.stock ?? 0) > 0 ? 'rgba(74,222,128,0.12)' : 'rgba(255,59,48,0.12)', color: (p.stock ?? 0) > 0 ? COLOR : '#FF3B30', fontWeight: 600 }}>
                        {p.tipo === 'telefono' ? '1 u.' : `${p.stock ?? 0} u.`}
                      </span>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>{fmtARS(p.precio)}</div>
                    <button
                      onClick={() => addToCart(p)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: 'none',
                        background: COLOR, color: '#000', fontSize: 18, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                      title="Agregar al carrito"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: cart ────────────────────────────────────────────────── */}
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
        {/* Cart header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🛒 Carrito <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>({cart.length} ítem{cart.length !== 1 ? 's' : ''})</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addManualItem} title="Agregar ítem manual" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>+ Manual</button>
            {cart.length > 0 && <button onClick={() => showConfirm('Vaciar carrito', '¿Querés eliminar todos los ítems del carrito?', '🗑️', () => setCart([]))} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>Vaciar</button>}
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {cart.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>El carrito está vacío.<br />Agregá productos desde el catálogo.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cart.map(item => (
                <div key={item.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>{item.nombre}</span>
                    <button onClick={() => removeFromCart(item.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => updateQty(item.id, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{item.cantidad}</span>
                      <button onClick={() => updateQty(item.id, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <span style={{ fontSize: 11, color: C.muted }}>×</span>
                    {/* Unit price (editable) */}
                    {editingPriceId === item.id ? (
                      <input
                        type="number"
                        autoFocus
                        value={editingPriceVal}
                        onChange={e => setEditingPriceVal(e.target.value)}
                        onBlur={() => commitEditPrice(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEditPrice(item.id) }}
                        style={{ width: 80, padding: '3px 6px', borderRadius: 6, border: `1px solid ${COLOR}`, background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', textAlign: 'right' }}
                      />
                    ) : (
                      <span
                        title="Clic para editar precio"
                        onClick={() => startEditPrice(item)}
                        style={{ fontSize: 12, color: C.muted, cursor: 'pointer', borderBottom: '1px dashed var(--border)', paddingBottom: 1 }}
                      >{fmtARS(item.precioUnitario)}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmtARS(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: client, discount, total, pay */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Client collapsible */}
          <div>
            <button
              onClick={() => setClienteOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}
            >
              <span style={{ fontSize: 10 }}>{clienteOpen ? '▼' : '▶'}</span>
              👤 Datos del cliente
              {clienteNombre && <span style={{ fontSize: 11, color: COLOR, fontWeight: 600 }}>— {clienteNombre}</span>}
            </button>
            {clienteOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ClienteCombo
                  value={clienteNombre}
                  onChange={setClienteNombre}
                  onTelefonoChange={setClienteTelefono}
                  onCuitChange={setClienteCuit}
                  onClienteSelect={tipo => setClienteTipoPreset(tipo)}
                  clientesPersonas={clientesPersonas}
                  clientesB2B={clientesB2B}
                  onClienteCreado={c => setClientesPersonas(prev => [...prev, c])}
                />
                <input value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} placeholder="Teléfono" style={{ ...inputSt, fontSize: 12, padding: '7px 10px' }} />
                <input value={clienteCuit} onChange={e => setClienteCuit(e.target.value)} placeholder="CUIT / DNI" style={{ ...inputSt, fontSize: 12, padding: '7px 10px' }} />
              </div>
            )}
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500, flexShrink: 0 }}>Descuento</span>
            <input
              type="number"
              min={0}
              value={descuento || ''}
              onChange={e => setDescuento(Math.max(0, Number(e.target.value)))}
              placeholder="0"
              style={{ ...inputSt, fontSize: 12, padding: '7px 10px', flex: 1, textAlign: 'right' }}
            />
          </div>

          {/* Totals */}
          {descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
              <span>Subtotal</span><span style={{ fontFamily: 'monospace' }}>{fmtARS(subtotal)}</span>
            </div>
          )}
          {descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#f87171' }}>
              <span>Descuento</span><span style={{ fontFamily: 'monospace' }}>− {fmtARS(descuento)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: `${COLOR}12`, border: `1px solid ${COLOR}30` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: COLOR, fontFamily: 'monospace' }}>{fmtARS(total)}</span>
          </div>

          {/* Payment methods */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {METODOS.map(m => (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                style={{
                  padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${metodoPago === m ? COLOR : 'var(--border)'}`,
                  background: metodoPago === m ? `${COLOR}18` : 'var(--surface2)',
                  color: metodoPago === m ? COLOR : C.muted,
                  transition: 'all 0.12s',
                }}
              >{m}</button>
            ))}
          </div>

          {/* Cobrar button */}
          <button
            onClick={openCobrar}
            disabled={cart.length === 0}
            style={{
              padding: '13px', borderRadius: 10, border: 'none',
              background: cart.length === 0 ? 'var(--surface2)' : `linear-gradient(135deg, #22c55e, #16a34a)`,
              color: cart.length === 0 ? C.muted : '#fff',
              fontSize: 15, fontWeight: 800, cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: cart.length === 0 ? 'none' : `0 4px 14px rgba(74,222,128,0.3)`,
              transition: 'all 0.15s',
            }}
          >
            💳 COBRAR {fmtARS(total)}
          </button>
        </div>
      </div>

      {/* ── Cobrar modal ──────────────────────────────────────────────────────── */}
      {showCobrar && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 499 }}
            onClick={() => { if (!cobrarLoading && !ventaCreada) setShowCobrar(false) }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 500, width: 440, maxHeight: '90vh', borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {ventaCreada ? '✅ Venta registrada' : '💳 Confirmar cobro'}
              </span>
              {!cobrarLoading && (
                <button onClick={() => { setShowCobrar(false); setVentaCreada(null) }} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: C.muted, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!ventaCreada ? (
                <>
                  {/* Summary */}
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
                      <span>{cart.length} ítem{cart.length !== 1 ? 's' : ''}</span>
                      <span>Método: {metodoPago}</span>
                    </div>
                    {descuento > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#f87171', marginBottom: 4 }}>
                        <span>Descuento</span><span>− {fmtARS(descuento)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, color: COLOR, fontFamily: 'monospace', marginTop: 6 }}>
                      <span>TOTAL</span><span>{fmtARS(total)}</span>
                    </div>
                    {clienteNombre && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Cliente: {clienteNombre}</div>}
                  </div>

                  {/* Tipo de cliente — determinado por el cliente seleccionado */}
                  {(() => {
                    const tipo = tipoFactura === 'A' ? 'empresa' : tipoCliente
                    const MAP = {
                      clienteFinal: { label: '👤 Cliente Final', color: COLOR },
                      gremio:       { label: '🏢 Gremio',        color: '#34d399' },
                      empresa:      { label: '🏛️ Empresa',       color: '#a78bfa' },
                    }
                    const { label, color } = MAP[tipo]
                    return (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo de cliente</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 9, border: `1.5px solid ${color}`, background: `${color}15` }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                          {tipoFactura === 'A' && <span style={{ fontSize: 10, color: C.muted }}>(Factura A)</span>}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Tipo de comprobante */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo de comprobante</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['none', 'B', 'A'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setTipoFactura(t)
                            // Factura A implica empresa automáticamente
                            if (t === 'A') setTipoCliente('empresa')
                          }}
                          style={{
                            flex: 1, padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            border: `1.5px solid ${tipoFactura === t ? COLOR : 'var(--border)'}`,
                            background: tipoFactura === t ? `${COLOR}15` : 'var(--surface2)',
                            color: tipoFactura === t ? COLOR : C.muted,
                            transition: 'all 0.12s',
                          }}
                        >{t === 'none' ? 'Sin factura' : `Factura ${t}`}</button>
                      ))}
                    </div>
                  </div>

                  {/* CUIT para factura A o B */}
                  {(tipoFactura === 'A' || tipoFactura === 'B') && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CUIT del cliente {tipoFactura === 'A' ? '*' : ''}</div>
                      <input
                        value={cobrarCuit}
                        onChange={e => setCobrarCuit(e.target.value)}
                        placeholder="xx-xxxxxxxx-x"
                        style={{ ...inputSt, fontSize: 13 }}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* Post-sale actions */
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLOR, marginBottom: 4 }}>¡Venta #{ventaCreada.nVenta} registrada!</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{fmtARS(ventaCreada.total)} · {ventaCreada.metodoPago}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => printTicket(ventaCreada)}
                      style={{ padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >🖨 Imprimir ticket</button>
                    {ventaCreada.tipoFactura && (
                      <button
                        onClick={() => printFactura(ventaCreada, ventaCreada.tipoFactura as 'A' | 'B')}
                        style={{ padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >📄 Imprimir Factura {ventaCreada.tipoFactura}</button>
                    )}
                    <button
                      onClick={() => { setShowCobrar(false); setVentaCreada(null) }}
                      style={{ padding: '11px', borderRadius: 9, border: 'none', background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginTop: 4 }}
                    >Cerrar y nueva venta</button>
                  </div>
                </div>
              )}
            </div>

            {!ventaCreada && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowCobrar(false)}
                  disabled={cobrarLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: C.muted, fontSize: 13, fontWeight: 600 }}
                >Cancelar</button>
                <button
                  onClick={confirmarCobro}
                  disabled={cobrarLoading}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 8, cursor: cobrarLoading ? 'not-allowed' : 'pointer',
                    background: cobrarLoading ? COLOR : 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {cobrarLoading
                    ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Registrando…</>
                    : `✅ Confirmar ${fmtARS(total)}`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal: Reponer stock ─────────────────────────────────────────────── */}
      {stockModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 599 }}
            onClick={() => !stockModalSaving && setStockModal(null)} />
          <div onWheel={e => e.stopPropagation()} style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 500, borderRadius: 18,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, borderRadius: '18px 18px 0 0', background: 'var(--surface)' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: 'rgba(251,146,60,0.12)', border: '1.5px solid rgba(251,146,60,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📦</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Sin stock disponible</div>
                <div style={{ fontSize: 13, color: '#fb923c', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stockModal.nombre}{stockModal.modelo ? ` — ${stockModal.modelo}` : ''}</div>
              </div>
              {!stockModalSaving && (
                <button onClick={() => setStockModal(null)} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              )}
            </div>

            {stockModalStep === 'choose' ? (
              /* Paso 1: elegir acción */
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Este producto no tiene unidades en stock. ¿Cómo querés continuar?
                </p>
                <button
                  onClick={() => setStockModalStep('form')}
                  style={{ padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${COLOR}`, background: `${COLOR}10`, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 22 }}>📦</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>Agregar al stock primero</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Registrá proveedor, cantidad y precio. El stock se actualiza y la venta lo descuenta correctamente.</div>
                  </div>
                </button>
                <button
                  onClick={() => { doAddToCart(stockModal); setStockModal(null) }}
                  style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 22 }}>➔</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Continuar sin agregar</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Agrega el producto al carrito igualmente, sin modificar el stock.</div>
                  </div>
                </button>
              </div>
            ) : (
              /* Paso 2: formulario de reposición */
              <div style={{ padding: '24px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, borderRadius: '0 0 18px 18px', background: 'var(--surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>Cantidad a ingresar</div>
                    <input type="number" min={1} value={stockModalCantidad}
                      onChange={e => setStockModalCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ ...inputSt, fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>Precio costo (ARS)</div>
                    <input type="number" min={0} value={stockModalCosto}
                      onChange={e => setStockModalCosto(parseFloat(e.target.value) || 0)}
                      style={{ ...inputSt, fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>Proveedor</div>
                  <ProveedorCombo
                    value={stockModalProveedor}
                    onChange={setStockModalProveedor}
                    proveedores={proveedores}
                    onProveedorCreado={nuevo => setProveedores(prev => [...prev, nuevo])}
                  />
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: `${COLOR}0c`, border: `1px solid ${COLOR}25`, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Se agregarán <b style={{ color: COLOR }}>{stockModalCantidad} unidad{stockModalCantidad !== 1 ? 'es' : ''}</b> al stock y el producto quedará disponible para descontar al cobrar.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStockModalStep('choose')} disabled={stockModalSaving}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                    ← Volver
                  </button>
                  <button onClick={confirmarReponerStock} disabled={stockModalSaving}
                    style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: stockModalSaving ? 'var(--border)' : COLOR, color: stockModalSaving ? 'var(--text-secondary)' : '#000', fontSize: 13, fontWeight: 700, cursor: stockModalSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {stockModalSaving
                      ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Guardando…</>
                      : '📦 Ingresar al stock y agregar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal de confirmación personalizado ──────────────────────────────── */}
      {confirmModal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 599 }}
            onClick={() => setConfirmModal(null)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 380, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {confirmModal.icon ?? '⚠️'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {confirmModal.title}
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: '16px 22px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {confirmModal.message}
              </p>
            </div>
            {/* Footer */}
            <div style={{
              padding: '0 22px 18px',
              display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null) }}
                style={{
                  padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                  background: COLOR, border: 'none',
                  color: '#000', fontSize: 13, fontWeight: 700,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
