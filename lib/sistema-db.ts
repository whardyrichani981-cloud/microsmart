// Server-only — never import from client components
import fs from 'fs'
import path from 'path'
import type {
  Turno, VentaCSF, VentaGremio, Gasto, Comision, StockItem,
  ClienteB2B, ClientePersona, Proveedor, TipoCambio, DashboardData, TipoGasto, TipoStock,
  Orden, Servicio, ReglaComision, ReglaComisionGremio, EquipoUsado, ProveedorEquipo, CompraCliente, VentaCaja,
} from './sistema-types'

const DATA_DIR = path.join(process.cwd(), 'data')

function file(name: string) { return path.join(DATA_DIR, `sistema-${name}.json`) }

function read<T>(name: string): T[] {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf-8')) as T[] }
  catch { return [] }
}
function write<T>(name: string, data: T[]): void {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf-8')
}
function readSingle<T>(name: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf-8')) as T }
  catch { return fallback }
}
function writeSingle<T>(name: string, data: T): void {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf-8')
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

// ── Tipo de Cambio ────────────────────────────────────────────────────────────
export function getTipoCambio(): TipoCambio[] { return read<TipoCambio>('tipo-cambio') }
export function getUltimoDolar(): number {
  const tc = getTipoCambio()
  if (!tc.length) return 1200
  return tc.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].valor
}
export function addTipoCambio(data: Omit<TipoCambio, 'id'>): TipoCambio {
  const items = getTipoCambio()
  const item: TipoCambio = { id: uid(), ...data }
  write('tipo-cambio', [...items, item])
  return item
}
export function deleteTipoCambio(id: string): void {
  write('tipo-cambio', getTipoCambio().filter(i => i.id !== id))
}

// ── Turnos ────────────────────────────────────────────────────────────────────
export function getTurnos(): Turno[] { return read<Turno>('turnos') }
export function addTurno(data: Omit<Turno, 'id' | 'createdAt'>): Turno {
  const items = getTurnos()
  const item: Turno = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('turnos', [...items, item])
  return item
}
export function updateTurno(id: string, data: Partial<Turno>): Turno | null {
  const items = getTurnos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('turnos', items)
  return items[idx]
}
export function deleteTurno(id: string): void {
  write('turnos', getTurnos().filter(i => i.id !== id))
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

export function getNextOrdenCSF(): number {
  const items = getVentasCSF()
  const valid = items.map(v => Number(v.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 10001
  return Math.max(...valid) + 1
}

export function getVentasCSF(): VentaCSF[] { return read<VentaCSF>('ventas-csf') }
export function addVentaCSF(data: Omit<VentaCSF, 'id' | 'createdAt'>): VentaCSF {
  const items = getVentasCSF()
  const item: VentaCSF = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('ventas-csf', [...items, item])
  return item
}
export function updateVentaCSF(id: string, data: Partial<VentaCSF>): VentaCSF | null {
  const items = getVentasCSF()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('ventas-csf', items)
  return items[idx]
}
export function deleteVentaCSF(id: string): void {
  write('ventas-csf', getVentasCSF().filter(i => i.id !== id))
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

export function getNextOrdenGremio(): number {
  const items = getVentasGremio()
  const valid = items.map(v => Number(v.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 20001
  return Math.max(...valid) + 1
}

export function getVentasGremio(): VentaGremio[] { return read<VentaGremio>('ventas-gremio') }
export function addVentaGremio(data: Omit<VentaGremio, 'id' | 'createdAt'>): VentaGremio {
  const items = getVentasGremio()
  const item: VentaGremio = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('ventas-gremio', [...items, item])
  return item
}
export function updateVentaGremio(id: string, data: Partial<VentaGremio>): VentaGremio | null {
  const items = getVentasGremio()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('ventas-gremio', items)
  return items[idx]
}
export function deleteVentaGremio(id: string): void {
  write('ventas-gremio', getVentasGremio().filter(i => i.id !== id))
}

// ── Gastos ────────────────────────────────────────────────────────────────────
export function getGastos(tipo?: TipoGasto): Gasto[] {
  const all = read<Gasto>('gastos')
  return tipo ? all.filter(g => g.tipo === tipo) : all
}
export function addGasto(data: Omit<Gasto, 'id' | 'createdAt'>): Gasto {
  const items = getGastos()
  const item: Gasto = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('gastos', [...items, item])
  return item
}
export function updateGasto(id: string, data: Partial<Gasto>): Gasto | null {
  const items = getGastos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('gastos', items)
  return items[idx]
}
export function deleteGasto(id: string): void {
  write('gastos', getGastos().filter(i => i.id !== id))
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

export function getComisiones(empleado?: string): Comision[] {
  const all = read<Comision>('comisiones')
  return empleado ? all.filter(c => c.empleado === empleado) : all
}
export function addComision(data: Omit<Comision, 'id' | 'createdAt'>): Comision {
  const items = getComisiones()
  const item: Comision = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('comisiones', [...items, item])
  return item
}
export function updateComision(id: string, data: Partial<Comision>): Comision | null {
  const items = getComisiones()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('comisiones', items)
  return items[idx]
}
export function deleteComision(id: string): void {
  write('comisiones', getComisiones().filter(i => i.id !== id))
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

export function getStock(tipo?: TipoStock): StockItem[] {
  const all = read<StockItem>('stock')
  return tipo ? all.filter(s => s.tipo === tipo) : all
}
export function addStockItem(data: Omit<StockItem, 'id' | 'updatedAt'>): StockItem {
  const items = getStock()
  const item: StockItem = { id: uid(), ...data, updatedAt: new Date().toISOString() }
  write('stock', [...items, item])
  return item
}
export function updateStockItem(id: string, data: Partial<StockItem>): StockItem | null {
  const items = getStock()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() }
  write('stock', items)
  return items[idx]
}
export function deleteStockItem(id: string): void {
  write('stock', getStock().filter(i => i.id !== id))
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

export function getNextOrdenNum(): number {
  const items = getOrdenes()
  const valid = items.map(o => Number(o.nOrden)).filter(n => isFinite(n) && n > 0)
  if (!valid.length) return 1
  return Math.max(...valid) + 1
}

function genCodigoSeguimiento(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function getOrdenes(): Orden[] { return read<Orden>('ordenes') }
export function getOrdenByCodigo(codigo: string): Orden | null {
  const items = getOrdenes()
  return items.find(o => o.codigoSeguimiento === codigo.toUpperCase()) ?? null
}
export function addOrden(data: Omit<Orden, 'id' | 'createdAt'>): Orden {
  const items = getOrdenes()
  const item: Orden = { id: uid(), codigoSeguimiento: genCodigoSeguimiento(), ...data, createdAt: new Date().toISOString() }
  write('ordenes', [...items, item])
  return item
}
export function updateOrden(id: string, data: Partial<Orden>): Orden | null {
  const items = getOrdenes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('ordenes', items)
  return items[idx]
}
export function deleteOrden(id: string): void {
  write('ordenes', getOrdenes().filter(i => i.id !== id))
}

// ── Servicios ─────────────────────────────────────────────────────────────────
export function getServicios(): Servicio[] { return read<Servicio>('servicios') }
export function addServicio(data: Omit<Servicio, 'id' | 'createdAt'>): Servicio {
  const items = getServicios()
  const item: Servicio = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('servicios', [...items, item])
  return item
}
export function updateServicio(id: string, data: Partial<Servicio>): Servicio | null {
  const items = getServicios()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('servicios', items)
  return items[idx]
}
export function deleteServicio(id: string): void {
  write('servicios', getServicios().filter(i => i.id !== id))
}

// ── Clientes B2C (Personas) ───────────────────────────────────────────────────
export function getClientesPersonas(): ClientePersona[] { return read<ClientePersona>('clientes-personas') }
export function addClientePersona(data: Omit<ClientePersona, 'id' | 'createdAt'>): ClientePersona {
  const items = getClientesPersonas()
  const item: ClientePersona = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('clientes-personas', [...items, item])
  return item
}
export function updateClientePersona(id: string, data: Partial<ClientePersona>): ClientePersona | null {
  const items = getClientesPersonas()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('clientes-personas', items)
  return items[idx]
}
export function deleteClientePersona(id: string): void {
  write('clientes-personas', getClientesPersonas().filter(i => i.id !== id))
}

// ── Clientes B2B ──────────────────────────────────────────────────────────────
export function getClientes(): ClienteB2B[] { return read<ClienteB2B>('clientes') }
export function addCliente(data: Omit<ClienteB2B, 'id' | 'createdAt'>): ClienteB2B {
  const items = getClientes()
  const item: ClienteB2B = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('clientes', [...items, item])
  return item
}
export function updateCliente(id: string, data: Partial<ClienteB2B>): ClienteB2B | null {
  const items = getClientes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('clientes', items)
  return items[idx]
}
export function deleteCliente(id: string): void {
  write('clientes', getClientes().filter(i => i.id !== id))
}

// ── Proveedores ───────────────────────────────────────────────────────────────
export function getProveedores(): Proveedor[] { return read<Proveedor>('proveedores') }
export function addProveedor(data: Omit<Proveedor, 'id' | 'createdAt'>): Proveedor {
  const items = getProveedores()
  const item: Proveedor = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('proveedores', [...items, item])
  return item
}
export function updateProveedor(id: string, data: Partial<Proveedor>): Proveedor | null {
  const items = getProveedores()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('proveedores', items)
  return items[idx]
}
export function deleteProveedor(id: string): void {
  write('proveedores', getProveedores().filter(i => i.id !== id))
}

// ── Equipos usados ────────────────────────────────────────────────────────────
export function getEquipos(): EquipoUsado[] { return read<EquipoUsado>('equipos') }
export function addEquipo(data: Omit<EquipoUsado, 'id' | 'createdAt' | 'nOrden'>): EquipoUsado {
  const items = getEquipos()
  const nOrden = items.length > 0 ? Math.max(...items.map(i => i.nOrden ?? 0)) + 1 : 1
  const item: EquipoUsado = { id: uid(), nOrden, ...data, createdAt: new Date().toISOString() }
  write('equipos', [...items, item])
  return item
}
export function updateEquipo(id: string, data: Partial<EquipoUsado>): EquipoUsado | null {
  const items = getEquipos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('equipos', items)
  return items[idx]
}
export function deleteEquipo(id: string): void {
  write('equipos', getEquipos().filter(i => i.id !== id))
}

// ── Proveedores de equipos usados ─────────────────────────────────────────────
export function getProveedoresEquipos(): ProveedorEquipo[] { return read<ProveedorEquipo>('proveedores-equipos') }
export function addProveedorEquipo(data: Omit<ProveedorEquipo, 'id' | 'createdAt'>): ProveedorEquipo {
  const items = getProveedoresEquipos()
  const item: ProveedorEquipo = { id: uid(), ...data, createdAt: new Date().toISOString() }
  write('proveedores-equipos', [...items, item])
  return item
}
export function updateProveedorEquipo(id: string, data: Partial<ProveedorEquipo>): ProveedorEquipo | null {
  const items = getProveedoresEquipos()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('proveedores-equipos', items)
  return items[idx]
}
export function deleteProveedorEquipo(id: string): void {
  write('proveedores-equipos', getProveedoresEquipos().filter(i => i.id !== id))
}

// ── Compras a clientes particulares ───────────────────────────────────────────
export function getComprasClientes(): CompraCliente[] { return read<CompraCliente>('compras-clientes') }
export function addCompraCliente(data: Omit<CompraCliente, 'id' | 'createdAt' | 'nOrden'>): CompraCliente {
  const items = getComprasClientes()
  const nOrden = items.length > 0 ? Math.max(...items.map(i => i.nOrden ?? 0)) + 1 : 1
  const item: CompraCliente = { id: uid(), nOrden, ...data, createdAt: new Date().toISOString() }
  write('compras-clientes', [...items, item])
  return item
}
export function updateCompraCliente(id: string, data: Partial<CompraCliente>): CompraCliente | null {
  const items = getComprasClientes()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('compras-clientes', items)
  return items[idx]
}
export function deleteCompraCliente(id: string): void {
  write('compras-clientes', getComprasClientes().filter(i => i.id !== id))
}

// ── Ventas Caja (POS) ─────────────────────────────────────────────────────────
export function getVentasCaja(): VentaCaja[] { return read<VentaCaja>('ventas-caja') }
export function getNextVentaCajaNum(): number {
  const items = getVentasCaja()
  if (!items.length) return 1
  return Math.max(...items.map(v => v.nVenta ?? 0)) + 1
}
export function addVentaCaja(data: Omit<VentaCaja, 'id'>): VentaCaja {
  const items = getVentasCaja()
  const item: VentaCaja = { id: uid(), ...data }
  write('ventas-caja', [...items, item])
  return item
}
export function updateVentaCaja(id: string, data: Partial<VentaCaja>): VentaCaja | null {
  const items = getVentasCaja()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data }
  write('ventas-caja', items)
  return items[idx]
}
export function deleteVentaCaja(id: string): void {
  write('ventas-caja', getVentasCaja().filter(i => i.id !== id))
}

// ── Listas de precios (meta) ──────────────────────────────────────────────────
export interface ListaMeta {
  filename: string
  items: number
  updatedAt: string
}

export function getListasMeta(): Record<string, ListaMeta> {
  return readSingle<Record<string, ListaMeta>>('listas-meta', {})
}

export function setListaMeta(proveedorId: string, meta: ListaMeta): void {
  const all = getListasMeta()
  writeSingle('listas-meta', { ...all, [proveedorId]: meta })
}

export function deleteListaMeta(proveedorId: string): void {
  const all = getListasMeta()
  delete all[proveedorId]
  writeSingle('listas-meta', all)
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

export function getListasCustom(): ListaCustom[] {
  return readSingle<ListaCustom[]>('listas-custom', [])
}

export function addListaCustom(data: Omit<ListaCustom, 'id' | 'createdAt' | 'updatedAt'>): ListaCustom {
  const all = getListasCustom()
  const item: ListaCustom = {
    id: uid(),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  writeSingle('listas-custom', [...all, item])
  return item
}

export function updateListaCustom(id: string, data: Partial<Omit<ListaCustom, 'id' | 'createdAt'>>): ListaCustom | null {
  const all = getListasCustom()
  const idx = all.findIndex(l => l.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() }
  writeSingle('listas-custom', all)
  return all[idx]
}

export function deleteListaCustom(id: string): void {
  writeSingle('listas-custom', getListasCustom().filter(l => l.id !== id))
}

// ── Módulos ───────────────────────────────────────────────────────────────────
const DEFAULT_MODULOS: Record<string, boolean> = {
  notasdash: true, imei: true,
  ordenes: true, servicios: true, clientes: true, agenda: true,
  stock: true, ventas: true, gastos: true, comisiones: true, reportes: true,
}
export function getModulos(): Record<string, boolean> {
  return readSingle<Record<string, boolean>>('modulos', DEFAULT_MODULOS)
}
export function setModulos(config: Record<string, boolean>): void {
  writeSingle<Record<string, boolean>>('modulos', config)
}

// ── Términos de garantía ──────────────────────────────────────────────────────
const DEFAULT_TERMINOS = `Términos y condiciones: 1. Todo equipo ingresado se registra en el sistema, detallando marca, modelo, número de IMEI (cuando sea visible) y el motivo por el que ingresa. 2. Se realizará una revisión general del equipo al momento de ingresarse siempre y cuando este no esté apagado o tenga alguna falla que no permita su revisión. 3. Posibles fallas ocultas o adicionales pueden ser detectadas recién durante el diagnóstico técnico y podrá implicar costos adicionales que se informarán al cliente antes de proceder. 4. Datos y respaldos: Microsmart no se responsabiliza por pérdida de información, configuraciones o datos del dispositivo durante la reparación, el cliente es responsable de realizar una copia de seguridad previa a la entrega del equipo. 5. Riesgo de reparaciones: El cliente reconoce que algunas reparaciones como la microsoldadura, es decir, reparaciones de placa, aperturas de equipos mojados o ya manipulados en otros servicios técnicos implican riesgos inherentes que pueden agravar fallas existentes o presentar nuevas fallas. Microsmart no será responsable por defectos adicionales que resulten de daños previos o desgaste natural del equipo. 6. Plazos de reparación y retiro: El tiempo de reparación será estimado al momento de la recepción, pero puede variar según diagnóstico o disponibilidad de repuestos. Los equipos deberán ser retirados en un plazo máximo de 30 días corridos luego de la notificación de reparación finalizada. Transcurrido dicho plazo, Microsmart no se responsabiliza por el almacenamiento seguro del equipo ni por daños o extravíos. 7. Costos y presupuestos: Todo presupuesto informado tiene una validez de 7 días. 8. Los diagnósticos de MacBook e iMac tienen un costo de $20.000. 9. Garantías aplicables: La reparación efectuada queda sujeta a las condiciones y políticas de garantía de Microsmart. 10. Aceptación de condiciones: Con la firma del comprobante de ingreso, el cliente declara haber leído, comprendido y aceptado estos términos y condiciones.`

export function getTerminos(): string {
  return readSingle<string>('terminos', DEFAULT_TERMINOS)
}
export function setTerminos(texto: string): void {
  writeSingle<string>('terminos', texto)
}

// ── Logo Local ────────────────────────────────────────────────────────────────
export function getLogoLocal(): string {
  return readSingle<string>('logo', '')
}
export function setLogoLocal(base64: string): void {
  writeSingle<string>('logo', base64)
}

// ── Reglas de Comisión Automática ────────────────────────────────────────────
export function getReglasComision(): ReglaComision[] {
  return readSingle<ReglaComision[]>('reglas-comision', [])
}
export function setReglasComision(reglas: ReglaComision[]): void {
  writeSingle<ReglaComision[]>('reglas-comision', reglas)
}

// ── Reglas de Comisión Gremio (B2B) ──────────────────────────────────────────
export function getReglasComisionGremio(): ReglaComisionGremio[] {
  return readSingle<ReglaComisionGremio[]>('reglas-comision-gremio', [])
}
export function setReglasComisionGremio(reglas: ReglaComisionGremio[]): void {
  writeSingle<ReglaComisionGremio[]>('reglas-comision-gremio', reglas)
}

// ── Garantía de Comprobante de Retiro ─────────────────────────────────────────
const DEFAULT_GARANTIA_RETIRO = `CONDICIONES DE GARANTÍA: Los trabajos de reparación realizados tienen una garantía de 90 días por mano de obra, contados desde la fecha de entrega del equipo. Los repuestos instalados tienen garantía conforme a las condiciones del fabricante/proveedor. La garantía no cubre daños producidos por golpes, líquidos, mal uso, intervención de terceros o fuerza mayor. Para hacer válida la garantía el equipo deberá ser presentado en nuestro local junto con este comprobante dentro del período vigente. Microsmart no se responsabiliza por datos almacenados en el dispositivo.`

export function getGarantiaRetiro(): string {
  return readSingle<string>('garantia-retiro', DEFAULT_GARANTIA_RETIRO)
}
export function setGarantiaRetiro(texto: string): void {
  writeSingle<string>('garantia-retiro', texto)
}

// ── Días de Garantía por Defecto ─────────────────────────────────────────────
export function getDiasGarantiaDefault(): number {
  return readSingle<number>('dias-garantia-default', 90)
}
export function setDiasGarantiaDefault(dias: number): void {
  writeSingle<number>('dias-garantia-default', dias)
}

// ── Estados de Orden ─────────────────────────────────────────────────────────
const DEFAULT_ESTADOS_ORDEN = ['Entrada', 'Técnico Saddi', 'Laboratorio', 'Salida de laboratorio', 'Salida']
export function getEstadosOrden(): string[] {
  return readSingle<string[]>('estados-orden', DEFAULT_ESTADOS_ORDEN)
}
export function setEstadosOrden(estados: string[]): void {
  writeSingle<string[]>('estados-orden', estados)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function getDashboard(): DashboardData {
  const ventasCSF = getVentasCSF()
  const ventasGremio = getVentasGremio()
  const ventasCajaAll = getVentasCaja()
  const gastosAll = getGastos()
  const comisiones = getComisiones()
  const turnos = getTurnos()

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
