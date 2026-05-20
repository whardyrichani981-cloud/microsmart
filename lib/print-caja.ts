import type { VentaCaja } from './sistema-types'

interface NegocioInfo {
  nombre: string
  direccion: string
  telefono: string
  cuit: string
  puntoVenta: string
}

const NEGOCIO: NegocioInfo = {
  nombre: 'Microsmart',
  direccion: 'Argentina',
  telefono: '',
  cuit: '00-00000000-0',
  puntoVenta: '0001',
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)
}

export function printTicket(venta: VentaCaja) {
  const fecha = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Ticket #${venta.nVenta}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 8px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .big { font-size: 16px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .total-row { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
    @media print { @page { margin: 0; size: 80mm auto; } }
  </style></head><body>
  <div class="center bold big">${NEGOCIO.nombre}</div>
  <div class="center">Comprobante de venta</div>
  <div class="sep"></div>
  <div class="row"><span>Ticket N°</span><span>${String(venta.nVenta).padStart(8, '0')}</span></div>
  <div class="row"><span>Fecha</span><span>${fecha}</span></div>
  ${venta.clienteNombre ? `<div class="row"><span>Cliente</span><span>${venta.clienteNombre}</span></div>` : ''}
  <div class="sep"></div>
  ${venta.items.map(it => `
    <div class="row"><span>${it.nombre}</span><span></span></div>
    <div class="row"><span>  ${it.cantidad} x ${fmtARS(it.precioUnitario)}</span><span>${fmtARS(it.subtotal)}</span></div>
  `).join('')}
  <div class="sep"></div>
  ${venta.descuento > 0 ? `<div class="row"><span>Subtotal</span><span>${fmtARS(venta.subtotal)}</span></div>
  <div class="row"><span>Descuento</span><span>- ${fmtARS(venta.descuento)}</span></div>` : ''}
  <div class="row total-row"><span>TOTAL</span><span>${fmtARS(venta.total)}</span></div>
  <div class="row"><span>Pago</span><span>${venta.metodoPago}</span></div>
  <div class="sep"></div>
  <div class="center">¡Gracias por su compra!</div>
  <div class="center">Este comprobante no tiene validez fiscal.</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`
  const w = window.open('', '_blank', 'width=400,height=600')
  if (w) { w.document.write(html); w.document.close() }
}

export function printFactura(venta: VentaCaja, tipo: 'A' | 'B') {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const nroFactura = `${NEGOCIO.puntoVenta}-${String(venta.nVenta).padStart(8, '0')}`
  const netoGravado = tipo === 'A' ? Math.round(venta.total / 1.21) : venta.total
  const iva = tipo === 'A' ? venta.total - netoGravado : 0

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Factura ${tipo} ${nroFactura}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #000; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border: 2px solid #000; padding: 12px; margin-bottom: 12px; }
    .tipo-box { font-size: 48px; font-weight: 900; border: 3px solid #000; padding: 4px 20px; text-align: center; }
    h1 { font-size: 20px; font-weight: 900; }
    .section { border: 1px solid #000; padding: 10px; margin-bottom: 8px; }
    .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; margin-bottom: 6px; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #000; color: #fff; padding: 5px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #ccc; }
    .right { text-align: right; }
    .totals { width: 280px; margin-left: auto; border: 1px solid #000; }
    .totals td { padding: 4px 10px; }
    .total-final { font-size: 14px; font-weight: 900; background: #000; color: #fff; }
    .footer { margin-top: 16px; font-size: 9px; color: #666; text-align: center; }
    @media print { @page { size: A4; margin: 15mm; } }
  </style></head><body>
  <div class="header">
    <div>
      <h1>${NEGOCIO.nombre}</h1>
      <div>${NEGOCIO.direccion}</div>
      <div>CUIT: ${NEGOCIO.cuit}</div>
      <div>Tel: ${NEGOCIO.telefono}</div>
    </div>
    <div class="tipo-box">${tipo}</div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:bold">FACTURA ${tipo}</div>
      <div>N°: ${nroFactura}</div>
      <div>Fecha: ${fecha}</div>
      <div>Cond. IVA: ${tipo === 'A' ? 'Resp. Inscripto' : 'Consumidor Final'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del cliente</div>
    <div><b>Nombre / Razón social:</b> ${venta.clienteNombre || 'Consumidor Final'}</div>
    <div><b>CUIT / DNI:</b> ${venta.clienteCuit || '—'}</div>
    ${venta.clienteTelefono ? `<div><b>Teléfono:</b> ${venta.clienteTelefono}</div>` : ''}
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th class="right">Cant.</th>
      <th class="right">Precio Unit.</th><th class="right">Subtotal</th>
    </tr></thead>
    <tbody>
    ${venta.items.map((it, i) => `<tr>
      <td>${String(i + 1).padStart(3, '0')}</td>
      <td>${it.nombre}</td>
      <td class="right">${it.cantidad}</td>
      <td class="right">${fmtARS(it.precioUnitario)}</td>
      <td class="right">${fmtARS(it.subtotal)}</td>
    </tr>`).join('')}
    </tbody>
  </table>

  <table class="totals">
    ${venta.descuento > 0 ? `<tr><td>Subtotal</td><td class="right">${fmtARS(venta.subtotal)}</td></tr>
    <tr><td>Descuento</td><td class="right">- ${fmtARS(venta.descuento)}</td></tr>` : ''}
    ${tipo === 'A' ? `<tr><td>Neto gravado</td><td class="right">${fmtARS(netoGravado)}</td></tr>
    <tr><td>IVA 21%</td><td class="right">${fmtARS(iva)}</td></tr>` : ''}
    <tr class="total-final"><td><b>TOTAL</b></td><td class="right"><b>${fmtARS(venta.total)}</b></td></tr>
  </table>

  <div style="margin-top:8px;font-size:11px"><b>Forma de pago:</b> ${venta.metodoPago}</div>

  <div class="footer">
    Este comprobante no reemplaza a la factura electrónica oficial. Para obtener el CAE, procesar a través del sistema AFIP.
  </div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1500)}<\/script>
  </body></html>`
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (w) { w.document.write(html); w.document.close() }
}

export function printFacturaOrden(orden: {
  nOrden: number; nombreCliente: string; telefonoCliente?: string;
  modeloEquipo: string; tipoServicio?: string; montoCobrado: number;
  metodoPago: string; ordenItems?: Array<{ nombre: string; cantidad: number; precioUnitario: number; subtotal: number }>;
}, tipo: 'A' | 'B', nroFactura?: string) {
  const venta: VentaCaja = {
    id: '', nVenta: orden.nOrden,
    fecha: new Date().toISOString().slice(0, 10),
    hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    items: orden.ordenItems && orden.ordenItems.length > 0
      ? orden.ordenItems.map(it => ({ id: it.nombre, nombre: it.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.subtotal, tipo: 'manual' as const }))
      : [{ id: '1', nombre: `Servicio: ${orden.tipoServicio || 'Reparación'} — ${orden.modeloEquipo}`, cantidad: 1, precioUnitario: orden.montoCobrado, subtotal: orden.montoCobrado, tipo: 'manual' as const }],
    subtotal: orden.montoCobrado, descuento: 0, total: orden.montoCobrado,
    metodoPago: orden.metodoPago as import('./sistema-types').MetodoPago,
    clienteNombre: orden.nombreCliente,
    clienteTelefono: orden.telefonoCliente,
    nOrdenRef: orden.nOrden,
  }
  printFactura(venta, tipo)
}
