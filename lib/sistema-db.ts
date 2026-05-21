// Server-only — never import from client components
import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'
import type {
  Turno, VentaCSF, VentaGremio, Gasto, Comision, StockItem,
  ClienteB2B, ClientePersona, Proveedor, TipoCambio, DashboardData, TipoGasto, TipoStock,
  Orden, Servicio, ReglaComision, ReglaComisionGremio, EquipoUsado, ProveedorEquipo, CompraCliente, VentaCaja, CierreCaja, Presupuesto,
  StockMovimiento, CuentaCorrienteItem, EstadoCCItem, SesionCaja, AdminIntervencionCaja,
  MPCuenta,
} from './sistema-types'

const DATA_DIR = path.join(process.cwd(), 'data')

function file(name: string) { return path.join(DATA_DIR, `sistema-${name}.json`) }

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

async function read<T>(name: string): Promise<T[]> {
  if (redis) {
    const data = await redis.get<string>(name)
    if (!data) return []
    return typeof data === 'string' ? JSON.parse(data) : data as T[]
  }
  try {
    let raw = fs.readFileSync(file(name), 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw) as T[]
  } catch { return [] }
}

async function write<T>(name: string, data: T[]): Promise<void> {
  if (redis) { await redis.set(name, JSON.stringify(data)); return }
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf-8')
}

async function readSingle<T>(name: string, fallback: T): Promise<T> {
  if (redis) {
    const data = await redis.get<string>(name)
    if (!data) return fallback
    return typeof data === 'string' ? JSON.parse(data) : data as T
  }
  try {
    let raw = fs.readFileSync(file(name), 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw) as T
  } catch { return fallback }
}

async function writeSingle<T>(name: string, data: T): Promise<void> {
  if (redis) { await redis.set(name, JSON.stringify(data)); return }
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf-8')
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

// ── Tipo de Cambio ────────────────────────────────────────────────────────────
export async function getTipoCambio(): Promise<TipoCambio[]> { return await read<TipoCambio>('tipo-cambio') }
export async function getUltimoDolar(): Promise<number> {
  const tc = await getTipoCambio()
  if (!tc.length) return 1200
  return tc.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].valor
}
export async function addTipoCambio(data: Omit<TipoCambio, 'id'>): Promise<TipoCambio> {
  const items = await getTipoCambio()
  const item: TipoCambio = { id: uid(), ...data }
  await write('tipo-cambio', [...items, item])
  return item
}
export async function deleteTipoCambio(id: string): Promise<void> {
  await write('tipo-cambio', (await getTipoCambio()).filter(i => i.id !== id))
}

// ── Turnos ────────────────────────────────────────────────────────────────────
export async function getTurnos(): Promise<Turno[]> { return await read<Turno>('turnos') }
export async function addTurno(data: Omit<Turno, 'id' | 'createdAt'>): Promise<Turno> {
  const items = await getTurnos()
  const item: Turno = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('turnos', [...items, item])
  return item
}
export async function updateTurno(id: string, data: Partial<Turno>): Promise<Turno | null> {
  const items = await getTurnos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('turnos', items)
  return items[idx]
}
export async function deleteTurno(id: string): Promise<void> {
  await write('turnos', (await getTurnos()).filter(i => i.id !== id))
}

// ── Ventas CSF ────────────────────────────────────────────────────────────────
export function calcVentaCSF(data: Partial<VentaCSF>, dolar: number): Partial<VentaCSF> {
  const ticket = data.ticket ?? 0
  const costoUSD = data.costoRepuestoUSD ?? 0
  const precioD = data.precioDolar ?? dolar
  const costoRepuestoPesos = Math.round(costoUSD * precioD)
  const comisionMP = data.metodoPago === 'Mercado Pago' ? Math.round(ticket * 0.045) : 0
  const iibb = Math.round(ticket * 0.04)
  const comisionVendedora = data.comisionVendedora ?? 0
  const comisionTecnico = data.comisionTecnico ?? 0
  const gananciaReal = ticket - costoRepuestoPesos - comisionMP - iibb - comisionVendedora - comisionTecnico
  return { costoRepuestoPesos, precioDolar: precioD, comisionMP, iibb, montoNetoRecibido: ticket, gananciaReal }
}

export async function getNextOrdenCSF(): Promise<number> {
  const items = await getVentasCSF()
  const valid = items.map(v => Number(v.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 10001
  return Math.max(...valid) + 1
}

export async function getVentasCSF(): Promise<VentaCSF[]> { return await read<VentaCSF>('ventas-csf') }
export async function addVentaCSF(data: Omit<VentaCSF, 'id' | 'createdAt'>): Promise<VentaCSF> {
  const items = await getVentasCSF()
  const item: VentaCSF = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('ventas-csf', [...items, item])
  return item
}
export async function updateVentaCSF(id: string, data: Partial<VentaCSF>): Promise<VentaCSF | null> {
  const items = await getVentasCSF()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('ventas-csf', items)
  return items[idx]
}
export async function deleteVentaCSF(id: string): Promise<void> {
  await write('ventas-csf', (await getVentasCSF()).filter(i => i.id !== id))
}

// ── Ventas GREMIO ─────────────────────────────────────────────────────────────
export function calcVentaGremio(data: Partial<VentaGremio>, dolar: number): Partial<VentaGremio> {
  const montoCobrado = data.montoCobrado ?? 0
  const moneda = data.moneda ?? 'ARS $'
  const equivARS = moneda === 'USD $' ? Math.round(montoCobrado * dolar) : Math.round(montoCobrado)
  const comisionMP = data.metodoPago === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
  const iibb = Math.round(equivARS * 0.04)
  const costoRepuestos = data.costoRepuestos ?? 0
  const comisionTecnico = data.comisionTecnico ?? 0
  const gananciaReal = equivARS - costoRepuestos - comisionMP - iibb - comisionTecnico
  return { equivARS, montoNeto: equivARS, comisionMP, iibb, gananciaReal }
}

export async function getNextOrdenGremio(): Promise<number> {
  const items = await getVentasGremio()
  const valid = items.map(v => Number(v.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 20001
  return Math.max(...valid) + 1
}

export async function getVentasGremio(): Promise<VentaGremio[]> { return await read<VentaGremio>('ventas-gremio') }
export async function addVentaGremio(data: Omit<VentaGremio, 'id' | 'createdAt'>): Promise<VentaGremio> {
  const items = await getVentasGremio()
  const item: VentaGremio = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('ventas-gremio', [...items, item])
  return item
}
export async function updateVentaGremio(id: string, data: Partial<VentaGremio>): Promise<VentaGremio | null> {
  const items = await getVentasGremio()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('ventas-gremio', items)
  return items[idx]
}
export async function deleteVentaGremio(id: string): Promise<void> {
  await write('ventas-gremio', (await getVentasGremio()).filter(i => i.id !== id))
}

// ── Gastos ────────────────────────────────────────────────────────────────────
export async function getGastos(tipo?: TipoGasto): Promise<Gasto[]> {
  const all = await read<Gasto>('gastos')
  return tipo ? all.filter(g => g.tipo === tipo) : all
}
export async function addGasto(data: Omit<Gasto, 'id' | 'createdAt'>): Promise<Gasto> {
  const items = await getGastos()
  const item: Gasto = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('gastos', [...items, item])
  return item
}
export async function updateGasto(id: string, data: Partial<Gasto>): Promise<Gasto | null> {
  const items = await getGastos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('gastos', items)
  return items[idx]
}
export async function deleteGasto(id: string): Promise<void> {
  await write('gastos', (await getGastos()).filter(i => i.id !== id))
}

// ── Comisiones ────────────────────────────────────────────────────────────────
export function calcComision(data: Partial<Comision>): Partial<Comision> {
  const montoVenta = data.montoVenta ?? 0
  const porcentaje = data.porcentaje ?? 0
  const comisionCalculada = Math.round(montoVenta * porcentaje / 100)
  const comisionFija = data.comisionFija ?? 0
  const totalComision = comisionFija > 0 ? comisionFija : comisionCalculada
  return { comisionCalculada, totalComision }
}

export async function getComisiones(empleado?: string): Promise<Comision[]> {
  const all = await read<Comision>('comisiones')
  return empleado ? all.filter(c => c.empleado === empleado) : all
}
export async function addComision(data: Omit<Comision, 'id' | 'createdAt'>): Promise<Comision> {
  const items = await getComisiones()
  const item: Comision = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('comisiones', [...items, item])
  return item
}
export async function updateComision(id: string, data: Partial<Comision>): Promise<Comision | null> {
  const items = await getComisiones()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('comisiones', items)
  return items[idx]
}
export async function deleteComision(id: string): Promise<void> {
  await write('comisiones', (await getComisiones()).filter(i => i.id !== id))
}

// ── Stock ─────────────────────────────────────────────────────────────────────
export function calcStock(data: Partial<StockItem>, dolar: number): Partial<StockItem> {
  const stock = data.stock ?? 0
  const costoUnitario = data.costoUnitario ?? 0
  const moneda = data.moneda ?? 'ARS $'
  const costoTotalARS = moneda === 'USD $'
    ? Math.round(stock * costoUnitario * dolar)
    : Math.round(stock * costoUnitario)
  return { costoTotalARS }
}

export async function getStock(tipo?: TipoStock): Promise<StockItem[]> {
  const all = await read<StockItem>('stock')
  return tipo ? all.filter(s => s.tipo === tipo) : all
}
export async function addStockItem(data: Omit<StockItem, 'id' | 'updatedAt'>): Promise<StockItem> {
  const items = await getStock()
  const item: StockItem = { id: uid(), ...data, updatedAt: new Date().toISOString() }
  await write('stock', [...items, item])
  return item
}
export async function updateStockItem(id: string, data: Partial<StockItem>): Promise<StockItem | null> {
  const items = await getStock()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() }
  await write('stock', items)
  return items[idx]
}
export async function deleteStockItem(id: string): Promise<void> {
  await write('stock', (await getStock()).filter(i => i.id !== id))
}

// ── Órdenes de trabajo ────────────────────────────────────────────────────────
export function calcOrden(data: Partial<Orden>, dolar: number): Partial<Orden> {
  const moneda = data.moneda ?? 'ARS $'
  const montoCobrado = data.montoCobrado ?? 0
  const equivARS = moneda === 'USD $' ? Math.round(montoCobrado * dolar) : Math.round(montoCobrado)
  const costoRepuestoUSD = data.costoRepuestoUSD ?? 0
  const precioDolar = data.precioDolar ?? dolar
  const costoRepuestoPesos = Math.round(costoRepuestoUSD * precioDolar)
  const costoRepuestos = data.costoRepuestos ?? 0
  const comisionMP = data.metodoPago === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
  const iibb = Math.round(equivARS * 0.04)
  const comisionVendedora = data.comisionVendedora ?? 0
  const comisionTecnico = data.comisionTecnico ?? 0
  const totalCostos = data.tipo === 'Cliente final' ? costoRepuestoPesos : costoRepuestos
  const gananciaReal = equivARS - totalCostos - comisionMP - iibb - comisionVendedora - comisionTecnico
  return { equivARS, costoRepuestoPesos, precioDolar, comisionMP, iibb, gananciaReal }
}

export async function getNextOrdenNum(): Promise<number> {
  const items = await getOrdenes()
  const valid = items.map(o => Number(o.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 1
  return Math.max(...valid) + 1
}

function genCodigoSeguimiento(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function getOrdenes(): Promise<Orden[]> { return await read<Orden>('ordenes') }
export async function getOrdenByCodigo(codigo: string): Promise<Orden | null> {
  const items = await getOrdenes()
  return items.find(o => o.codigoSeguimiento === codigo.toUpperCase()) ?? null
}
export async function addOrden(data: Omit<Orden, 'id' | 'createdAt'>): Promise<Orden> {
  const items = await getOrdenes()
  const item: Orden = { id: uid(), codigoSeguimiento: genCodigoSeguimiento(), ...data, createdAt: new Date().toISOString() }
  await write('ordenes', [...items, item])
  return item
}
export async function updateOrden(id: string, data: Partial<Orden>): Promise<Orden | null> {
  const items = await getOrdenes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('ordenes', items)
  return items[idx]
}
export async function deleteOrden(id: string): Promise<void> {
  await write('ordenes', (await getOrdenes()).filter(i => i.id !== id))
}

// ── Servicios ─────────────────────────────────────────────────────────────────
export async function getServicios(): Promise<Servicio[]> { return await read<Servicio>('servicios') }
export async function addServicio(data: Omit<Servicio, 'id' | 'createdAt'>): Promise<Servicio> {
  const items = await getServicios()
  const item: Servicio = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('servicios', [...items, item])
  return item
}
export async function updateServicio(id: string, data: Partial<Servicio>): Promise<Servicio | null> {
  const items = await getServicios()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('servicios', items)
  return items[idx]
}
export async function deleteServicio(id: string): Promise<void> {
  await write('servicios', (await getServicios()).filter(i => i.id !== id))
}

// ── Clientes B2C (Personas) ───────────────────────────────────────────────────
export async function getClientesPersonas(): Promise<ClientePersona[]> { return await read<ClientePersona>('clientes-personas') }
export async function addClientePersona(data: Omit<ClientePersona, 'id' | 'createdAt'>): Promise<ClientePersona> {
  const items = await getClientesPersonas()
  const item: ClientePersona = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('clientes-personas', [...items, item])
  return item
}
export async function updateClientePersona(id: string, data: Partial<ClientePersona>): Promise<ClientePersona | null> {
  const items = await getClientesPersonas()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('clientes-personas', items)
  return items[idx]
}
export async function deleteClientePersona(id: string): Promise<void> {
  await write('clientes-personas', (await getClientesPersonas()).filter(i => i.id !== id))
}

// ── Clientes B2B ──────────────────────────────────────────────────────────────
export async function getClientes(): Promise<ClienteB2B[]> { return await read<ClienteB2B>('clientes') }
export async function addCliente(data: Omit<ClienteB2B, 'id' | 'createdAt'>): Promise<ClienteB2B> {
  const items = await getClientes()
  const item: ClienteB2B = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('clientes', [...items, item])
  return item
}
export async function updateCliente(id: string, data: Partial<ClienteB2B>): Promise<ClienteB2B | null> {
  const items = await getClientes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('clientes', items)
  return items[idx]
}
export async function deleteCliente(id: string): Promise<void> {
  await write('clientes', (await getClientes()).filter(i => i.id !== id))
}

// ── Proveedores ───────────────────────────────────────────────────────────────
export async function getProveedores(): Promise<Proveedor[]> { return await read<Proveedor>('proveedores') }
export async function addProveedor(data: Omit<Proveedor, 'id' | 'createdAt'>): Promise<Proveedor> {
  const items = await getProveedores()
  const item: Proveedor = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('proveedores', [...items, item])
  return item
}
export async function updateProveedor(id: string, data: Partial<Proveedor>): Promise<Proveedor | null> {
  const items = await getProveedores()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('proveedores', items)
  return items[idx]
}
export async function deleteProveedor(id: string): Promise<void> {
  await write('proveedores', (await getProveedores()).filter(i => i.id !== id))
}

// ── Equipos usados ────────────────────────────────────────────────────────────
export async function getEquipos(): Promise<EquipoUsado[]> { return await read<EquipoUsado>('equipos') }
export async function addEquipo(data: Omit<EquipoUsado, 'id' | 'createdAt' | 'nOrden'>): Promise<EquipoUsado> {
  const items = await getEquipos()
  const nOrden = items.length > 0 ? Math.max(...items.map(i => i.nOrden ?? 0)) + 1 : 1
  const item: EquipoUsado = { id: uid(), nOrden, ...data, createdAt: new Date().toISOString() }
  await write('equipos', [...items, item])
  return item
}
export async function updateEquipo(id: string, data: Partial<EquipoUsado>): Promise<EquipoUsado | null> {
  const items = await getEquipos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('equipos', items)
  return items[idx]
}
export async function deleteEquipo(id: string): Promise<void> {
  await write('equipos', (await getEquipos()).filter(i => i.id !== id))
}

// ── Proveedores de equipos usados ─────────────────────────────────────────────
export async function getProveedoresEquipos(): Promise<ProveedorEquipo[]> { return await read<ProveedorEquipo>('proveedores-equipos') }
export async function addProveedorEquipo(data: Omit<ProveedorEquipo, 'id' | 'createdAt'>): Promise<ProveedorEquipo> {
  const items = await getProveedoresEquipos()
  const item: ProveedorEquipo = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('proveedores-equipos', [...items, item])
  return item
}
export async function updateProveedorEquipo(id: string, data: Partial<ProveedorEquipo>): Promise<ProveedorEquipo | null> {
  const items = await getProveedoresEquipos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('proveedores-equipos', items)
  return items[idx]
}
export async function deleteProveedorEquipo(id: string): Promise<void> {
  await write('proveedores-equipos', (await getProveedoresEquipos()).filter(i => i.id !== id))
}

// ── Compras a clientes particulares ───────────────────────────────────────────
export async function getComprasClientes(): Promise<CompraCliente[]> { return await read<CompraCliente>('compras-clientes') }
export async function addCompraCliente(data: Omit<CompraCliente, 'id' | 'createdAt' | 'nOrden'>): Promise<CompraCliente> {
  const items = await getComprasClientes()
  const nOrden = items.length > 0 ? Math.max(...items.map(i => i.nOrden ?? 0)) + 1 : 1
  const item: CompraCliente = { id: uid(), nOrden, ...data, createdAt: new Date().toISOString() }
  await write('compras-clientes', [...items, item])
  return item
}
export async function updateCompraCliente(id: string, data: Partial<CompraCliente>): Promise<CompraCliente | null> {
  const items = await getComprasClientes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('compras-clientes', items)
  return items[idx]
}
export async function deleteCompraCliente(id: string): Promise<void> {
  await write('compras-clientes', (await getComprasClientes()).filter(i => i.id !== id))
}

// ── Ventas Caja (POS) ─────────────────────────────────────────────────────────
export async function getVentasCaja(): Promise<VentaCaja[]> { return await read<VentaCaja>('ventas-caja') }
export async function getNextVentaCajaNum(): Promise<number> {
  const items = await getVentasCaja()
  if (!items.length) return 1
  return Math.max(...items.map(v => v.nVenta ?? 0)) + 1
}
export async function addVentaCaja(data: Omit<VentaCaja, 'id'>): Promise<VentaCaja> {
  const items = await getVentasCaja()
  const item: VentaCaja = { id: uid(), ...data }
  await write('ventas-caja', [...items, item])
  return item
}
export async function updateVentaCaja(id: string, data: Partial<VentaCaja>): Promise<VentaCaja | null> {
  const items = await getVentasCaja()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('ventas-caja', items)
  return items[idx]
}
export async function deleteVentaCaja(id: string): Promise<void> {
  await write('ventas-caja', (await getVentasCaja()).filter(i => i.id !== id))
}

// ── Cierre de Caja ────────────────────────────────────────────────────────────
export async function getCierresCaja(): Promise<CierreCaja[]> { return await read<CierreCaja>('caja-diaria') }
export async function addCierreCaja(data: Omit<CierreCaja, 'id'>): Promise<CierreCaja> {
  const items = await getCierresCaja()
  const item: CierreCaja = { id: uid(), ...data }
  await write('caja-diaria', [...items, item])
  return item
}
export async function deleteCierreCaja(id: string): Promise<void> {
  await write('caja-diaria', (await getCierresCaja()).filter(i => i.id !== id))
}

// ── Presupuestos ──────────────────────────────────────────────────────────────
export async function getPresupuestos(): Promise<Presupuesto[]> { return await read<Presupuesto>('presupuestos') }
export async function getNextPresupuestoNum(): Promise<number> {
  const items = await getPresupuestos()
  if (!items.length) return 1
  return Math.max(...items.map(v => v.nPresupuesto ?? 0)) + 1
}
export async function addPresupuesto(data: Omit<Presupuesto, 'id'>): Promise<Presupuesto> {
  const items = await getPresupuestos()
  const nextNum = items.length ? Math.max(...items.map(v => v.nPresupuesto ?? 0)) + 1 : 1
  const item: Presupuesto = { id: uid(), ...data, nPresupuesto: nextNum }
  await write('presupuestos', [...items, item])
  return item
}
export async function updatePresupuesto(id: string, data: Partial<Presupuesto>): Promise<Presupuesto> {
  const items = await getPresupuestos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) throw new Error('Presupuesto not found')
  items[idx] = { ...items[idx], ...data }
  await write('presupuestos', items)
  return items[idx]
}
export async function deletePresupuesto(id: string): Promise<void> {
  await write('presupuestos', (await getPresupuestos()).filter(i => i.id !== id))
}

// ── Cuenta Corriente ──────────────────────────────────────────────────────────
export async function getCuentaCorriente(): Promise<CuentaCorrienteItem[]> {
  return await read<CuentaCorrienteItem>('cuenta-corriente')
}
export async function addCCItem(data: Omit<CuentaCorrienteItem, 'id' | 'createdAt'>): Promise<CuentaCorrienteItem> {
  const items = await getCuentaCorriente()
  const item: CuentaCorrienteItem = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('cuenta-corriente', [...items, item])
  return item
}
export async function updateCCItem(id: string, data: Partial<CuentaCorrienteItem>): Promise<CuentaCorrienteItem | null> {
  const items = await getCuentaCorriente()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  await write('cuenta-corriente', items)
  return items[idx]
}
export async function deleteCCItem(id: string): Promise<void> {
  await write('cuenta-corriente', (await getCuentaCorriente()).filter(i => i.id !== id))
}

// Calcular balance por cliente (solo cargos, excluyendo cancelados)
export async function getCCBalancePorCliente(): Promise<Array<{
  clienteId?: string; clienteNombre: string; clienteTipo: string; clienteTelefono?: string
  saldoPendiente: number; cargosCount: number; ultimaActividad: string
}>> {
  const items = await getCuentaCorriente()
  const cargos = items.filter(i => i.tipo === 'cargo' && i.estado !== 'cancelado' && i.saldoPendiente > 0)
  const map = new Map<string, { clienteId?: string; clienteNombre: string; clienteTipo: string; clienteTelefono?: string; saldoPendiente: number; cargosCount: number; ultimaActividad: string }>()
  for (const c of cargos) {
    const k = c.clienteId ?? c.clienteNombre.toLowerCase()
    if (!map.has(k)) map.set(k, { clienteId: c.clienteId, clienteNombre: c.clienteNombre, clienteTipo: c.clienteTipo, clienteTelefono: c.clienteTelefono, saldoPendiente: 0, cargosCount: 0, ultimaActividad: c.fecha })
    const g = map.get(k)!
    g.saldoPendiente += c.saldoPendiente
    g.cargosCount++
    if (c.fecha > g.ultimaActividad) g.ultimaActividad = c.fecha
  }
  return [...map.values()].sort((a, b) => b.saldoPendiente - a.saldoPendiente)
}

// ── Stock Movimientos ─────────────────────────────────────────────────────────
export async function getStockMovimientos(): Promise<StockMovimiento[]> {
  return await read<StockMovimiento>('stock-movimientos')
}
export async function addStockMovimiento(data: Omit<StockMovimiento, 'id' | 'createdAt'>): Promise<StockMovimiento> {
  const items = await getStockMovimientos()
  const item: StockMovimiento = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('stock-movimientos', [...items, item])
  return item
}

// ── Listas de precios (meta) ──────────────────────────────────────────────────
export interface ListaMeta {
  filename: string
  items: number
  updatedAt: string
}

export async function getListasMeta(): Promise<Record<string, ListaMeta>> {
  return await readSingle<Record<string, ListaMeta>>('listas-meta', {})
}

export async function setListaMeta(proveedorId: string, meta: ListaMeta): Promise<void> {
  const all = await getListasMeta()
  await writeSingle('listas-meta', { ...all, [proveedorId]: meta })
}

export async function deleteListaMeta(proveedorId: string): Promise<void> {
  const all = await getListasMeta()
  delete all[proveedorId]
  await writeSingle('listas-meta', all)
}

// ── Listas de precios personalizadas ─────────────────────────────────────────
export interface ListaCustom {
  id: string
  nombre: string
  filename: string
  items: number
  color: string
  createdAt: string
  updatedAt: string
}

export async function getListasCustom(): Promise<ListaCustom[]> {
  return await readSingle<ListaCustom[]>('listas-custom', [])
}

export async function addListaCustom(data: Omit<ListaCustom, 'id' | 'createdAt' | 'updatedAt'>): Promise<ListaCustom> {
  const all = await getListasCustom()
  const item: ListaCustom = {
    id: uid(),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await writeSingle('listas-custom', [...all, item])
  return item
}

export async function updateListaCustom(id: string, data: Partial<Omit<ListaCustom, 'id' | 'createdAt'>>): Promise<ListaCustom | null> {
  const all = await getListasCustom()
  const idx = all.findIndex(l => l.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() }
  await writeSingle('listas-custom', all)
  return all[idx]
}

export async function deleteListaCustom(id: string): Promise<void> {
  await writeSingle('listas-custom', (await getListasCustom()).filter(l => l.id !== id))
}

// ── Módulos ───────────────────────────────────────────────────────────────────
const DEFAULT_MODULOS: Record<string, boolean> = {
  notasdash: true, imei: true,
  ordenes: true, servicios: true, clientes: true, agenda: true,
  stock: true, ventas: true, gastos: true, comisiones: true, reportes: true,
}
export async function getModulos(): Promise<Record<string, boolean>> {
  return await readSingle<Record<string, boolean>>('modulos', DEFAULT_MODULOS)
}
export async function setModulos(config: Record<string, boolean>): Promise<void> {
  await writeSingle<Record<string, boolean>>('modulos', config)
}

// ── Términos de garantía ──────────────────────────────────────────────────────
const DEFAULT_TERMINOS = `Términos y condiciones: 1. Todo equipo ingresado se registra en el sistema, detallando marca, modelo, número de IMEI (cuando sea visible) y el motivo por el que ingresa. 2. Se realizará una revisión general del equipo al momento de ingresarse siempre y cuando este no esté apagado o tenga alguna falla que no permita su revisión. 3. Posibles fallas ocultas o adicionales pueden ser detectadas recién durante el diagnóstico técnico y podrá implicar costos adicionales que se informarán al cliente antes de proceder. 4. Datos y respaldos: Microsmart no se responsabiliza por pérdida de información, configuraciones o datos del dispositivo durante la reparación, el cliente es responsable de realizar una copia de seguridad previa a la entrega del equipo. 5. Riesgo de reparaciones: El cliente reconoce que algunas reparaciones como la microsoldadura, es decir, reparaciones de placa, aperturas de equipos mojados o ya manipulados en otros servicios técnicos implican riesgos inherentes que pueden agravar fallas existentes o presentar nuevas fallas. Microsmart no será responsable por defectos adicionales que resulten de daños previos o desgaste natural del equipo. 6. Plazos de reparación y retiro: El tiempo de reparación será estimado al momento de la recepción, pero puede variar según diagnóstico o disponibilidad de repuestos. Los equipos deberán ser retirados en un plazo máximo de 30 días corridos luego de la notificación de reparación finalizada. Transcurrido dicho plazo, Microsmart no se responsabiliza por el almacenamiento seguro del equipo ni por daños o extravíos. 7. Costos y presupuestos: Todo presupuesto informado tiene una validez de 7 días. 8. Los diagnósticos de MacBook e iMac tienen un costo de $20.000. 9. Garantías aplicables: La reparación efectuada queda sujeta a las condiciones y políticas de garantía de Microsmart. 10. Aceptación de condiciones: Con la firma del comprobante de ingreso, el cliente declara haber leído, comprendido y aceptado estos términos y condiciones.`

export async function getTerminos(): Promise<string> {
  return await readSingle<string>('terminos', DEFAULT_TERMINOS)
}
export async function setTerminos(texto: string): Promise<void> {
  await writeSingle<string>('terminos', texto)
}

// ── Logo Local ────────────────────────────────────────────────────────────────
export async function getLogoLocal(): Promise<string> {
  return await readSingle<string>('logo', '')
}
export async function setLogoLocal(base64: string): Promise<void> {
  await writeSingle<string>('logo', base64)
}

// ── Nombre del negocio ────────────────────────────────────────────────────────
export async function getNombreNegocio(): Promise<string> {
  return await readSingle<string>('nombre-negocio', '')
}
export async function setNombreNegocio(nombre: string): Promise<void> {
  await writeSingle<string>('nombre-negocio', nombre)
}

// ── MercadoPago Cuentas ───────────────────────────────────────────────────────
export async function getMPCuentas(): Promise<MPCuenta[]> {
  return await read<MPCuenta>('mp-cuentas')
}
export async function addMPCuenta(data: Omit<MPCuenta, 'id' | 'createdAt'>): Promise<MPCuenta> {
  const items = await getMPCuentas()
  const item: MPCuenta = { id: uid(), ...data, createdAt: new Date().toISOString() }
  await write('mp-cuentas', [...items, item])
  return item
}
export async function updateMPCuenta(id: string, data: Partial<Omit<MPCuenta, 'id' | 'createdAt'>>): Promise<MPCuenta | null> {
  const items = await getMPCuentas()
  const idx = items.findIndex(i => i.id === id)
  if (idx < 0) return null
  items[idx] = { ...items[idx], ...data }
  await write('mp-cuentas', items)
  return items[idx]
}
export async function deleteMPCuenta(id: string): Promise<void> {
  await write('mp-cuentas', (await getMPCuentas()).filter(i => i.id !== id))
}

// ── Reglas de Comisión Automática ────────────────────────────────────────────
export async function getReglasComision(): Promise<ReglaComision[]> {
  return await readSingle<ReglaComision[]>('reglas-comision', [])
}
export async function setReglasComision(reglas: ReglaComision[]): Promise<void> {
  await writeSingle<ReglaComision[]>('reglas-comision', reglas)
}

// ── Reglas de Comisión Gremio (B2B) ──────────────────────────────────────────
export async function getReglasComisionGremio(): Promise<ReglaComisionGremio[]> {
  return await readSingle<ReglaComisionGremio[]>('reglas-comision-gremio', [])
}
export async function setReglasComisionGremio(reglas: ReglaComisionGremio[]): Promise<void> {
  await writeSingle<ReglaComisionGremio[]>('reglas-comision-gremio', reglas)
}

// ── Garantía de Comprobante de Retiro ─────────────────────────────────────────
const DEFAULT_GARANTIA_RETIRO = `CONDICIONES DE GARANTÍA: Los trabajos de reparación realizados tienen una garantía de 90 días por mano de obra, contados desde la fecha de entrega del equipo. Los repuestos instalados tienen garantía conforme a las condiciones del fabricante/proveedor. La garantía no cubre daños producidos por golpes, líquidos, mal uso, intervención de terceros o fuerza mayor. Para hacer válida la garantía el equipo deberá ser presentado en nuestro local junto con este comprobante dentro del período vigente. Microsmart no se responsabiliza por datos almacenados en el dispositivo.`

export async function getGarantiaRetiro(): Promise<string> {
  return await readSingle<string>('garantia-retiro', DEFAULT_GARANTIA_RETIRO)
}
export async function setGarantiaRetiro(texto: string): Promise<void> {
  await writeSingle<string>('garantia-retiro', texto)
}

// ── Días de Garantía por Defecto ─────────────────────────────────────────────
export async function getDiasGarantiaDefault(): Promise<number> {
  return await readSingle<number>('dias-garantia-default', 90)
}
export async function setDiasGarantiaDefault(dias: number): Promise<void> {
  await writeSingle<number>('dias-garantia-default', dias)
}

// ── Estados de Orden ─────────────────────────────────────────────────────────
const DEFAULT_ESTADOS_ORDEN = ['Entrada', 'Técnico Saddi', 'Laboratorio', 'Salida de laboratorio', 'Salida']
export async function getEstadosOrden(): Promise<string[]> {
  return await readSingle<string[]>('estados-orden', DEFAULT_ESTADOS_ORDEN)
}
export async function setEstadosOrden(estados: string[]): Promise<void> {
  await writeSingle<string[]>('estados-orden', estados)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboard(): Promise<DashboardData> {
  const ventasCSF = await getVentasCSF()
  const ventasGremio = await getVentasGremio()
  const ventasCajaAll = await getVentasCaja()
  const gastosAll = await getGastos()
  const comisiones = await getComisiones()
  const turnos = await getTurnos()

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  const ventasB2C = sum(ventasCSF.map(v => v.ticket))
  const ventasB2B = sum(ventasGremio.map(v => v.equivARS))
  const ventasCaja = sum(ventasCajaAll.map(v => v.total))
  const totalIngresosBrutos = ventasB2C + ventasB2B + ventasCaja

  const costoRepuestosB2C = sum(ventasCSF.map(v => v.costoRepuestoPesos))
  const costoRepuestosB2B = sum(ventasGremio.map(v => v.costoRepuestos))
  const comisionesMP = sum(ventasCSF.map(v => v.comisionMP)) + sum(ventasGremio.map(v => v.comisionMP))
  const iibbTotal = sum(ventasCSF.map(v => v.iibb)) + sum(ventasGremio.map(v => v.iibb))

  const totalComisionesEmpleados = sum(comisiones.map(c => c.totalComision))
  const comisionesPorEmpleado: Record<string, number> = {}
  for (const c of comisiones) {
    comisionesPorEmpleado[c.empleado] = (comisionesPorEmpleado[c.empleado] ?? 0) + c.totalComision
  }

  const gastosLocal = sum(gastosAll.filter(g => g.tipo === 'local').map(g => g.montoARS))
  const gastosOficina = sum(gastosAll.filter(g => g.tipo === 'oficina').map(g => g.montoARS))
  const gastosFijos = sum(gastosAll.filter(g => g.tipo === 'fijos').map(g => g.montoARS))
  const totalGastos = gastosLocal + gastosOficina + gastosFijos

  const gananciaReal = totalIngresosBrutos - costoRepuestosB2C - costoRepuestosB2B
    - comisionesMP - iibbTotal - totalComisionesEmpleados - totalGastos

  return {
    totalIngresosBrutos, ventasB2C, ventasB2B,
    ventasCaja, cantidadVentasCaja: ventasCajaAll.length,
    costoRepuestosB2C, costoRepuestosB2B, comisionesMP, iibbTotal,
    totalComisionesEmpleados, comisionesPorEmpleado,
    gastosLocal, gastosOficina, gastosFijos, totalGastos,
    gananciaReal,
    cantidadVentasB2C: ventasCSF.length,
    cantidadVentasB2B: ventasGremio.length,
    cantidadTurnos: turnos.filter(t => t.estado === 'Pendiente').length,
    pendientesPago: comisiones.filter(c => c.pagada === 'Pendiente').length,
  }
}

// ─── Sesiones de Caja ────────────────────────────────────────────────────────
export async function getSesionesCaja(): Promise<SesionCaja[]> { return await read<SesionCaja>('sesiones-caja') }

export async function getSesionCajaByFecha(fecha: string): Promise<SesionCaja | undefined> {
  return (await getSesionesCaja()).find(s => s.fecha === fecha)
}

export async function getLastEfectivoEnCaja(): Promise<number> {
  const sesiones = (await getSesionesCaja())
    .filter(s => s.estado === 'cerrada' && s.efectivoEnCaja !== undefined)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  return sesiones[0]?.efectivoEnCaja ?? 0
}

export async function addSesionCaja(data: Omit<SesionCaja, 'id'>): Promise<SesionCaja> {
  const items = await getSesionesCaja()
  const item: SesionCaja = { id: uid(), ...data }
  await write('sesiones-caja', [...items, item])
  return item
}

export async function updateSesionCaja(id: string, data: Partial<SesionCaja>): Promise<SesionCaja | undefined> {
  const items = await getSesionesCaja()
  const idx = items.findIndex(s => s.id === id)
  if (idx === -1) return undefined
  items[idx] = { ...items[idx], ...data }
  await write('sesiones-caja', items)
  return items[idx]
}
