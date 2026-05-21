import type { Presupuesto } from './sistema-types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)
}

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABEL: Record<string, string> = {
  servicio: 'Servicio',
  repuesto: 'Repuesto',
  otro: 'Otro',
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'PENDIENTE',
  aceptado: 'ACEPTADO',
  rechazado: 'RECHAZADO',
  vencido: 'VENCIDO',
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: '#f59e0b',
  aceptado: '#22c55e',
  rechazado: '#ef4444',
  vencido: '#6b7280',
}

export function printPresupuesto(p: Presupuesto, negocio?: { nombre?: string; direccion?: string; telefono?: string; cuit?: string }) {
  const nombre    = negocio?.nombre    ?? 'Microsmart'
  const direccion = negocio?.direccion ?? ''
  const telefono  = negocio?.telefono  ?? ''
  const cuit      = negocio?.cuit      ?? ''

  const estadoColor = ESTADO_COLOR[p.estado] ?? '#f59e0b'
  const estadoLabel = ESTADO_LABEL[p.estado] ?? p.estado.toUpperCase()

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Presupuesto N° ${String(p.nPresupuesto).padStart(5, '0')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; background: #fff; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #111; }
    .brand h1 { font-size: 26px; font-weight: 900; letter-spacing: -1px; }
    .brand p { font-size: 11px; color: #555; margin-top: 2px; }
    .doc-info { text-align: right; }
    .doc-title { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
    .doc-num { font-size: 28px; font-weight: 900; color: #111; font-family: monospace; }
    .estado-badge {
      display: inline-block; padding: 3px 10px; border-radius: 4px;
      font-size: 11px; font-weight: 700; letter-spacing: 1px;
      background: ${estadoColor}22; color: ${estadoColor}; border: 1px solid ${estadoColor};
      margin-top: 4px;
    }

    /* Sections */
    .section { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px; }
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 16px; }
    .field label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 1px; }
    .field span { font-size: 12px; font-weight: 600; }

    /* Fechas */
    .fechas { display: flex; gap: 24px; margin-bottom: 12px; }
    .fecha-item { }
    .fecha-item .lbl { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .fecha-item .val { font-size: 13px; font-weight: 700; }

    /* Tabla de items */
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    thead tr { background: #111; color: #fff; }
    th { padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    th.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #e5e7eb; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    td { padding: 7px 10px; font-size: 11px; }
    td.right { text-align: right; font-family: monospace; }
    .tipo-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .tipo-servicio { background: #ede9fe; color: #6d28d9; }
    .tipo-repuesto { background: #dbeafe; color: #1d4ed8; }
    .tipo-otro     { background: #f3f4f6; color: #374151; }

    /* Totales */
    .totales { margin-left: auto; width: 260px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
    .totales table { margin: 0; }
    .totales td { padding: 6px 12px; border-bottom: 1px solid #eee; }
    .totales .total-row { background: #111; color: #fff; font-size: 14px; font-weight: 900; }
    .totales .total-row td { border-bottom: none; }

    /* Notas y vigencia */
    .nota-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
    .nota-box p { font-size: 11px; color: #333; line-height: 1.5; }

    /* Footer */
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center; }

    @media print {
      @page { size: A4; margin: 12mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <h1>${nombre}</h1>
      <p>Especialistas Apple</p>
      ${direccion ? `<p>${direccion}</p>` : ''}
      ${telefono ? `<p>Tel: ${telefono}</p>` : ''}
      ${cuit ? `<p>CUIT: ${cuit}</p>` : ''}
    </div>
    <div class="doc-info">
      <div class="doc-title">Presupuesto</div>
      <div class="doc-num">N° ${String(p.nPresupuesto).padStart(5, '0')}</div>
      <div class="estado-badge">${estadoLabel}</div>
    </div>
  </div>

  <!-- Fechas -->
  <div class="fechas">
    <div class="fecha-item">
      <div class="lbl">Fecha de emisión</div>
      <div class="val">${fmtFecha(p.fecha)}</div>
    </div>
    <div class="fecha-item">
      <div class="lbl">Válido hasta</div>
      <div class="val" style="color:${p.estado === 'vencido' ? '#ef4444' : '#111'}">${fmtFecha(p.fechaVencimiento)} (${p.vigenciaDias} días)</div>
    </div>
    ${p.tecnico ? `<div class="fecha-item"><div class="lbl">Técnico</div><div class="val">${p.tecnico}</div></div>` : ''}
  </div>

  <!-- Cliente -->
  <div class="section">
    <div class="section-title">Datos del cliente</div>
    <div class="grid2">
      <div class="field"><label>Nombre / Razón social</label><span>${p.clienteNombre}</span></div>
      <div class="field"><label>Tipo</label><span>${p.clienteTipo === 'empresa' ? 'Empresa' : p.clienteTipo === 'gremio' ? 'Gremio' : 'Cliente Final'}</span></div>
      ${p.clienteTelefono ? `<div class="field"><label>Teléfono</label><span>${p.clienteTelefono}</span></div>` : ''}
      ${p.clienteEmail ? `<div class="field"><label>Email</label><span>${p.clienteEmail}</span></div>` : ''}
      ${p.clienteCuit ? `<div class="field"><label>CUIT / DNI</label><span>${p.clienteCuit}</span></div>` : ''}
    </div>
  </div>

  <!-- Equipo -->
  ${(p.equipoMarca || p.equipoModelo || p.equipoIMEI || p.equipoProblema) ? `
  <div class="section">
    <div class="section-title">Datos del equipo</div>
    <div class="grid3">
      ${p.equipoMarca  ? `<div class="field"><label>Marca</label><span>${p.equipoMarca}</span></div>` : ''}
      ${p.equipoModelo ? `<div class="field"><label>Modelo</label><span>${p.equipoModelo}</span></div>` : ''}
      ${p.equipoIMEI   ? `<div class="field"><label>IMEI / Serie</label><span style="font-family:monospace">${p.equipoIMEI}</span></div>` : ''}
    </div>
    ${p.equipoProblema ? `<div style="margin-top:8px" class="field"><label>Problema / Síntoma</label><span>${p.equipoProblema}</span></div>` : ''}
  </div>` : ''}

  <!-- Items -->
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descripción</th>
        <th>Tipo</th>
        <th class="right">Cant.</th>
        <th class="right">Precio unit.</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${p.items.map((it, i) => `
      <tr>
        <td style="color:#888">${String(i + 1).padStart(2, '0')}</td>
        <td><strong>${it.descripcion}</strong></td>
        <td><span class="tipo-badge tipo-${it.tipo}">${TIPO_LABEL[it.tipo] ?? it.tipo}</span></td>
        <td class="right">${it.cantidad}</td>
        <td class="right">${fmtARS(it.precioUnitario)}</td>
        <td class="right"><strong>${fmtARS(it.subtotal)}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- Totales -->
  <div class="totales">
    <table>
      ${p.descuento > 0 ? `
      <tr><td>Subtotal</td><td class="right">${fmtARS(p.subtotal)}</td></tr>
      <tr><td>Descuento</td><td class="right">− ${fmtARS(p.descuento)}</td></tr>` : ''}
      <tr class="total-row"><td><strong>TOTAL</strong></td><td class="right"><strong>${fmtARS(p.total)}</strong></td></tr>
    </table>
  </div>

  <!-- Notas -->
  ${p.notas ? `
  <div class="nota-box">
    <div class="section-title" style="margin-bottom:4px">Notas / Observaciones</div>
    <p>${p.notas.replace(/\n/g, '<br>')}</p>
  </div>` : ''}

  <!-- Vigencia aviso -->
  <div class="nota-box" style="background:#fffbeb; border-color:#fde68a;">
    <p style="color:#92400e; font-size:10px;">
      ⚠️ Este presupuesto tiene validez por <strong>${p.vigenciaDias} días</strong> a partir de su emisión (hasta el <strong>${fmtFecha(p.fechaVencimiento)}</strong>).
      Los precios pueden variar luego de esa fecha. No tiene validez fiscal.
    </p>
  </div>

  <div class="footer">
    Presupuesto generado por ${nombre} · ${new Date().toLocaleString('es-AR')}
  </div>

  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1500)}<\/script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=1100')
  if (w) { w.document.write(html); w.document.close() }
}
