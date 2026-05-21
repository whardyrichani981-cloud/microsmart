// ─── Shared ──────────────────────────────────────────────────────────────────
export type MetodoPago = 'Transferencia' | 'Efectivo' | 'Mercado Pago' | 'Tarjeta Débito' | 'Tarjeta Crédito' | 'Cheque' | 'Cuenta Corriente'
export type Moneda = 'ARS $' | 'USD $'
export type EstadoTurno = 'Pendiente' | 'Confirmado' | 'Finalizado' | 'Cancelado' | 'Eliminado'
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

// ─── Equipos usados ──────────────────────────────────────────────────────────
export type EstadoEquipo = 'En stock' | 'Vendido' | 'Reservado' | 'En reparación'

export interface ChecklistFunciones {
  pantalla: boolean
  placa: boolean                    // placa lógica (logic board)
  microfonoNotas: boolean           // micrófono principal / notas de voz
  microfonoSelfie: boolean          // micrófono frontal / selfie
  microfonoCamaraZoom: boolean      // micrófono trasero / cámara zoom
  altavoz: boolean                  // auricular (earpiece)
  speaker: boolean                  // bocina inferior
  botonesVolumen: boolean
  botonPower: boolean
  faceId: boolean
  wifi: boolean
  senal: boolean                    // señal celular
  camaras: string[]                 // cámaras traseras OK: e.g. ['0.5x', '1x', '2x']
  camaraSelfie: boolean             // cámara frontal
  camaraRetratoSelfie: boolean      // modo retrato cámara selfie
  camaraRetratoPrincipal: boolean   // modo retrato cámara trasera principal
}

export interface EquipoUsado {
  id: string
  nOrden: number                // auto-incremental
  fecha: string
  modelo: string
  color: string
  capacidad: string
  imei: string
  bateria: number               // % de batería (0-100)
  funciones: ChecklistFunciones
  estado: EstadoEquipo          // siempre 'En stock' al crear
  precioCompra: number
  monedaCompra: 'ARS' | 'USD'
  precioVenta: number
  monedaVenta: 'ARS' | 'USD'
  proveedorId: string           // ref a ProveedorEquipo
  detallesFisicos: string       // estado físico del equipo
  fotos: string[]               // base64 data URIs
  // Venta (se rellenan al marcar como Vendido)
  vendidoA?: string
  vendidoTelefono?: string
  vendidoMail?: string
  vendidoTipoCliente?: string   // 'Persona' | 'Gremio' | 'Proveedor equipo' | 'Proveedor'
  fechaVenta?: string
  metodoPagoVenta?: MetodoPago
  createdAt: string
}

// ─── Compras a clientes particulares ─────────────────────────────────────────
export interface ReparacionEstimada {
  falla: string
  costoEstimado: number   // en ARS
}

export interface CompraCliente {
  id: string
  nOrden: number
  fecha: string
  // Datos del vendedor (cliente particular)
  nombreCliente: string
  telefonoCliente: string
  dniCliente: string
  fotoDniFrente: string   // base64 data URI
  fotoDniDorso: string    // base64 data URI
  // Equipo adquirido (copia de EquipoUsado sin id/createdAt/nOrden)
  modelo: string
  color: string
  capacidad: string
  imei: string
  bateria: number
  funciones: ChecklistFunciones
  detallesFisicos: string
  fotos: string[]
  // Financiero
  precioCompra: number
  monedaCompra: 'ARS' | 'USD'
  tipoCambio: number              // cotización usada
  reparaciones: ReparacionEstimada[]
  costoReparacionesARS: number    // suma automática
  precioVentaEstimado: number
  monedaVenta: 'ARS' | 'USD'
  gananciaEstimadaARS: number     // calculado
  // Referencia al equipo creado en stock/reparación
  equipoId: string
  notas: string
  createdAt: string
}

// ─── Proveedores de equipos usados ───────────────────────────────────────────
export interface ProveedorEquipo {
  id: string
  nombre: string
  apellido: string
  empresa: string          // razón social / nombre comercial
  cuil: string
  telefono: string
  direccion: string
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
  stockMinimo: number         // alerta cuando totalStock del grupo < stockMinimo (default 2)
  costoUnitario: number
  precioVenta?: number        // precio de venta al público (accesorios)
  moneda: Moneda
  costoTotalARS: number       // = stock * costoUnitario * tipoCambio if USD (auto)
  imagen?: string             // base64 data URI (accesorios)
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
  colorEquipo?: string
  imei: string
  modeloEquipo: string
  funciones?: ChecklistFunciones
  descripcionFalla: string
  accesorios: string
  contrasena: string
  // Asignación
  tecnico: string
  fechaEntrega: string
  garantia: boolean
  diasGarantia: number         // días de garantía desde la entrega (default 90)
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
  nPresupuestoRef?: number   // N° del presupuesto que originó esta orden
  ordenItems: OrdenItem[]
  notas2: string
  codigoSeguimiento?: string
  historial: HistorialItem[]
  notasLista: NotaOrden[]
  createdAt: string
  fechaEntregadoAt?: string    // timestamp cuando se marcó como Entregado
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
  direccion: string
  createdAt: string
}

// ─── MercadoPago ─────────────────────────────────────────────────────────────
export interface MPCuenta {
  id: string
  nombre: string        // alias descriptivo: "Cuenta principal", "Sharon", etc.
  accessToken: string   // MP Access Token
  createdAt: string
}

export interface MPMovimiento {
  id: string
  fecha: string                // ISO date
  tipo: 'transferencia' | 'tarjeta_credito' | 'tarjeta_debito' | 'qr' | 'otro'
  monto: number               // transaction_amount
  montoNeto: number           // net_amount (after MP fees)
  pagadorNombre: string       // payer name
  pagadorEmail: string
  descripcion: string         // payment description
  estado: string              // approved / pending / etc.
  metodoPago: string          // raw payment_method_id
  cuotas?: number
  cuentaId: string            // which MP account
}

// ─── Tipo de Cambio ───────────────────────────────────────────────────────────
export interface TipoCambio {
  id: string
  fecha: string
  valor: number               // ARS por USD
  fuente: string
  notas: string
}

// ─── Caja de mostrador (POS) ──────────────────────────────────────────────────
export interface CartItem {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  costoUnitario?: number  // precio de costo (del stock), para calcular ganancia
  tipo: 'repuesto' | 'accesorio' | 'telefono' | 'orden' | 'manual'
  refId?: string   // stock item id, equipo id, or orden id
}

export interface VentaCaja {
  id: string
  nVenta: number
  fecha: string    // YYYY-MM-DD
  hora: string     // HH:MM
  items: CartItem[]
  subtotal: number
  descuento: number
  total: number
  costoTotal?: number      // suma de costoUnitario * cantidad de cada item
  comisionMP?: number      // 4.5% si método = Mercado Pago
  iibb?: number            // 4% sobre total
  gananciaReal?: number    // total - costoTotal - comisionMP - iibb
  metodoPago: MetodoPago
  pagos?: { metodo: MetodoPago; monto: number }[]   // split payments (si hay >1 método)
  clienteNombre?: string
  clienteTelefono?: string
  clienteCuit?: string
  tipoFactura?: 'A' | 'B' | null
  tipoCliente?: 'clienteFinal' | 'gremio' | 'empresa'
  nOrdenRef?: number
  observaciones?: string
}

// ─── Cierre de Caja ──────────────────────────────────────────────────────────
export interface CierreCaja {
  id: string
  fecha: string          // YYYY-MM-DD
  fechaHoraCierre: string // ISO timestamp
  totalGeneral: number
  cantidadVentas: number
  desglosePorMetodo: Record<string, number>  // metodoPago → total
  ventaIds: string[]     // IDs de VentaCaja incluidas
  observaciones?: string
  abiertoPor?: string
  cerradoPor?: string
}

// ─── Sesión de Caja (apertura + cierre con fondo) ────────────────────────────
export type EstadoSesionCaja = 'abierta' | 'cerrada'

export interface AdminIntervencionCaja {
  fechaHora: string
  operador: string
  tipo: 'add_venta' | 'del_venta' | 'reabrir'
  detalle: string
}

export interface SesionCaja {
  id: string
  fecha: string                    // YYYY-MM-DD
  estado: EstadoSesionCaja
  // Apertura
  operadorApertura: string
  horaApertura: string             // ISO timestamp
  efectivoInicial: number          // fondo recibido del día anterior
  // Cierre (se completa al cerrar)
  operadorCierre?: string
  horaCierre?: string              // ISO timestamp
  efectivoVentasEfectivo?: number  // suma ventas método Efectivo ese día
  efectivoContado?: number         // lo que contó físicamente el operador
  diferencia?: number              // contado - (inicial + ventas efectivo)
  efectivoEnCaja?: number          // cuánto queda para el día siguiente
  efectivoRetirado?: number        // contado - enCaja
  totalGeneral?: number
  cantidadVentas?: number
  desglosePorMetodo?: Record<string, number>
  ventaIds?: string[]
  observaciones?: string
  intervencionesAdmin?: AdminIntervencionCaja[]
}

// ─── Presupuestos / Cotizaciones ─────────────────────────────────────────────
export interface PresupuestoItem {
  id: string
  descripcion: string
  tipo: 'servicio' | 'repuesto' | 'otro'
  refId?: string       // id del Servicio o StockItem seleccionado
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Presupuesto {
  id: string
  nPresupuesto: number
  fecha: string              // YYYY-MM-DD
  vigenciaDias: number       // días de validez (default 7)
  fechaVencimiento: string   // YYYY-MM-DD
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'vencido'

  // Cliente
  clienteTipo: 'clienteFinal' | 'empresa' | 'gremio'
  clienteNombre: string
  clienteTelefono?: string
  clienteEmail?: string
  clienteCuit?: string

  // Equipo
  equipoMarca?: string
  equipoModelo?: string
  equipoIMEI?: string
  equipoProblema?: string

  // Items
  items: PresupuestoItem[]
  subtotal: number
  descuento: number
  total: number

  // Meta
  tecnico?: string
  notas?: string
  createdAt: string
}

// ─── Cuenta Corriente ─────────────────────────────────────────────────────────
export type EstadoCCItem = 'pendiente' | 'parcial' | 'pagado' | 'cancelado'

export interface CCSnapshotOrden {
  nOrden: number
  tipo: 'Cliente final' | 'Gremio'
  nombreCliente: string
  modeloEquipo: string
  tipoServicio: string
  tecnico: string
  proveedor: string
  tipoRepuesto: string
  costoRepuestoUSD: number
  precioDolar: number
  costoRepuestoPesos: number
  costoRepuestos: number
  moneda: Moneda
  comisionVendedora: number
  comisionTecnico: number
  notas: string
  descripcionFalla?: string
}

export interface CuentaCorrienteItem {
  id: string
  fecha: string              // YYYY-MM-DD
  // Cliente
  clienteId?: string
  clienteTipo: 'persona' | 'empresa'
  clienteNombre: string
  clienteTelefono?: string
  // Financiero
  tipo: 'cargo' | 'pago'
  monto: number              // monto original del cargo / monto de este pago
  montoPagado: number        // acumulado pagado (solo cargo)
  saldoPendiente: number     // monto - montoPagado (solo cargo)
  estado: EstadoCCItem       // solo cargo
  cargoRefId?: string        // para 'pago': referencia al cargo que cancela
  // Concepto
  concepto: string           // "Orden #42 — iPhone 14 · Cambio de pantalla"
  referenciaId?: string      // orden.id
  referenciaTipo?: 'orden'
  referenciaNum?: number     // nOrden
  // Snapshot para poder generar venta al cobrar
  snapshotOrden?: CCSnapshotOrden
  // Cuándo se generó la VentaCaja al cobrar
  ventaCajaId?: string
  createdAt: string
}

// ─── Stock Movimientos ────────────────────────────────────────────────────────
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'

export interface StockMovimiento {
  id: string
  fecha: string             // ISO timestamp
  stockItemId: string       // id del StockItem
  tipo: TipoMovimiento
  delta: number             // +N entrada / -N salida
  stockAntes: number
  stockDespues: number
  motivo: string            // 'Ingreso de stock', 'Venta en caja', 'Uso en orden #X', etc.
  referencia?: string       // texto libre — nOrden, nVenta, etc.
  // Datos denormalizados para display rápido
  repuesto: string
  modelo: string
  tipoStock: TipoStock
  createdAt: string
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
  // Caja mostrador
  ventasCaja: number
  cantidadVentasCaja: number
  // Contadores
  cantidadVentasB2C: number
  cantidadVentasB2B: number
  cantidadTurnos: number
  pendientesPago: number      // comisiones pendientes de pago
}
