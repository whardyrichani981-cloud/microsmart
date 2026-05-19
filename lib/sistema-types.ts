// ─── Shared ──────────────────────────────────────────────────────────────────
export type MetodoPago = 'Transferencia' | 'Efectivo' | 'Mercado Pago' | 'Tarjeta Débito' | 'Tarjeta Crédito' | 'Cheque'
export type Moneda = 'ARS $' | 'USD $'
export type EstadoTurno = 'Pendiente' | 'Confirmado' | 'Finalizado' | 'Cancelado'
export type FuenteCliente = 'Instagram' | 'Facebook' | 'TikTok' | 'WhatsApp' | 'Referido' | 'Otro'
export type EstadoPago = 'Pendiente' | 'Pagada'
export type TipoServicio = 'Cambio pantalla' | 'Cambio batería' | 'Reparación placa' | 'Reparación cámara' | 'Reparación conector' | 'Desbloqueo' | 'Software' | 'Otro'
export type CategoriaGasto = 'Repuesto/Insumo' | 'Alquiler' | 'Servicios' | 'Sueldos' | 'Marketing' | 'Equipamiento' | 'Impuestos' | 'Otros'
export type CategoriaStock = 'Accesorios' | 'Altavoz' | 'Batería' | 'Cámara' | 'Chasis' | 'Flex' | 'Otro' | 'Pantalla/Módulo' | 'Parlante' | 'Vidrio trasero'

// ─── Turnos ───────────────────────────────────────────────────────────────────
export interface Turno {
  id: string
  fecha: string           // ISO date
  hora: string
  nombreCliente: string
  reparacion: string
  modeloEquipo: string
  telefono: string
  mail: string
  fuente: FuenteCliente
  estado: EstadoTurno
  notas: string
  createdAt: string
}

// ─── Ventas CSF (B2C) ─────────────────────────────────────────────────────────
export interface VentaCSF {
  id: string
  fecha: string
  nOrden: number
  nombreCliente: string
  tecnico: string             // 'Ronald' | 'Sharon' | 'Saddi'
  tipoServicio: TipoServicio
  modeloEquipo: string
  proveedor: string
  tipoRepuesto: string
  // Costos
  costoRepuestoUSD: number    // costo en USD
  precioDolar: number         // cotización usada
  costoRepuestoPesos: number  // = costoRepuestoUSD * precioDolar (auto)
  // Ticket
  ticket: number
  metodoPago: MetodoPago
  montoNetoRecibido: number   // = ticket (auto)
  // Deducciones (auto-calculadas)
  comisionMP: number          // 4.5% si MP, 0 otros
  iibb: number                // 4% del ticket
  // Comisiones (manual o %auto)
  comisionVendedora: number
  comisionTecnico: number
  // Resultado
  gananciaReal: number        // ticket - costos - comisiones
  notas: string
  createdAt: string
}

// ─── Ventas GREMIO (B2B) ─────────────────────────────────────────────────────
export interface VentaGremio {
  id: string
  fecha: string
  nOrden: number
  cliente: string
  tipoReparacion: string
  repuestosUsados: string
  costoRepuestos: number
  montoCobrado: number
  moneda: Moneda
  equivARS: number            // = montoCobrado * tipoCambio if USD (auto)
  metodoPago: MetodoPago
  montoNeto: number           // = equivARS (auto)
  comisionMP: number          // 4.5% si MP
  iibb: number                // 4%
  comisionTecnico: number
  gananciaReal: number
  notas: string
  createdAt: string
}

// ─── Gastos ───────────────────────────────────────────────────────────────────
export type TipoGasto = 'local' | 'oficina' | 'fijos'

export interface Gasto {
  id: string
  tipo: TipoGasto
  fecha: string
  descripcion: string
  categoria: CategoriaGasto
  pagadoPor: string           // 'Efectivo' | 'Tarjeta' | 'Transferencia' | nombre
  monto: number
  moneda: Moneda
  montoARS: number            // = monto * tipoCambio if USD (auto)
  notas: string
  createdAt: string
}

// ─── Comisiones ───────────────────────────────────────────────────────────────
export type Empleado = 'Ronald' | 'Sharon' | 'Saddi'

export interface Comision {
  id: string
  fecha: string
  empleado: Empleado
  nOrden: string
  tipo: 'B2C' | 'B2B' | 'B2C Accesorio'
  descripcion: string
  montoVenta: number
  porcentaje: number          // e.g. 40 = 40%
  comisionCalculada: number   // = montoVenta * porcentaje / 100 (auto)
  comisionFija: number        // monto fijo alternativo
  totalComision: number       // = comisionFija > 0 ? comisionFija : comisionCalculada (auto)
  pagada: EstadoPago
  createdAt: string
}

// ─── Reglas de comisión automática ───────────────────────────────────────────
export type TipoReglaComision = 'reparacion' | 'accesorio'

export interface ReglaComision {
  id: string
  tipo: TipoReglaComision   // 'reparacion' = items de servicio, 'accesorio' = items de producto
  empleado: Empleado
  porcentaje: number        // e.g. 10 = 10%
  comisionFija: number      // 0 = usar %, > 0 = monto fijo sin importar el %
  activa: boolean
  createdAt: string
}

// ─── Reglas de comisión Gremio (B2B) ─────────────────────────────────────────
export interface ReglaComisionGremio {
  id: string
  modelo: string          // modelo del equipo, o '*' para cualquiera
  tipoReparacion: string  // tipo de servicio, o '*' para cualquiera
  comisionFija: number    // monto fijo en pesos
  activa: boolean
  createdAt: string
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export type TipoStock = 'repuestos' | 'accesorios'

export interface StockItem {
  id: string
  tipo: TipoStock
  repuesto: string
  categoria: CategoriaStock
  modelo: string
  proveedor: string
  stock: number
  costoUnitario: number
  moneda: Moneda
  costoTotalARS: number       // = stock * costoUnitario * tipoCambio if USD (auto)
  notas: string
  updatedAt: string
}

// ─── Órdenes de trabajo ───────────────────────────────────────────────────────
export type EstadoOrden = 'Entrada' | 'Técnico Saddi' | 'Laboratorio' | 'Salida de laboratorio' | 'Salida' | 'Entregado'
export type TipoOrden = 'Cliente final' | 'Gremio'
export type PrioridadOrden = 'Normal' | 'Urgente'

export const ESTADOS_ORDEN: EstadoOrden[] = ['Entrada', 'Técnico Saddi', 'Laboratorio', 'Salida de laboratorio', 'Salida', 'Entregado']

export interface Orden {
  id: string
  nOrden: number
  fecha: string
  tipo: TipoOrden
  estado: EstadoOrden
  prioridad: PrioridadOrden
  // Cliente
  nombreCliente: string
  telefonoCliente: string
  mailCliente: string
  // Equipo
  categoriaDispositivo?: 'iPhone' | 'Mac/iPad'
  imei: string
  modeloEquipo: string
  descripcionFalla: string
  accesorios: string
  contrasena: string
  // Asignación
  tecnico: string
  fechaEntrega: string
  garantia: boolean
  // Financiero
  tipoServicio: TipoServicio
  proveedor: string
  tipoRepuesto: string
  repuestosUsados: string
  costoRepuestoUSD: number
  precioDolar: number
  costoRepuestoPesos: number
  costoRepuestos: number
  montoCobrado: number
  moneda: Moneda
  equivARS: number
  metodoPago: MetodoPago
  comisionMP: number
  iibb: number
  comisionVendedora: number
  comisionTecnico: number
  gananciaReal: number
  notas: string
  imagenes: string[]
  presupuesto: number
  adelanto: number
  ordenItems: OrdenItem[]
  notas2: string
  codigoSeguimiento?: string
  historial: HistorialItem[]
  notasLista: NotaOrden[]
  createdAt: string
}

export interface HistorialItem {
  id: string
  tipo: 'estado' | 'nota' | 'foto'
  descripcion: string
  fecha: string   // ISO datetime
  usuario: string
}

export interface NotaOrden {
  id: string
  texto: string
  visibilidad: 'publica' | 'privada'
  autor: string
  area: string    // ej: 'Técnico Saddi', 'Laboratorio', etc.
  fecha: string   // ISO datetime
}

export interface OrdenItem {
  id: string
  tipo: 'producto' | 'servicio' | 'manual'
  refId: string
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  // solo para tipo manual
  costo?: number
  ivaPercent?: number
  ivaImporte?: number
  // vinculado a una compra rápida (quick buy)
  gastoId?: string
}

export type TipoServicioGremio = 'Gremio' | 'Cliente final'

export interface Servicio {
  id: string
  tipo: TipoServicioGremio
  nombre: string
  descripcion: string
  precio: number
  categoria: string
  activo: boolean
  createdAt: string
}

// ─── Clientes B2C (Personas) ──────────────────────────────────────────────────
export interface ClientePersona {
  id: string
  nombre: string
  telefono: string
  mail: string
  dni: string
  notas: string
  createdAt: string
}

// ─── Clientes B2B ─────────────────────────────────────────────────────────────
export interface ClienteB2B {
  id: string
  nombre: string
  empresa: string
  telefono: string
  mail: string
  cuit: string
  condicionIVA: string
  direccion: string
  notas: string
  createdAt: string
}

// ─── Proveedores ──────────────────────────────────────────────────────────────
export interface Proveedor {
  id: string
  nombre: string
  contacto: string
  telefono: string
  mail: string
  web: string
  condicionesPago: string
  notas: string
  createdAt: string
}

// ─── Tipo de Cambio ───────────────────────────────────────────────────────────
export interface TipoCambio {
  id: string
  fecha: string
  valor: number               // ARS por USD
  fuente: string
  notas: string
}

// ─── Dashboard (computed) ─────────────────────────────────────────────────────
export interface DashboardData {
  // Ingresos
  totalIngresosBrutos: number
  ventasB2C: number
  ventasB2B: number
  // Costos variables
  costoRepuestosB2C: number
  costoRepuestosB2B: number
  comisionesMP: number
  iibbTotal: number
  // Comisiones empleados
  totalComisionesEmpleados: number
  comisionesPorEmpleado: Record<string, number>
  // Gastos
  gastosLocal: number
  gastosOficina: number
  gastosFijos: number
  totalGastos: number
  // Resultado
  gananciaReal: number
  // Contadores
  cantidadVentasB2C: number
  cantidadVentasB2B: number
  cantidadTurnos: number
  pendientesPago: number      // comisiones pendientes de pago
}
