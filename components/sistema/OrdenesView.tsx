'use client'
import { useState, useEffect } from 'react'
import { matchesAny } from '@/lib/search'
import type { Orden, EstadoOrden, MetodoPago, Moneda, TipoServicio, TipoOrden, ClientePersona, ClienteB2B, OrdenItem, StockItem, Servicio, HistorialItem, NotaOrden, Proveedor } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect, DictateButton,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'
import {
  getColores, getCameras,
  FUNCION_META, ALL_FUNCION_KEYS, GRUPOS_FUNCIONES,
  emptyChecklist, funcionesOk,
  type FuncionFija,
} from './equipo-data'
import type { ChecklistFunciones } from '@/lib/sistema-types'
import { OrdenesEstadosPanel } from './ConfiguracionView'
import GarantiasView from './GarantiasView'
import { printFacturaOrden } from '@/lib/print-caja'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR = '#4ade80'
const ESTADOS_ORDEN: EstadoOrden[] = ['Entrada', 'Técnico Saddi', 'Laboratorio', 'Salida de laboratorio', 'Salida']
const TECNICOS = ['Ronald', 'Sharon', 'Saddi'] as const
const METODOS: MetodoPago[] = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito']
const SERVICIOS: TipoServicio[] = ['Cambio pantalla', 'Cambio batería', 'Reparación placa', 'Reparación cámara', 'Reparación conector', 'Desbloqueo', 'Software', 'Otro']

const ESTADO_COLORS: Record<string, string> = {
  'Entrada': '#60a5fa',
  'Técnico Saddi': '#a78bfa',
  'Laboratorio': '#f472b6',
  'Salida de laboratorio': '#fb923c',
  'Salida': '#4ade80',
  'Entregado': 'var(--text-secondary)',
}
const DYNAMIC_COLORS = ['#a78bfa', '#f472b6', '#fb923c', '#34d399', '#fbbf24', '#38bdf8', '#c084fc', '#fb7185']
function getEstadoColor(estado: string, idx = 0) {
  return ESTADO_COLORS[estado] ?? DYNAMIC_COLORS[idx % DYNAMIC_COLORS.length]
}
const TECNICO_COLORS: Record<string, string> = {
  Ronald: '#4ade80',
  Sharon: '#f472b6',
  Saddi: '#60a5fa',
}

function formatDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

// ─── Tiempo de reparación ─────────────────────────────────────────────────────
function diasAbierta(orden: Orden): number {
  const inicio = orden.createdAt ? new Date(orden.createdAt) : new Date(orden.fecha)
  const fin = orden.fechaEntregadoAt ? new Date(orden.fechaEntregadoAt) : new Date()
  return Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000))
}

function diasBadgeColor(dias: number, entregado: boolean) {
  if (entregado) return 'var(--text-secondary)'
  if (dias <= 2)  return '#4ade80'
  if (dias <= 5)  return '#fbbf24'
  if (dias <= 10) return '#f97316'
  return '#ef4444'
}

function diasSinMovimiento(orden: Orden): number {
  // Último evento del historial, o en su defecto createdAt / fecha de ingreso
  const lastHistorial = orden.historial?.length
    ? orden.historial[orden.historial.length - 1].fecha
    : null
  const ref = lastHistorial || orden.createdAt || orden.fecha
  if (!ref) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000))
}

function SinMovimientoBadge({ orden }: { orden: Orden }) {
  if (orden.estado === 'Entregado') return null
  const dias = diasSinMovimiento(orden)
  if (dias < 5) return null
  const color = dias >= 10 ? '#ef4444' : '#f97316'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
      padding: '1px 6px', borderRadius: 6, marginTop: 2,
      background: `${color}15`, color, border: `1px solid ${color}40`,
    }} title={`Sin movimiento hace ${dias} día${dias !== 1 ? 's' : ''}`}>
      ⚠ {dias}d sin mov.
    </span>
  )
}

function DiasBadge({ orden }: { orden: Orden }) {
  const entregado = orden.estado === 'Entregado'
  const dias = diasAbierta(orden)
  const color = diasBadgeColor(dias, entregado)
  const label = entregado
    ? `✓ ${dias}d`
    : dias === 0 ? 'Hoy' : `${dias}d`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
      padding: '1px 6px', borderRadius: 6, marginTop: 3,
      background: entregado ? 'var(--border)' : `${color}18`,
      color,
      border: `1px solid ${color}44`,
    }} title={entregado ? `Entregado en ${dias} días` : `${dias} día${dias !== 1 ? 's' : ''} en taller`}>
      {entregado ? '✓' : '⏱'} {label}
    </span>
  )
}

function fmtARSPrint(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function printOrden(orden: Orden, logoBase64 = '', terminos = '') {
  const contrasena = (orden as any).contrasena ?? ''

  const itemsHTML = (orden.ordenItems ?? []).length > 0
    ? `<table class="items-table">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${(orden.ordenItems ?? []).map(it => `
            <tr>
              <td>${it.nombre ?? ''}</td>
              <td class="center">${it.cantidad}</td>
              <td class="right">${fmtARSPrint(it.subtotal)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty-items">Sin servicios/productos cargados aún</p>'

  // Una sola copia del contenido (se repite dos veces en el body)
  const copia = (label: string) => `
  <div class="copy">
    <!-- HEADER -->
    <div class="header">
      <div class="brand-area">
        ${logoBase64
          ? `<img src="${logoBase64}" alt="Logo" class="brand-logo" />`
          : `<div class="brand-name">Microsmart</div><div class="brand-sub">Reparación de dispositivos Apple</div>`
        }
      </div>
      <div class="order-box">
        <div class="order-num">Orden #${orden.nOrden}</div>
        <div class="order-date">Ingreso: ${formatDate(orden.fecha)}${orden.fechaEntrega ? `&nbsp;&nbsp;·&nbsp;&nbsp;Entrega est.: ${formatDate(orden.fechaEntrega)}` : ''}</div>
        <div class="copy-label">${label}</div>
        ${orden.prioridad === 'Urgente' ? '<div class="urgente-badge">⚡ URGENTE</div>' : ''}
      </div>
    </div>

    <!-- CLIENTE + EQUIPO -->
    <div class="two-col">
      <div class="section">
        <div class="section-title">Cliente</div>
        <div class="row"><span class="row-label">Nombre</span><span class="row-value large">${orden.nombreCliente || '—'}</span></div>
        <div class="row"><span class="row-label">Teléfono</span><span class="row-value">${orden.telefonoCliente || '—'}</span></div>
        ${(orden as any).mailCliente ? `<div class="row"><span class="row-label">Email</span><span class="row-value">${(orden as any).mailCliente}</span></div>` : ''}
        <div class="row"><span class="row-label">Tipo</span><span class="row-value">${orden.tipo}</span></div>
      </div>
      <div class="section">
        <div class="section-title">Equipo</div>
        <div class="row"><span class="row-label">Dispositivo</span><span class="row-value">${orden.categoriaDispositivo ?? 'iPhone'}</span></div>
        <div class="row"><span class="row-label">Modelo</span><span class="row-value large">${orden.modeloEquipo || '—'}</span></div>
        ${(orden as any).colorEquipo ? `<div class="row"><span class="row-label">Color</span><span class="row-value">${(orden as any).colorEquipo}</span></div>` : ''}
        <div class="row"><span class="row-label">IMEI / Serie</span><span class="row-value mono">${orden.imei || '—'}</span></div>
        <div class="row"><span class="row-label">Accesorios</span><span class="row-value">${orden.accesorios || '—'}</span></div>
        ${contrasena ? `<div class="row"><span class="row-label">Contraseña</span><span class="row-value mono contrasena">${contrasena}</span></div>` : ''}
      </div>
    </div>

    <!-- FALLA + TÉCNICO -->
    <div class="two-col">
      <div class="section">
        <div class="section-title">Falla descrita</div>
        <div class="description-box">${orden.descripcionFalla || '—'}</div>
        ${(orden.notas) ? `<div style="margin-top:6px;font-size:9px;color:#777;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Detalles físicos</div><div class="description-box">${orden.notas}</div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Servicio</div>
        <div class="row"><span class="row-label">Técnico</span><span class="row-value">${orden.tecnico || '—'}</span></div>
        ${orden.tipoServicio ? `<div class="row"><span class="row-label">Tipo</span><span class="row-value">${orden.tipoServicio}</span></div>` : ''}
        <div class="row"><span class="row-label">F. entrega est.</span><span class="row-value">${orden.fechaEntrega ? formatDate(orden.fechaEntrega) : '—'}</span></div>
      </div>
    </div>

    <!-- ITEMS -->
    <div class="full-section">
      <div class="section-title">Servicios y productos</div>
      ${itemsHTML}
    </div>

    <!-- FIRMAS -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-label">Firma del cliente — Conformidad de entrega</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-label">Firma del técnico responsable</div>
      </div>
    </div>
    ${(orden as any).codigoSeguimiento ? `
    <div style="margin-top:10px;padding:8px 10px;background:#f9f9f9;border:1px solid #e5e5e5;border-radius:5px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#777;margin-bottom:3px;">Seguimiento online</div>
        <div style="font-size:11px;font-weight:700;color:#111;font-family:monospace;letter-spacing:.1em;">${(orden as any).codigoSeguimiento}</div>
        <div style="font-size:8px;color:#888;margin-top:2px;">Ingresá este código en microsmart.com/seguimiento</div>
      </div>
      <div style="font-size:20px;">📱</div>
    </div>` : ''}

    ${terminos ? `
    <div style="margin-top:10px;padding:8px 10px;border:1px solid #e5e5e5;border-radius:5px;background:#fafafa;">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:5px;border-bottom:1px solid #e5e5e5;padding-bottom:3px;">Términos y condiciones</div>
      <div style="font-size:7px;color:#555;line-height:1.55;word-break:break-word;">${terminos.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    </div>` : ''}
  </div>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Orden #${orden.nOrden} — Microsmart</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111; background: #fff; }

    .copy { padding: 6px 14px 4px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 5px; border-bottom: 2px solid #111; margin-bottom: 5px; }
    .brand-area { display: flex; flex-direction: column; justify-content: center; }
    .brand-logo { max-height: 36px; max-width: 150px; object-fit: contain; display: block; }
    .brand-name { font-size: 15px; font-weight: 900; letter-spacing: -0.5px; }
    .brand-sub { font-size: 8px; color: #555; margin-top: 1px; }
    .order-box { text-align: right; }
    .order-num { font-size: 15px; font-weight: 900; }
    .order-date { font-size: 8px; color: #555; margin-top: 1px; }
    .copy-label { display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 20px; font-size: 8px; font-weight: 700; background: #f0f0f0; border: 1px solid #ccc; color: #555; }
    .urgente-badge { display: inline-block; margin-top: 2px; margin-left: 4px; padding: 1px 6px; border-radius: 20px; font-size: 8px; font-weight: 700; background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px; }
    .section { border: 1px solid #ddd; border-radius: 4px; padding: 5px 7px; }
    .section-title { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 3px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
    .row { display: flex; margin-bottom: 2px; align-items: baseline; }
    .row-label { font-size: 8px; color: #777; min-width: 68px; flex-shrink: 0; }
    .row-value { font-size: 8px; color: #111; font-weight: 600; flex: 1; }
    .row-value.large { font-size: 9.5px; font-weight: 700; }
    .row-value.mono { font-family: monospace; }
    .row-value.contrasena { font-size: 9.5px; font-weight: 700; background: #fffbeb; padding: 1px 4px; border-radius: 3px; border: 1px solid #fde68a; }
    .saldo-row { margin-top: 3px; padding-top: 3px; border-top: 1px solid #ddd; }
    .saldo-val { font-size: 9.5px; font-weight: 900; }

    .full-section { border: 1px solid #ddd; border-radius: 4px; padding: 5px 7px; margin-bottom: 5px; }
    .description-box { background: #f9f9f9; border-radius: 3px; padding: 3px 6px; font-size: 8px; color: #111; min-height: 18px; white-space: pre-wrap; word-break: break-word; }

    .items-table { width: 100%; border-collapse: collapse; font-size: 8px; }
    .items-table thead tr { background: #f0f0f0; }
    .items-table th { padding: 2px 5px; text-align: left; font-weight: 700; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border: 1px solid #ddd; }
    .items-table td { padding: 2px 5px; border: 1px solid #eee; }
    .items-table .center { text-align: center; }
    .items-table .right { text-align: right; font-family: monospace; }
    .empty-items { font-size: 8px; color: #999; font-style: italic; padding: 2px 0; }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 6px; padding-top: 5px; border-top: 1px solid #ddd; }
    .sig-line { border-bottom: 1px solid #111; height: 18px; margin-bottom: 2px; }
    .sig-label { font-size: 7.5px; color: #777; text-align: center; }

    /* ── Línea de corte ── */
    .cut-line {
      display: flex; align-items: center; gap: 0;
      margin: 0; padding: 0 14px;
      border: none;
    }
    .cut-dash { flex: 1; border-top: 1.5px dashed #aaa; }
    .cut-icon { font-size: 12px; color: #aaa; padding: 0 5px; line-height: 1; transform: rotate(-90deg); display: inline-block; }

    @media print {
      @page { margin: 5mm; size: A4 portrait; }
      body { font-size: 9px; }
      .copy { padding: 5px 12px 3px; page-break-inside: avoid; }
      .cut-line { margin: 1px 0; }
    }
  </style>
</head>
<body>

  ${copia('Copia cliente')}

  <!-- LÍNEA DE CORTE -->
  <div class="cut-line">
    <div class="cut-dash"></div>
    <span class="cut-icon">✂</span>
    <div class="cut-dash"></div>
  </div>

  ${copia('Copia local')}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=1000')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─── Comprobante de Retiro ────────────────────────────────────────────────────
function makeBarcodeHtml(nOrden: number): string {
  const s = String(nOrden).padStart(12, '0')
  // Encode128-like: alternate bar/space widths 1-3 derived from digits
  const widths = [3,1,2,1,1,2,1,3,2,1,1,3,2,1,2,1,3,1,1,2,1,1,3,2] // guard+start
  for (const ch of s) {
    const d = parseInt(ch)
    widths.push(d % 3 + 1, 1, (d * 3 + 1) % 3 + 1, 1, (d * 7 + 2) % 2 + 1, 1)
  }
  widths.push(2, 1, 3, 2, 1) // stop guard
  const bars = widths.map((w, i) =>
    `<div style="width:${w}px;height:100%;background:${i % 2 === 0 ? '#000' : 'transparent'}"></div>`
  ).join('')
  return `
    <div>
      <div style="display:inline-flex;align-items:stretch;height:38px;background:#fff;">${bars}</div>
      <div style="font-family:monospace;font-size:7px;text-align:center;color:#333;margin-top:1px;letter-spacing:.08em;">${String(nOrden).padStart(10, '0')}</div>
    </div>`
}

function printComprobante(orden: Orden, logoBase64 = '', garantia = '') {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtMoney = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const items = orden.ordenItems ?? []
  const total = items.reduce((s, it) => s + (it.subtotal ?? 0), 0)

  const itemsRows = items.length > 0
    ? items.map(it => {
        const iva = (it as any).ivaPercent ?? 0
        const pUnit = it.precioUnitario ?? (it.subtotal / it.cantidad)
        return `<tr>
          <td style="padding:4px 6px;border:1px solid #ddd;">${it.nombre ?? ''}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:center;">${Number(it.cantidad).toFixed(2)}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:right;">${fmtMoney(pUnit)}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:center;">0.00%</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:center;">${Number(iva).toFixed(2)}%</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:right;font-weight:700;">${fmtMoney(it.subtotal ?? 0)}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="6" style="padding:8px 6px;border:1px solid #ddd;color:#999;font-style:italic;">Sin servicios/productos cargados</td></tr>`

  const notas = ((orden as any).notasOrden ?? []) as Array<{ texto: string; fecha: string; autor?: string }>
  const notasRows = notas.length > 0
    ? notas.map(n => `<tr>
        <td style="padding:3px 6px;border:1px solid #ddd;white-space:nowrap;font-size:8px;">${n.fecha ? new Date(n.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:8px;">${n.texto ?? ''}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="padding:6px;border:1px solid #ddd;color:#999;font-style:italic;font-size:8px;">Sin notas</td></tr>`

  const printDate = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const nOrdenPad = String(orden.nOrden).padStart(6, '0')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Comprobante Retiro — Orden #${orden.nOrden}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111; background: #fff; }
    @media print { @page { margin: 8mm; size: A4 portrait; } }
  </style>
</head>
<body style="padding:14px 18px;">

  <!-- HEADER -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
    <tr>
      <td style="width:180px;vertical-align:middle;padding-right:12px;">
        ${logoBase64
          ? `<img src="${logoBase64}" alt="Logo" style="max-height:52px;max-width:170px;object-fit:contain;display:block;" />`
          : `<div style="font-size:20px;font-weight:900;letter-spacing:-0.5px;">Microsmart</div><div style="font-size:8px;color:#555;">Reparación de dispositivos Apple</div>`
        }
      </td>
      <td style="text-align:center;vertical-align:middle;padding:0 10px;">
        <div style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.04em;color:#111;">Comprobante Retiro de Equipo</div>
        <div style="font-size:8px;color:#666;margin-top:2px;">Fecha Impresión: ${printDate}</div>
        <div style="font-size:17px;font-weight:900;margin-top:4px;color:#111;">Orden N° ${nOrdenPad}</div>
        <div style="margin-top:5px;display:inline-block;">${makeBarcodeHtml(orden.nOrden)}</div>
      </td>
    </tr>
  </table>

  <!-- RETIRO DE EQUIPO -->
  <div style="border-top:2px solid #111;border-bottom:1px solid #ccc;padding:6px 0 8px;margin-bottom:10px;">
    <div style="font-size:11px;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Retiro de Equipo</div>
    <div style="font-size:8px;color:#333;font-style:italic;line-height:1.55;">
      Mediante el presente documento confirmo haber retirado y recibido el equipo que se describe a continuación.
      Declarando haber leído y estar completamente de acuerdo con la descripción del presente informe del trabajo realizado.
      Firmando el presente documento en total conformidad.
    </div>
  </div>

  <!-- DATOS CLIENTE / EQUIPO -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:8.5px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:5px 7px;border:1px solid #ccc;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.06em;">Datos del Cliente</th>
        <th style="padding:5px 7px;border:1px solid #ccc;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.06em;">Datos del Equipo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc;vertical-align:top;">
          <div><strong>Cliente:</strong> ${orden.nombreCliente || '—'}</div>
          ${orden.telefonoCliente ? `<div style="margin-top:3px;"><strong>Teléfono:</strong> ${orden.telefonoCliente}</div>` : ''}
          ${(orden as any).mailCliente ? `<div style="margin-top:3px;"><strong>Email:</strong> ${(orden as any).mailCliente}</div>` : ''}
        </td>
        <td style="padding:6px 8px;border:1px solid #ccc;vertical-align:top;">
          <div><strong>Marca:</strong> APPLE &nbsp;<strong>Modelo:</strong> ${orden.modeloEquipo || '—'}</div>
          <div style="margin-top:3px;"><strong>Serie/IMEI:</strong> ${orden.imei || '—'}</div>
          <div style="margin-top:3px;"><strong>Fecha ingreso:</strong> ${fmtDateTime(orden.fecha)}</div>
          ${orden.accesorios ? `<div style="margin-top:3px;"><strong>Accesorios:</strong> ${orden.accesorios}</div>` : ''}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:6px 8px;border:1px solid #ccc;">
          <strong>Trabajo:</strong> ${orden.descripcionFalla || '—'}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- SERVICIOS / PRODUCTOS -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:8.5px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.05em;width:40%;">Descripción productos/servicios aplicados</th>
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:8px;text-transform:uppercase;width:8%;">Cant.</th>
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:right;font-size:8px;text-transform:uppercase;width:14%;">P.Unitario</th>
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:8px;text-transform:uppercase;width:10%;">%Desc.</th>
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:8px;text-transform:uppercase;width:10%;">IVA</th>
        <th style="padding:4px 6px;border:1px solid #ccc;text-align:right;font-size:8px;text-transform:uppercase;width:18%;">Precio final</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-size:8px;color:#555;">Subtotal</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-weight:700;">${fmtMoney(total)}</td>
      </tr>
      <tr>
        <td colspan="5" style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-size:9px;font-weight:700;">Total</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-size:11px;font-weight:900;">${fmtMoney(total)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- NOTAS -->
  <div style="margin-bottom:10px;">
    <div style="font-size:8.5px;font-weight:700;margin-bottom:4px;">Notas:</div>
    <table style="width:100%;border-collapse:collapse;font-size:8.5px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:3px 6px;border:1px solid #ccc;text-align:left;width:70px;font-size:8px;text-transform:uppercase;">Fecha</th>
          <th style="padding:3px 6px;border:1px solid #ccc;text-align:left;font-size:8px;text-transform:uppercase;">Nota</th>
        </tr>
      </thead>
      <tbody>${notasRows}</tbody>
    </table>
  </div>

  <!-- OBSERVACIONES CLIENTE -->
  <div style="margin-bottom:12px;border:1px solid #ccc;border-radius:4px;padding:6px 8px;min-height:36px;">
    <div style="font-size:8px;font-weight:700;color:#555;margin-bottom:4px;">(Cliente) Observaciones / Reclamo</div>
    <div style="min-height:22px;"></div>
  </div>

  <!-- FIRMA -->
  <div style="display:flex;gap:30px;margin-bottom:14px;">
    <div style="flex:1;">
      <div style="border-bottom:1px solid #111;height:26px;margin-bottom:3px;"></div>
      <div style="font-size:7.5px;color:#666;text-align:center;">Firma del cliente — Conformidad de retiro</div>
    </div>
    <div style="flex:1;">
      <div style="border-bottom:1px solid #111;height:26px;margin-bottom:3px;"></div>
      <div style="font-size:7.5px;color:#666;text-align:center;">Aclaración</div>
    </div>
    <div style="flex:1;">
      <div style="border-bottom:1px solid #111;height:26px;margin-bottom:3px;"></div>
      <div style="font-size:7.5px;color:#666;text-align:center;">Responsable técnico</div>
    </div>
  </div>

  ${garantia ? `
  <!-- GARANTÍA -->
  <div style="border-top:1.5px solid #111;padding-top:7px;">
    <div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;color:#111;">Condiciones de Garantía</div>
    <div style="font-size:7.5px;color:#444;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${garantia.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  </div>` : ''}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=1100')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─── Etiqueta ─────────────────────────────────────────────────────────────────
function printEtiqueta(orden: Orden, logoBase64 = '', nombreNegocio = '') {
  const nOrdenPad = String(orden.nOrden).padStart(6, '0')
  const codigo    = orden.codigoSeguimiento ?? ''
  const seguimientoUrl = codigo ? `${window.location.origin}/seguimiento/${codigo}` : ''
  const qrUrl = seguimientoUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(seguimientoUrl)}&bgcolor=ffffff&color=111111&margin=4`
    : ''
  const esUrgente = orden.prioridad === 'Urgente'
  const falla     = (orden.descripcionFalla ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const cliente   = orden.nombreCliente.replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const equipo    = orden.modeloEquipo.replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Etiqueta #${nOrdenPad}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #ebebeb;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    @media print {
      @page { size: 100mm 88mm; margin: 2mm; }
      body { background: #fff; }
      .label { box-shadow: none; border-color: #ccc; }
      .cut { display: none; }
    }
    .label {
      width: 100mm;
      background: #fff;
      border: 1.5px solid #ccc;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.14);
    }
    /* ── Top strip ── */
    .top {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 10px 4px;
      border-bottom: 1px solid #eee;
    }
    .brand     { font-size: 11px; font-weight: 900; letter-spacing: 0.12em; color: #111; }
    .brand-sub { font-size: 6.5px; color: #aaa; letter-spacing: 0.06em; margin-top: 1px; }
    .brand-logo { max-height: 26px; max-width: 52mm; object-fit: contain; display: block; }
    .urgente   {
      font-size: 7px; font-weight: 900; letter-spacing: 0.07em;
      background: #ef4444; color: #fff;
      padding: 2px 7px; border-radius: 3px; text-transform: uppercase;
    }
    .n-badge { font-size: 8.5px; font-weight: 700; color: #888; }
    /* ── Body ── */
    .body {
      display: flex; align-items: flex-start;
      padding: 9px 10px 7px 11px; gap: 8px;
    }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .n-orden { font-size: 18px; font-weight: 900; color: #111; letter-spacing: -0.02em; line-height: 1; margin-bottom: 2px; }
    .f  { display: flex; flex-direction: column; gap: 1px; }
    .fl { font-size: 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; color: #bbb; }
    .fv { font-size: 9.5px; font-weight: 700; color: #111; line-height: 1.3; }
    .fv-falla { font-size: 8.5px; font-weight: 500; color: #555; line-height: 1.35; }
    /* ── QR ── */
    .qr { display: flex; flex-direction: column; align-items: center; gap: 3px; flex-shrink: 0; }
    .qr img { width: 39mm; height: 39mm; display: block; }
    .qr-lbl { font-size: 5.5px; color: #bbb; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
    /* ── Barcode ── */
    .bc-wrap {
      border-top: 1px solid #eee;
      padding: 5px 10px 6px;
      display: flex; justify-content: center; align-items: center;
    }
    .bc-wrap svg { max-width: 93mm; height: auto; }
    /* ── Cut line ── */
    .cut { text-align: center; font-size: 9px; color: #bbb; padding: 5px 0 0; }
  </style>
</head>
<body>
  <div style="display:flex;flex-direction:column;align-items:center;">
    <div class="label">

      <!-- Top strip -->
      <div class="top">
        <div>
          ${logoBase64
            ? `<img src="${logoBase64}" alt="Logo" class="brand-logo" />`
            : `<div class="brand">${(nombreNegocio || 'Mi negocio').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`
          }
        </div>
        <div style="display:flex;align-items:center;gap:7px;">
          ${esUrgente ? '<span class="urgente">⚡ Urgente</span>' : ''}
          <span class="n-badge">#${nOrdenPad}</span>
        </div>
      </div>

      <!-- Info + QR -->
      <div class="body">
        <div class="info">
          <div class="n-orden">Orden #${nOrdenPad}</div>
          <div class="f">
            <span class="fl">Cliente</span>
            <span class="fv">${cliente}</span>
          </div>
          <div class="f">
            <span class="fl">Equipo</span>
            <span class="fv">${equipo}</span>
          </div>
          ${falla ? `<div class="f">
            <span class="fl">Falla</span>
            <span class="fv-falla">${falla}</span>
          </div>` : ''}
        </div>
        ${qrUrl ? `<div class="qr">
          <img src="${qrUrl}" alt="QR" id="qr-img"/>
          <span class="qr-lbl">Seguimiento online</span>
        </div>` : ''}
      </div>

      <!-- Barcode -->
      <div class="bc-wrap">
        <svg id="barcode"></svg>
      </div>

    </div>
    <div class="cut">✂ — cortar aquí —</div>
  </div>

  <script>
    function renderAndPrint() {
      if (typeof JsBarcode === 'undefined') { setTimeout(renderAndPrint, 80); return; }
      JsBarcode('#barcode', '${nOrdenPad}', {
        format: 'CODE128',
        width: 1.9,
        height: 42,
        displayValue: true,
        fontSize: 10,
        margin: 2,
        lineColor: '#111',
        background: 'transparent',
        textMargin: 3,
        font: 'Arial',
      });
      ${qrUrl ? `
      var img = document.getElementById('qr-img');
      if (img && !img.complete) {
        img.onload  = function(){ setTimeout(function(){ window.print(); }, 150); };
        img.onerror = function(){ setTimeout(function(){ window.print(); }, 150); };
      } else { setTimeout(function(){ window.print(); }, 150); }
      ` : `setTimeout(function(){ window.print(); }, 150);`}
    }
    window.onload = renderAndPrint;
  <\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=540,height=480')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── ClienteCombo ─────────────────────────────────────────────────────────────
function ClienteCombo({ tipo, nombre, telefono, onNombre, onTelefono, onMail }: {
  tipo: TipoOrden
  nombre: string
  telefono: string
  onNombre: (v: string) => void
  onTelefono: (v: string) => void
  onMail?: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<ClientePersona[]>([])
  const [empresas, setEmpresas] = useState<ClienteB2B[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newMail, setNewMail] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newEmpresa, setNewEmpresa] = useState('')
  const [newCuit, setNewCuit] = useState('')
  const [creating, setCreating] = useState(false)
  const [prevOrdenes, setPrevOrdenes] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/sistema/clientes-personas').then(r => r.json()).then(setPersonas).catch(() => {})
    fetch('/api/sistema/clientes').then(r => r.json()).then(setEmpresas).catch(() => {})
  }, [])

  // Buscar historial cuando hay teléfono completo (10+ dígitos)
  useEffect(() => {
    const tel = telefono.replace(/\D/g, '')
    if (tel.length >= 8) {
      fetch('/api/sistema/ordenes')
        .then(r => r.json())
        .then((data: Orden[]) => {
          const count = data.filter(o =>
            o.telefonoCliente?.replace(/\D/g, '') === tel
          ).length
          setPrevOrdenes(count)
        })
        .catch(() => setPrevOrdenes(null))
    } else {
      setPrevOrdenes(null)
    }
  }, [telefono])

  useEffect(() => { setShowNew(false) }, [tipo])

  const list: (ClientePersona | ClienteB2B)[] = tipo === 'Cliente final' ? personas : empresas
  const q = nombre.trim().toLowerCase()
  const filtered = q.length >= 1
    ? list.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        (c.telefono ?? '').includes(nombre)
      ).slice(0, 8)
    : []

  const select = (c: ClientePersona | ClienteB2B) => {
    onNombre(c.nombre)
    onTelefono(c.telefono ?? '')
    if (onMail && 'mail' in c) onMail((c as { mail?: string }).mail ?? '')
    setOpen(false)
    setShowNew(false)
  }

  const handleCreate = async () => {
    // Para Gremio, si el nombre principal está vacío, usar la empresa como nombre
    const nombreFinal = nombre.trim() || newEmpresa.trim()
    if (!nombreFinal) return
    if (tipo === 'Cliente final' && !newDni.trim()) return
    if (tipo === 'Gremio' && !newCuit.trim()) return
    setCreating(true)
    try {
      if (tipo === 'Cliente final') {
        const res = await fetch('/api/sistema/clientes-personas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombreFinal, telefono, mail: newMail, dni: newDni, notas: '' }),
        })
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const created: ClientePersona = await res.json()
        setPersonas(p => [...p, created])
        onNombre(created.nombre)
        onTelefono(created.telefono ?? '')
      } else {
        const res = await fetch('/api/sistema/clientes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombreFinal, empresa: newEmpresa || nombreFinal, telefono, mail: newMail, cuit: newCuit, condicionIVA: 'Responsable Inscripto', direccion: '', notas: '' }),
        })
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const created: ClienteB2B = await res.json()
        setEmpresas(p => [...p, created])
        onNombre(created.nombre)
        onTelefono(created.telefono ?? '')
      }
      setShowNew(false)
      setNewMail(''); setNewDni(''); setNewEmpresa(''); setNewCuit('')
    } catch (e) {
      alert(`No se pudo guardar el cliente: ${String(e)}`)
    } finally { setCreating(false) }
  }

  // Para Gremio: alcanza con que empresa o nombre estén llenos + CUIT
  const nombreParaValidar = nombre.trim() || newEmpresa.trim()
  const canCreate = nombreParaValidar.length > 0 &&
    (tipo === 'Cliente final' ? newDni.trim().length > 0 : newCuit.trim().length > 0)

  const esNuevo = nombre.trim().length > 0 && !list.some(c => c.nombre.toLowerCase() === nombre.trim().toLowerCase())

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <AutoCapInput
            value={nombre}
            onChange={e => { onNombre(e.target.value); setOpen(true); setShowNew(false) }}
            onFocus={() => nombre.trim() && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            placeholder="Nombre del cliente"
            style={inputSt}
          />
          {open && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, marginTop: 3,
              maxHeight: 220, overflowY: 'auto',
              boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            }}>
              {filtered.map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => select(c)}
                  style={{
                    width: '100%', padding: '9px 12px', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--row-border)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{c.nombre}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {'dni' in c && c.dni ? `DNI: ${c.dni}` : ''}
                    {'cuit' in c && c.cuit ? `CUIT: ${c.cuit}` : ''}
                    {'empresa' in c && c.empresa ? ` · ${c.empresa}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowNew(s => !s)}
          title={showNew ? 'Cancelar' : 'Crear cliente nuevo'}
          style={{
            width: 38, borderRadius: 8, flexShrink: 0,
            background: showNew ? `${COLOR}22` : 'var(--surface2)',
            border: `1px solid ${showNew ? COLOR : 'var(--border)'}`,
            color: showNew ? COLOR : C.muted,
            cursor: 'pointer', fontSize: 20, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >{showNew ? '×' : '+'}</button>
      </div>

      {esNuevo && !showNew && nombre.trim().length > 1 && (
        <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚠ Cliente no encontrado</span>
          <button type="button" onClick={() => setShowNew(true)} style={{ background: 'none', border: 'none', color: COLOR, fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            → Crear nuevo
          </button>
        </div>
      )}

      {showNew && (
        <div style={{
          marginTop: 8, padding: '12px 14px', borderRadius: 8,
          background: 'var(--surface2)', border: `1px solid ${COLOR}44`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 10, letterSpacing: '0.05em' }}>
            ✨ CREAR CLIENTE — {tipo === 'Cliente final' ? 'Persona' : 'Empresa'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tipo === 'Cliente final' ? (
              <>
                <input type="tel" value={telefono} onChange={e => onTelefono(e.target.value)} placeholder="Teléfono (opcional)" style={{ ...inputSt, fontSize: 12 }} />
                <input value={newDni} onChange={e => setNewDni(e.target.value)} placeholder="DNI *" style={{ ...inputSt, fontSize: 12, borderColor: !newDni.trim() ? '#f87171' : undefined }} />
                <input type="email" value={newMail} onChange={e => setNewMail(e.target.value)} placeholder="Mail (opcional)" style={{ ...inputSt, fontSize: 12 }} />
              </>
            ) : (
              <>
                <input value={newEmpresa} onChange={e => setNewEmpresa(e.target.value)} placeholder="Empresa / Razón social" style={{ ...inputSt, fontSize: 12 }} />
                <input type="tel" value={telefono} onChange={e => onTelefono(e.target.value)} placeholder="Teléfono (opcional)" style={{ ...inputSt, fontSize: 12 }} />
                <input value={newCuit} onChange={e => setNewCuit(e.target.value)} placeholder="CUIT *" style={{ ...inputSt, fontSize: 12, borderColor: !newCuit.trim() ? '#f87171' : undefined }} />
                <input type="email" value={newMail} onChange={e => setNewMail(e.target.value)} placeholder="Mail (opcional)" style={{ ...inputSt, fontSize: 12 }} />
              </>
            )}
            <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !canCreate}
                style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                  background: !canCreate ? 'var(--border)' : COLOR,
                  color: !canCreate ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                  cursor: creating || !canCreate ? 'not-allowed' : 'pointer',
                }}
              >{creating ? 'Guardando...' : '✓ Guardar cliente'}</button>
              <button type="button" onClick={() => setShowNew(false)} style={{
                padding: '7px 14px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'none',
                color: C.muted, fontSize: 12, cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de reparaciones previas */}
      {prevOrdenes !== null && prevOrdenes > 0 && (
        <div style={{
          marginTop: 8, padding: '7px 12px', borderRadius: 7,
          background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)',
          fontSize: 12, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📋 <b>{prevOrdenes} reparación{prevOrdenes !== 1 ? 'es' : ''} anterior{prevOrdenes !== 1 ? 'es' : ''}</b> con este cliente
        </div>
      )}
      {prevOrdenes === 0 && telefono.replace(/\D/g, '').length >= 8 && (
        <div style={{
          marginTop: 8, padding: '6px 12px', borderRadius: 7,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
          fontSize: 12, color: '#4ade80',
        }}>
          🆕 Primera vez — no hay reparaciones anteriores con este teléfono
        </div>
      )}
    </div>
  )
}

// ─── HistorialClienteModal ────────────────────────────────────────────────────
function HistorialClienteModal({
  nombre, telefono, ordenActualId, onClose,
}: { nombre: string; telefono: string; ordenActualId: string; onClose: () => void }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sistema/ordenes')
      .then(r => r.json())
      .then((data: Orden[]) => {
        const matches = data.filter(o => {
          if (o.id === ordenActualId) return false
          if (telefono && o.telefonoCliente) {
            return o.telefonoCliente.replace(/\D/g, '') === telefono.replace(/\D/g, '')
          }
          return o.nombreCliente.toLowerCase() === nombre.toLowerCase()
        }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        setOrdenes(matches)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [nombre, telefono, ordenActualId])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        border: '1px solid var(--border)',
        width: '90%', maxWidth: 680, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: `${COLOR}22`, border: `2px solid ${COLOR}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: COLOR, flexShrink: 0,
          }}>
            {nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              📋 Historial de {nombre}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {loading ? 'Buscando…' : `${ordenes.length} reparación${ordenes.length !== 1 ? 'es' : ''} anterior${ordenes.length !== 1 ? 'es' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: 20, padding: '4px 8px', borderRadius: 6,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Buscando…</div>
          ) : ordenes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🆕</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Primera vez</div>
              <div style={{ fontSize: 13 }}>No hay reparaciones anteriores para este cliente</div>
            </div>
          ) : ordenes.map((o, i) => (
            <div key={o.id} style={{
              padding: '13px 20px',
              borderBottom: i < ordenes.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `${getEstadoColor(o.estado)}15`,
                border: `1px solid ${getEstadoColor(o.estado)}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 0,
              }}>
                <span style={{ fontSize: 9, color: C.muted, fontWeight: 700, lineHeight: 1 }}>#</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: getEstadoColor(o.estado), lineHeight: 1.2 }}>{o.nOrden}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {o.modeloEquipo || 'Sin modelo'}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                    background: `${getEstadoColor(o.estado)}18`, color: getEstadoColor(o.estado),
                  }}>{o.estado}</span>
                  {o.prioridad === 'Urgente' && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: '#ef444418', color: '#ef4444' }}>⚡ Urgente</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                  {o.tipoServicio || 'Sin tipo de servicio'}
                  {o.descripcionFalla ? ` · ${o.descripcionFalla.slice(0, 70)}${o.descripcionFalla.length > 70 ? '…' : ''}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                  <span>📅 {formatDate(o.fecha)}</span>
                  {o.tecnico && <span>👤 {o.tecnico}</span>}
                  {o.montoCobrado ? <span style={{ color: COLOR, fontWeight: 700 }}>💰 {fmtARS(o.montoCobrado)}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── HistorialEquipoModal ─────────────────────────────────────────────────────
function HistorialEquipoModal({
  imei, modelo, ordenActualId, onClose,
}: { imei: string; modelo: string; ordenActualId: string; onClose: () => void }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sistema/ordenes')
      .then(r => r.json())
      .then((data: Orden[]) => {
        const imeiClean = imei.replace(/\D/g, '')
        const matches = data.filter(o => {
          if (o.id === ordenActualId) return false
          if (imeiClean.length >= 6) {
            return o.imei?.replace(/\D/g, '') === imeiClean
          }
          // Fallback: mismo modelo (solo si no hay IMEI)
          return modelo && o.modeloEquipo?.toLowerCase() === modelo.toLowerCase()
        }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        setOrdenes(matches)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [imei, modelo, ordenActualId])

  const byImei = imei.replace(/\D/g, '').length >= 6

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        border: '1px solid var(--border)',
        width: '90%', maxWidth: 680, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(96,165,250,0.15)', border: '2px solid rgba(96,165,250,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>📱</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              🔧 Historial del equipo
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {modelo}{imei ? ` · ${imei}` : ''} ·{' '}
              {loading
                ? 'Buscando…'
                : `${ordenes.length} reparación${ordenes.length !== 1 ? 'es' : ''} anterior${ordenes.length !== 1 ? 'es' : ''}`
              }
            </div>
            {!byImei && modelo && (
              <div style={{ fontSize: 11, color: '#fb923c', marginTop: 2 }}>
                ⚠️ Sin IMEI — se busca por modelo (puede incluir equipos de otros clientes)
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: 20, padding: '4px 8px', borderRadius: 6,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Buscando…</div>
          ) : ordenes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🆕</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Primera reparación</div>
              <div style={{ fontSize: 13 }}>No hay reparaciones anteriores registradas para este equipo</div>
            </div>
          ) : ordenes.map((o, i) => (
            <div key={o.id} style={{
              padding: '13px 20px',
              borderBottom: i < ordenes.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `${getEstadoColor(o.estado)}15`,
                border: `1px solid ${getEstadoColor(o.estado)}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 0,
              }}>
                <span style={{ fontSize: 9, color: C.muted, fontWeight: 700, lineHeight: 1 }}>#</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: getEstadoColor(o.estado), lineHeight: 1.2 }}>{o.nOrden}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {o.nombreCliente}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                    background: `${getEstadoColor(o.estado)}18`, color: getEstadoColor(o.estado),
                  }}>{o.estado}</span>
                  {o.prioridad === 'Urgente' && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: '#ef444418', color: '#ef4444' }}>⚡ Urgente</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                  {o.tipoServicio || 'Sin tipo de servicio'}
                  {o.descripcionFalla ? ` · ${o.descripcionFalla.slice(0, 70)}${o.descripcionFalla.length > 70 ? '…' : ''}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                  <span>📅 {formatDate(o.fecha)}</span>
                  {o.tecnico && <span>👤 {o.tecnico}</span>}
                  {o.imei && <span style={{ fontFamily: 'monospace' }}>IMEI: {o.imei}</span>}
                  {o.montoCobrado ? <span style={{ color: COLOR, fontWeight: 700 }}>💰 {fmtARS(o.montoCobrado)}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── OrdenDetailPanel ────────────────────────────────────────────────────────
function fmtDateTime(iso: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs.'
  } catch { return iso }
}

function mkEntry(tipo: HistorialItem['tipo'], descripcion: string, usuario: string): HistorialItem {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tipo, descripcion, fecha: new Date().toISOString(), usuario }
}

// ─── ProveedorCombo ───────────────────────────────────────────────────────────
function ProveedorCombo({ value, onChange, proveedores }: {
  value: string
  onChange: (v: string) => void
  proveedores: Proveedor[]
}) {
  const [open, setOpen] = useState(false)
  const q = value.toLowerCase()
  const filtered = proveedores.filter(p => !q || p.nombre.toLowerCase().includes(q)).slice(0, 8)

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nombre del proveedor..."
        style={{ ...inputSt, fontSize: 12 }}
        autoFocus
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div className="dropdown-scroll" style={{ maxHeight: 180, overflowY: 'auto', overflowX: 'hidden' }}>
          {filtered.map(p => (
            <button
              key={p.id}
              onMouseDown={() => { onChange(p.nombre); setOpen(false) }}
              style={{
                width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none',
                border: 'none', borderBottom: '1px solid var(--row-border)',
                cursor: 'pointer', fontSize: 12, color: C.text,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {p.nombre}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers WhatsApp (module-scope) ─────────────────────────────────────────
const WA_DEFAULTS: Record<string, string> = {
  'Entrada':               'Hola {nombre} 👋 Tu {modelo} (orden #{nOrden}) ingresó al taller Microsmart. Te avisamos cuando esté listo.',
  'Técnico Saddi':         'Hola {nombre} 🔧 Tu {modelo} (orden #{nOrden}) está siendo revisado por nuestro técnico. Pronto te tenemos novedades.',
  'Laboratorio':           'Hola {nombre} 🔬 Tu {modelo} (orden #{nOrden}) está en laboratorio para diagnóstico avanzado.',
  'Salida de laboratorio': 'Hola {nombre} ✅ Tu {modelo} (orden #{nOrden}) salió del laboratorio y está siendo preparado para la entrega.',
  'Salida':                'Hola {nombre} 🎉 ¡Buenas noticias! Tu {modelo} (orden #{nOrden}) está LISTO para retirar. Te esperamos en el local. ¡Gracias por elegirnos!',
  'Entregado':             'Hola {nombre} 😊 Tu {modelo} fue entregado. ¡Gracias por confiar en Microsmart! Ante cualquier consulta, estamos a tu disposición.',
}

function buildWAMessage(
  orden: { nombreCliente?: string; modeloEquipo?: string; nOrden?: number },
  estado: string,
  config: Record<string, string> = {}
): string {
  const nombre = orden.nombreCliente?.split(' ')[0] ?? 'cliente'
  const modelo = orden.modeloEquipo || 'tu equipo'
  const nOrden = String(orden.nOrden ?? 0).padStart(4, '0')
  const template = config[estado] ?? WA_DEFAULTS[estado] ?? `Hola {nombre}, el estado de tu orden #{nOrden} ({modelo}) cambió a: ${estado}. — Microsmart`
  return template
    .replace(/{nombre}/g, nombre)
    .replace(/{modelo}/g, modelo)
    .replace(/{nOrden}/g, nOrden)
}

function formatWAPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) return digits
  if (digits.length === 10) return `549${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `549${digits.slice(1)}`
  return `549${digits}`
}

function OrdenDetailPanel({ orden, onBack, onEdit, onRefresh, currentUser, estadosOrdenConfig, logoLocal, nombreNegocioLocal, terminosLocal, garantiaRetiro, waMensajesConfig }: {
  orden: Orden
  onBack: () => void
  onEdit: () => void
  onRefresh: () => void
  currentUser: string
  estadosOrdenConfig: string[]
  logoLocal?: string
  nombreNegocioLocal?: string
  terminosLocal?: string
  garantiaRetiro?: string
  waMensajesConfig?: Record<string, string>
}) {
  const [detailTab, setDetailTab] = useState<'fotos' | 'notas' | 'historial'>('notas')
  const [uploading, setUploading] = useState(false)
  const [imagenes, setImagenes] = useState<string[]>(orden.imagenes ?? [])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [editingImei, setEditingImei] = useState(false)
  const [imeiValue, setImeiValue] = useState(orden.imei ?? '')
  const [savingImei, setSavingImei] = useState(false)
  const [editingModelo, setEditingModelo] = useState(false)
  const [modeloValue, setModeloValue] = useState(orden.modeloEquipo ?? '')
  const [colorValue, setColorValue] = useState((orden as any).colorEquipo ?? '')
  const [savingModelo, setSavingModelo] = useState(false)
  const [accionOpen, setAccionOpen] = useState(false)
  const [accionPos, setAccionPos] = useState<{ top: number; left: number } | null>(null)
  const [copiedDetail, setCopiedDetail] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [historialEquipoOpen, setHistorialEquipoOpen] = useState(false)
  const [notas2, setNotas2] = useState(orden.notas2 ?? '')
  const [savingNotas, setSavingNotas] = useState(false)

  // Notas individuales
  const [notasLista, setNotasLista] = useState<NotaOrden[]>(orden.notasLista ?? [])
  const [showNotaForm, setShowNotaForm] = useState(false)
  const [editingNota, setEditingNota] = useState<NotaOrden | null>(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [notaVisibilidad, setNotaVisibilidad] = useState<'publica' | 'privada'>('publica')
  const [notaArea, setNotaArea] = useState<string>(orden.estado)

  // Confirm entrega modal
  const [showEntregaConfirm, setShowEntregaConfirm] = useState(false)
  const [entregaLoading, setEntregaLoading] = useState(false)
  const [entregaMetodoPago, setEntregaMetodoPago] = useState<MetodoPago>(orden.metodoPago ?? 'Efectivo')
  const [entregaMonto, setEntregaMonto] = useState<number>(orden.montoCobrado ?? 0)
  const [entregaGarantia, setEntregaGarantia] = useState(orden.garantia ?? false)
  const [entregaDiasGarantia, setEntregaDiasGarantia] = useState(orden.diasGarantia ?? 90)
  const [entregaEsCC, setEntregaEsCC] = useState(false)

  // Factura prompt after entrega
  const [showFacturaPrompt, setShowFacturaPrompt] = useState(false)
  const [facturaOrden, setFacturaOrden] = useState<typeof orden | null>(null)

  // WhatsApp notification modal
  const [waModal, setWaModal] = useState<{ estado: string; mensaje: string } | null>(null)

  // Edición inline de cliente
  const [editingCliente, setEditingCliente] = useState(false)
  const [clienteNombre, setClienteNombre] = useState(orden.nombreCliente ?? '')
  const [clienteTelefono, setClienteTelefono] = useState(orden.telefonoCliente ?? '')
  const [clienteTipo, setClienteTipo] = useState<TipoOrden>(orden.tipo ?? 'Cliente final')
  const [savingCliente, setSavingCliente] = useState(false)

  const saveCliente = async () => {
    const nombre = clienteNombre.trim()
    if (!nombre) return
    setSavingCliente(true)
    try {
      const cambios: string[] = []
      if (nombre !== orden.nombreCliente) cambios.push(`Cliente: "${orden.nombreCliente}" → "${nombre}"`)
      if (clienteTelefono !== orden.telefonoCliente) cambios.push(`Teléfono: "${orden.telefonoCliente || '—'}" → "${clienteTelefono || '—'}"`)
      if (clienteTipo !== orden.tipo) cambios.push(`Tipo: "${orden.tipo}" → "${clienteTipo}"`)
      if (cambios.length === 0) { setEditingCliente(false); return }
      const entry = mkEntry('estado', cambios.join(' · '), currentUser)
      const newHist = [...(orden.historial ?? []), entry]
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, imagenes, nombreCliente: nombre, telefonoCliente: clienteTelefono, tipo: clienteTipo, historial: newHist }),
      })
      setEditingCliente(false)
      onRefresh()
    } finally { setSavingCliente(false) }
  }

  // Cargar días de garantía por defecto al abrir el modal
  useEffect(() => {
    if (showEntregaConfirm && !orden.garantia) {
      fetch('/api/sistema/dias-garantia')
        .then(r => r.json())
        .then((d: { dias: number }) => { setEntregaDiasGarantia(d.dias ?? 90) })
        .catch(() => {})
    }
  }, [showEntregaConfirm, orden.garantia])

  // Products/services section
  const [showAddProducto, setShowAddProducto] = useState(false)
  const [showAddServicio, setShowAddServicio] = useState(false)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [serviciosCatalog, setServiciosCatalog] = useState<Servicio[]>([])
  const [proveedoresList, setProveedoresList] = useState<Proveedor[]>([])
  const [ordenItems, setOrdenItems] = useState<OrdenItem[]>(orden.ordenItems ?? [])

  // Add producto state
  const [prodSearch, setProdSearch] = useState('')
  const [selectedProd, setSelectedProd] = useState<StockItem | null>(null)
  const [prodCantidad, setProdCantidad] = useState(1)
  const [prodPrecio, setProdPrecio] = useState(0)
  // Quick-purchase form (when stock = 0)
  const [showQuickBuy, setShowQuickBuy] = useState(false)
  const [quickBuyStep, setQuickBuyStep] = useState<'choose' | 'form'>('choose')
  const [quickProveedor, setQuickProveedor] = useState('')
  const [quickCosto, setQuickCosto] = useState(0)
  const [quickSaving, setQuickSaving] = useState(false)

  // Add servicio state
  const [servSearch, setServSearch] = useState('')
  const [selectedServ, setSelectedServ] = useState<Servicio | null>(null)
  const [servPrecio, setServPrecio] = useState(0)
  // Repuesto vinculado al servicio
  const [showServRepuesto, setShowServRepuesto] = useState(false)
  const [servRepSearch, setServRepSearch] = useState('')
  const [selectedServRep, setSelectedServRep] = useState<StockItem | null>(null)
  const [servRepCantidad, setServRepCantidad] = useState(1)
  const [showServQuickBuy, setShowServQuickBuy] = useState(false)
  const [servQuickBuyStep, setServQuickBuyStep] = useState<'choose' | 'form'>('choose')
  const [servQuickProveedor, setServQuickProveedor] = useState('')
  const [servQuickCosto, setServQuickCosto] = useState(0)
  const [servQuickSaving, setServQuickSaving] = useState(false)

  // Manual charge state
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualTipo, setManualTipo] = useState('Producto')
  const [manualDesc, setManualDesc] = useState('')
  const [manualCosto, setManualCosto] = useState(0)
  const [manualIva, setManualIva] = useState(0)   // porcentaje: 0, 10.5, 21

  const manualNetoSinIva = manualCosto
  const manualIvaImporte = Math.round(manualCosto * manualIva / 100 * 100) / 100
  const manualTotal = Math.round((manualCosto + manualIvaImporte) * 100) / 100

  useEffect(() => {
    fetch('/api/sistema/stock').then(r => r.json()).then((d: { items?: StockItem[] } | StockItem[]) => {
      if (Array.isArray(d)) setStockItems(d)
      else if (d && Array.isArray((d as { items?: StockItem[] }).items)) setStockItems((d as { items: StockItem[] }).items)
    }).catch(() => {})
    fetch('/api/sistema/servicios').then(r => r.json()).then((d: Servicio[]) => {
      if (Array.isArray(d)) setServiciosCatalog(d.filter(s => s.activo))
    }).catch(() => {})
    fetch('/api/sistema/proveedores').then(r => r.json()).then((d: Proveedor[]) => {
      if (Array.isArray(d)) {
        const EXCLUIR = ['cf', 'ampsentrix', 'originales']
        setProveedoresList(d.filter(p => !EXCLUIR.includes(p.nombre.toLowerCase().trim())))
      }
    }).catch(() => {})
  }, [])

  const cambiarEstadoDetalle = async (nuevoEstado: string) => {
    setAccionOpen(false)
    const entry = mkEntry('estado', `Estado cambiado de "${orden.estado}" a "${nuevoEstado}"`, currentUser)
    const newHist = [...(orden.historial ?? []), entry]
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, estado: nuevoEstado, historial: newHist }),
    })
    onRefresh()
  }

  const entregarEquipo = () => {
    setAccionOpen(false)
    setEntregaMetodoPago(orden.metodoPago ?? 'Efectivo')
    setEntregaMonto(orden.montoCobrado ?? 0)
    setEntregaEsCC(false)
    setShowEntregaConfirm(true)
  }

  const confirmarEntrega = async () => {
    setEntregaLoading(true)
    try {
      if (entregaEsCC) {
        // ── Modo Cuenta Corriente — NO registrar venta, crear cargo CC ────────
        await fetch('/api/sistema/cuenta-corriente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: today(),
            clienteTipo: orden.tipo === 'Cliente final' ? 'persona' : 'empresa',
            clienteNombre: orden.nombreCliente,
            clienteTelefono: orden.telefonoCliente,
            tipo: 'cargo',
            monto: entregaMonto,
            montoPagado: 0,
            saldoPendiente: entregaMonto,
            estado: 'pendiente',
            concepto: `Orden #${orden.nOrden} — ${orden.modeloEquipo || ''}${orden.tipoServicio ? ' · ' + orden.tipoServicio : ''}`,
            referenciaId: orden.id,
            referenciaTipo: 'orden',
            referenciaNum: orden.nOrden,
            snapshotOrden: {
              nOrden: orden.nOrden,
              tipo: orden.tipo,
              nombreCliente: orden.nombreCliente,
              modeloEquipo: orden.modeloEquipo,
              tipoServicio: orden.tipoServicio,
              tecnico: orden.tecnico,
              proveedor: orden.proveedor,
              tipoRepuesto: orden.tipoRepuesto,
              costoRepuestoUSD: orden.costoRepuestoUSD,
              precioDolar: orden.precioDolar,
              costoRepuestoPesos: orden.costoRepuestoPesos,
              costoRepuestos: orden.costoRepuestos,
              moneda: orden.moneda,
              comisionVendedora: orden.comisionVendedora,
              comisionTecnico: orden.comisionTecnico,
              notas: orden.notas,
              descripcionFalla: orden.descripcionFalla,
            },
          }),
        })
        // Saltar al bloque de stock y Entregado (sin venta ni comisiones)
      } else if (orden.tipo === 'Cliente final') {
        const ventaBody = {
          fecha: today(),
          nOrden: orden.nOrden,
          nombreCliente: orden.nombreCliente,
          tecnico: orden.tecnico,
          tipoServicio: orden.tipoServicio,
          modeloEquipo: orden.modeloEquipo,
          proveedor: orden.proveedor,
          tipoRepuesto: orden.tipoRepuesto,
          costoRepuestoUSD: orden.costoRepuestoUSD,
          precioDolar: orden.precioDolar,
          costoRepuestoPesos: orden.costoRepuestoPesos,
          ticket: entregaMonto,
          metodoPago: entregaMetodoPago,
          comisionVendedora: orden.comisionVendedora,
          comisionTecnico: orden.comisionTecnico,
          notas: orden.notas,
        }
        await fetch('/api/sistema/ventas-csf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ventaBody),
        })
      } else {
        const ventaBody = {
          fecha: today(),
          nOrden: orden.nOrden,
          cliente: orden.nombreCliente,
          tipoReparacion: orden.tipoServicio,
          repuestosUsados: orden.repuestosUsados,
          costoRepuestos: orden.costoRepuestos,
          montoCobrado: entregaMonto,
          moneda: orden.moneda,
          metodoPago: entregaMetodoPago,
          comisionTecnico: orden.comisionTecnico,
          notas: orden.notas,
        }
        await fetch('/api/sistema/ventas-gremio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ventaBody),
        })
      }

      // ── Auto-generar comisiones (solo si NO es CC — para CC se generan al cobrar) ───
      if (!entregaEsCC && orden.tipo === 'Cliente final') {
        try {
          const reglaRes = await fetch('/api/sistema/reglas-comision')
          if (reglaRes.ok) {
            const reglas: Array<{ id: string; tipo: string; empleado: string; porcentaje: number; comisionFija: number; activa: boolean }> = await reglaRes.json()
            const items = orden.ordenItems ?? []
            const totalServicios = items.filter(it => it.tipo === 'servicio').reduce((s, it) => s + (it.subtotal ?? 0), 0)
            const totalProductos = items.filter(it => it.tipo === 'producto' || it.tipo === 'manual').reduce((s, it) => s + (it.subtotal ?? 0), 0)

            // El empleado que recibe la comisión es el técnico asignado a la orden.
            // Si la orden no tiene técnico asignado, se usa el empleado configurado en la regla.
            const empleadoDestino = (orden.tecnico && orden.tecnico.trim()) ? orden.tecnico.trim() : reglas[0]?.empleado ?? 'Ronald'

            for (const regla of reglas.filter(r => r.activa)) {
              const base = regla.tipo === 'reparacion' ? totalServicios : totalProductos
              if (base <= 0) continue
              const comisionCalculada = Math.round(base * regla.porcentaje / 100)
              const totalComision = regla.comisionFija > 0 ? regla.comisionFija : comisionCalculada
              if (totalComision <= 0) continue
              await fetch('/api/sistema/comisiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fecha: today(),
                  empleado: empleadoDestino,
                  nOrden: String(orden.nOrden),
                  tipo: regla.tipo === 'accesorio' ? 'B2C Accesorio' : 'B2C',
                  descripcion: `${regla.tipo === 'reparacion' ? 'Reparación' : 'Accesorio'} — ${orden.nombreCliente} · ${orden.modeloEquipo || ''}`.trim().replace(/·\s*$/, ''),
                  montoVenta: base,
                  porcentaje: regla.porcentaje,
                  comisionCalculada,
                  comisionFija: regla.comisionFija,
                  totalComision,
                  pagada: 'Pendiente',
                }),
              })
            }
          }
        } catch { /* silencioso — no bloquea la entrega */ }
      }

      // ── Auto-generar comisión para órdenes de Gremio ─────────────────────
      if (!entregaEsCC && orden.tipo === 'Gremio') {
        try {
          const gremioRes = await fetch('/api/sistema/reglas-comision-gremio')
          if (gremioRes.ok) {
            const reglasG: Array<{ id: string; modelo: string; tipoReparacion: string; comisionFija: number; activa: boolean }> = await gremioRes.json()
            const activas = reglasG.filter(r => r.activa && r.comisionFija > 0)
            const modelo = (orden.modeloEquipo ?? '').trim().toLowerCase()
            const tipo   = (orden.tipoServicio  ?? '').trim().toLowerCase()

            // Prioridad: 1) modelo+tipo exacto, 2) cualquier modelo + tipo exacto, 3) modelo exacto + cualquier tipo
            const match =
              activas.find(r => r.modelo.toLowerCase() === modelo && r.tipoReparacion.toLowerCase() === tipo) ||
              activas.find(r => !r.modelo              && r.tipoReparacion.toLowerCase() === tipo) ||
              activas.find(r => r.modelo.toLowerCase() === modelo && !r.tipoReparacion)

            if (match) {
              const empleadoDestino = (orden.tecnico && orden.tecnico.trim()) ? orden.tecnico.trim() : 'Ronald'
              await fetch('/api/sistema/comisiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fecha: today(),
                  empleado: empleadoDestino,
                  nOrden: String(orden.nOrden),
                  tipo: 'B2B',
                  descripcion: `Reparación Gremio — ${orden.nombreCliente} · ${orden.modeloEquipo || ''} · ${orden.tipoServicio || ''}`.replace(/·\s*$/, '').trim(),
                  montoVenta: entregaMonto,
                  porcentaje: 0,
                  comisionCalculada: match.comisionFija,
                  comisionFija: match.comisionFija,
                  totalComision: match.comisionFija,
                  pagada: 'Pendiente',
                }),
              })
            }
          }
        } catch { /* silencioso */ }
      }

      // ── Descontar stock automáticamente ──────────────────────────────────
      const productItems = (orden.ordenItems ?? []).filter(it => it.tipo === 'producto' && it.refId)
      const stockDescuentos: string[] = []
      if (productItems.length > 0) {
        try {
          const [repRes, accRes] = await Promise.all([
            fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()),
            fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()),
          ])
          const allStock: StockItem[] = [...(repRes?.items ?? []), ...(accRes?.items ?? [])]
          for (const item of productItems) {
            const stockItem = allStock.find(s => s.id === item.refId)
            if (!stockItem) continue
            const nuevoStock = Math.max(0, (stockItem.stock ?? 0) - item.cantidad)
            await fetch('/api/sistema/stock', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...stockItem, stock: nuevoStock, motivo: `Uso en orden #${orden.nOrden}`, referencia: `Orden #${orden.nOrden}` }),
            })
            stockDescuentos.push(`${item.nombre} ×${item.cantidad}`)
          }
        } catch { /* silencioso — no bloquea la entrega */ }
      }

      // Mark order as Entregado + log historial
      const stockLog = stockDescuentos.length > 0
        ? ` · Stock descontado: ${stockDescuentos.join(', ')}.`
        : ''
      const entregaDesc = entregaEsCC
        ? `Equipo entregado a Cuenta Corriente. Deuda registrada: ${fmtARS(entregaMonto)}.${stockLog}`
        : `Equipo entregado. Venta registrada en reportes (${orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}).${stockLog}`
      const entry = mkEntry('estado', entregaDesc, currentUser)
      const newHist = [...(orden.historial ?? []), entry]
      const metodoPagoFinal: MetodoPago = entregaEsCC ? 'Cuenta Corriente' : entregaMetodoPago
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, imagenes, estado: 'Entregado' as EstadoOrden, metodoPago: metodoPagoFinal, montoCobrado: entregaMonto, garantia: entregaGarantia, diasGarantia: entregaGarantia ? entregaDiasGarantia : 0, historial: newHist, fechaEntregadoAt: orden.fechaEntregadoAt ?? new Date().toISOString() }),
      })
      setShowEntregaConfirm(false)
      setFacturaOrden({ ...orden, montoCobrado: entregaMonto, metodoPago: metodoPagoFinal })
      setShowFacturaPrompt(true)
      onRefresh()
    } catch (e) {
      alert(`Error al registrar la venta: ${String(e)}`)
    } finally {
      setEntregaLoading(false)
    }
  }

  const saveImei = async () => {
    if (imeiValue === orden.imei) { setEditingImei(false); return }
    setSavingImei(true)
    try {
      const entry = mkEntry('estado', `IMEI actualizado: ${imeiValue}`, currentUser)
      const newHist = [...(orden.historial ?? []), entry]
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, imagenes, imei: imeiValue, historial: newHist }),
      })
      setEditingImei(false)
      onRefresh()
    } finally { setSavingImei(false) }
  }

  const saveModelo = async () => {
    const trimmed = modeloValue.trim()
    if (!trimmed) return
    const modeloCambio = trimmed !== orden.modeloEquipo
    const colorCambio = colorValue !== ((orden as any).colorEquipo ?? '')
    if (!modeloCambio && !colorCambio) { setEditingModelo(false); return }
    setSavingModelo(true)
    try {
      const partes: string[] = []
      if (modeloCambio) partes.push(`Modelo: "${orden.modeloEquipo}" → "${trimmed}"`)
      if (colorCambio) partes.push(`Color: "${(orden as any).colorEquipo || '—'}" → "${colorValue || '—'}"`)
      const entry = mkEntry('estado', partes.join(' · '), currentUser)
      const newHist = [...(orden.historial ?? []), entry]
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, imagenes, modeloEquipo: trimmed, colorEquipo: colorValue, historial: newHist }),
      })
      setEditingModelo(false)
      onRefresh()
    } finally { setSavingModelo(false) }
  }

  const addHistorial = async (entry: HistorialItem) => {
    const newHist = [...(orden.historial ?? []), entry]
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, historial: newHist }),
    })
  }

  const uploadImages = async (files: FileList) => {
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch(`/api/sistema/ordenes/${orden.id}/imagenes`, { method: 'POST', body: fd })
      const updated: Orden = await res.json()
      setImagenes(updated.imagenes ?? [])
      await addHistorial(mkEntry('foto', `Se subieron ${files.length} foto(s)`, currentUser))
      onRefresh()
    } finally { setUploading(false) }
  }

  const deleteImage = async (filename: string) => {
    await fetch(`/api/sistema/ordenes/${orden.id}/imagenes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    const imagenesActualizadas = imagenes.filter(f => f !== filename)
    setImagenes(imagenesActualizadas)
    // Guardar historial con el array de imágenes ya filtrado (sin depender del state async)
    const entry = mkEntry('foto', `Se eliminó la foto "${filename}"`, currentUser)
    const newHist = [...(orden.historial ?? []), entry]
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes: imagenesActualizadas, historial: newHist }),
    })
    onRefresh()
  }

  const saveNotas2 = async () => {
    if (!notas2.trim()) return
    setSavingNotas(true)
    try {
      const entry = mkEntry('nota', 'Notas internas actualizadas', currentUser)
      const newHist = [...(orden.historial ?? []), entry]
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, imagenes, notas2, historial: newHist }),
      })
      onRefresh()
    } finally { setSavingNotas(false) }
  }

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const openNota = (nota?: NotaOrden) => {
    if (nota) {
      setEditingNota(nota)
      setNotaTexto(nota.texto)
      setNotaVisibilidad(nota.visibilidad)
      setNotaArea(nota.area)
    } else {
      setEditingNota(null)
      setNotaTexto('')
      setNotaVisibilidad('publica')
      setNotaArea(orden.estado)
    }
    setShowNotaForm(true)
  }

  const saveNota = async () => {
    if (!notaTexto.trim()) return
    let newLista: NotaOrden[]
    if (editingNota) {
      newLista = notasLista.map(n => n.id === editingNota.id
        ? { ...n, texto: notaTexto, visibilidad: notaVisibilidad, area: notaArea }
        : n
      )
    } else {
      const nueva: NotaOrden = {
        id: uid(), texto: notaTexto, visibilidad: notaVisibilidad,
        autor: currentUser, area: notaArea, fecha: new Date().toISOString(),
      }
      newLista = [...notasLista, nueva]
    }
    setNotasLista(newLista)
    const entry = mkEntry('nota', editingNota ? 'Nota editada' : `Nueva nota ${notaVisibilidad === 'privada' ? 'privada' : 'pública'} agregada`, currentUser)
    const newHist = [...(orden.historial ?? []), entry]
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, notasLista: newLista, historial: newHist }),
    })
    setShowNotaForm(false)
    setEditingNota(null)
    onRefresh()
  }

  const deleteNota = async (id: string) => {
    const newLista = notasLista.filter(n => n.id !== id)
    setNotasLista(newLista)
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, notasLista: newLista }),
    })
    onRefresh()
  }

  const resetProdForm = () => {
    setShowAddProducto(false)
    setSelectedProd(null)
    setProdSearch('')
    setProdCantidad(1)
    setProdPrecio(0)
    setShowQuickBuy(false)
    setQuickProveedor('')
    setQuickCosto(0)
  }

  const addProductoToOrden = async (stockOverride?: StockItem, gastoId?: string, noStockUpdate?: boolean) => {
    const prod = stockOverride ?? selectedProd
    if (!prod) return
    // Check stock — if 0 and no override/skip, mostrar modal de reposición
    if (!stockOverride && !noStockUpdate && prod.stock <= 0) {
      setShowQuickBuy(true)
      setQuickBuyStep('choose')
      setQuickCosto(prod.costoUnitario)
      setQuickProveedor(prod.proveedor ?? '')
      return
    }
    const newItem: OrdenItem = {
      id: uid(),
      tipo: 'producto',
      refId: prod.id,
      nombre: `${prod.repuesto} ${prod.modelo}`.trim(),
      cantidad: prodCantidad,
      precioUnitario: prodPrecio,
      subtotal: prodCantidad * prodPrecio,
      ...(gastoId ? { gastoId } : {}),
    }
    const newItems = [...ordenItems, newItem]
    setOrdenItems(newItems)
    // Save order
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, ordenItems: newItems }),
    })
    // Deduct stock (unless explicitly skipped)
    if (!noStockUpdate) {
      const newStock = Math.max((prod.stock ?? 0) - prodCantidad, 0)
      await fetch(`/api/sistema/stock/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prod, stock: newStock, costoTotalARS: newStock * prod.costoUnitario, motivo: `Uso en orden #${orden.nOrden}`, referencia: `Orden #${orden.nOrden}` }),
      })
      setStockItems(prev => prev.map(s => s.id === prod.id ? { ...s, stock: newStock } : s))
    }
    onRefresh()
    resetProdForm()
  }

  const quickBuyAndAdd = async () => {
    if (!selectedProd) return
    // Capturar valores del formulario ANTES de cualquier setState o await
    const costoCompra = Number(quickCosto)
    const cantidadCompra = Number(prodCantidad)
    const proveedorCompra = quickProveedor
    const prod = selectedProd
    setQuickSaving(true)
    try {
      // Solo actualiza el stock (sin modificar el precio guardado)
      const updatedProd: StockItem = {
        ...prod,
        stock: (prod.stock ?? 0) + cantidadCompra,
        updatedAt: new Date().toISOString(),
      }
      await fetch(`/api/sistema/stock/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedProd, motivo: `Compra rápida para orden #${orden.nOrden}`, referencia: `Orden #${orden.nOrden}` }),
      })
      // Registrar gasto automático y guardar su ID para poder cancelarlo después
      const nombreProd = `${prod.repuesto}${prod.modelo ? ' ' + prod.modelo : ''}`
      const tipoProd = prod.tipo === 'accesorios' ? 'accesorio' : 'repuesto'
      const montoGasto = costoCompra * cantidadCompra
      const gastoRes = await fetch('/api/sistema/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'local',
          fecha: today(),
          descripcion: `Compra de ${tipoProd}: ${nombreProd} (x${cantidadCompra}) — Orden #${orden.nOrden}`,
          categoria: 'Repuesto/Insumo',
          pagadoPor: proveedorCompra || 'Sin especificar',
          monto: montoGasto,
          moneda: 'ARS $',
          notas: `Registrado automáticamente desde Órdenes de trabajo. Proveedor: ${proveedorCompra}. Costo unitario: $${costoCompra}.`,
        }),
      })
      const gastoCreado = gastoRes.ok ? await gastoRes.json() : null
      // Agregar a la orden vinculando el gastoId para poder cancelarlo si se borra el item
      await addProductoToOrden(updatedProd, gastoCreado?.id)
    } finally {
      setQuickSaving(false)
    }
  }

  const resetServForm = () => {
    setShowAddServicio(false); setSelectedServ(null); setServSearch(''); setServPrecio(0)
    setShowServRepuesto(false); setServRepSearch(''); setSelectedServRep(null); setServRepCantidad(1)
    setShowServQuickBuy(false); setServQuickProveedor(''); setServQuickCosto(0)
  }

  const addServicioToOrden = async (repOverride?: StockItem, gastoId?: string, noStockUpdate?: boolean) => {
    if (!selectedServ) return
    const rep = repOverride ?? selectedServRep
    // Si hay repuesto vinculado y stock = 0, mostrar modal de reposición
    if (!repOverride && !noStockUpdate && rep && rep.stock <= 0) {
      setShowServQuickBuy(true)
      setServQuickBuyStep('choose')
      setServQuickCosto(rep.costoUnitario)
      setServQuickProveedor(rep.proveedor ?? '')
      return
    }
    const newItem: OrdenItem = {
      id: uid(),
      tipo: 'servicio',
      refId: selectedServ.id,
      nombre: selectedServ.nombre,
      cantidad: 1,
      precioUnitario: servPrecio,
      subtotal: servPrecio,
      ...(gastoId ? { gastoId } : {}),
    }
    const newItems = [...ordenItems, newItem]
    setOrdenItems(newItems)
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, ordenItems: newItems }),
    })
    // Descontar stock del repuesto vinculado (a menos que se indique no hacerlo)
    if (rep && !noStockUpdate) {
      const newStock = Math.max((rep.stock ?? 0) - servRepCantidad, 0)
      await fetch(`/api/sistema/stock/${rep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rep, stock: newStock, costoTotalARS: newStock * rep.costoUnitario, motivo: `Uso en orden #${orden.nOrden}`, referencia: `Orden #${orden.nOrden}` }),
      })
      setStockItems(prev => prev.map(s => s.id === rep.id ? { ...s, stock: newStock } : s))
    }
    onRefresh()
    resetServForm()
  }

  const servQuickBuyAndAdd = async () => {
    if (!selectedServRep) return
    // Capturar valores del formulario ANTES de cualquier setState o await
    const costoCompra = Number(servQuickCosto)
    const cantidadCompra = Number(servRepCantidad)
    const proveedorCompra = servQuickProveedor
    const rep = selectedServRep
    setServQuickSaving(true)
    try {
      // Solo actualiza el stock (sin modificar el precio guardado)
      const updatedRep: StockItem = {
        ...rep,
        stock: (rep.stock ?? 0) + cantidadCompra,
        updatedAt: new Date().toISOString(),
      }
      await fetch(`/api/sistema/stock/${rep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedRep, motivo: `Compra rápida para orden #${orden.nOrden}`, referencia: `Orden #${orden.nOrden}` }),
      })
      // Registrar gasto automático y guardar su ID para poder cancelarlo después
      const nombreRep = `${rep.repuesto}${rep.modelo ? ' ' + rep.modelo : ''}`
      const montoGasto = costoCompra * cantidadCompra
      const gastoRes = await fetch('/api/sistema/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'local',
          fecha: today(),
          descripcion: `Compra de repuesto: ${nombreRep} (x${cantidadCompra}) — Orden #${orden.nOrden}`,
          categoria: 'Repuesto/Insumo',
          pagadoPor: proveedorCompra || 'Sin especificar',
          monto: montoGasto,
          moneda: 'ARS $',
          notas: `Registrado automáticamente desde Órdenes de trabajo. Proveedor: ${proveedorCompra}. Costo unitario: $${costoCompra}.`,
        }),
      })
      const gastoCreado = gastoRes.ok ? await gastoRes.json() : null
      await addServicioToOrden(updatedRep, gastoCreado?.id)
    } finally {
      setServQuickSaving(false)
    }
  }

  const addManualToOrden = async () => {
    if (!manualDesc.trim()) return
    const newItem: OrdenItem = {
      id: uid(), tipo: 'manual', refId: '',
      nombre: `${manualTipo}: ${manualDesc}`,
      cantidad: 1,
      precioUnitario: manualTotal,
      subtotal: manualTotal,
      costo: manualCosto,
      ivaPercent: manualIva,
      ivaImporte: manualIvaImporte,
    }
    const newItems = [...ordenItems, newItem]
    setOrdenItems(newItems)
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, ordenItems: newItems }),
    })
    onRefresh()
    setShowAddManual(false)
    setManualDesc(''); setManualCosto(0); setManualIva(0); setManualTipo('Producto')
  }

  const removeItem = async (itemId: string) => {
    const item = ordenItems.find(i => i.id === itemId)
    const newItems = ordenItems.filter(i => i.id !== itemId)
    setOrdenItems(newItems)
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, imagenes, ordenItems: newItems }),
    })
    // Si el item vino de una compra rápida, cancelar el gasto vinculado
    if (item?.gastoId) {
      await fetch('/api/sistema/gastos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.gastoId }),
      })
    }
    onRefresh()
  }

  const totalItems = ordenItems.reduce((acc, i) => acc + i.subtotal, 0)

  const cardSt: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 14,
  }

  const labelSt: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4,
  }

  const valSt: React.CSSProperties = { fontSize: 13, color: C.text }

  const initials = orden.nombreCliente.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const historial = orden.historial ?? []
  const lastEvent = historial.length > 0 ? historial[historial.length - 1] : null

  const stockParaProducto = orden.tipo === 'Cliente final'
    ? stockItems.filter(s => s.tipo === 'accesorios')
    : stockItems
  const filteredStock = stockParaProducto.filter(s =>
    prodSearch.length === 0 ||
    s.repuesto.toLowerCase().includes(prodSearch.toLowerCase()) ||
    s.modelo.toLowerCase().includes(prodSearch.toLowerCase())
  )

  const filteredServRepStock = stockItems.filter(s =>
    servRepSearch.length === 0 ||
    s.repuesto.toLowerCase().includes(servRepSearch.toLowerCase()) ||
    s.modelo.toLowerCase().includes(servRepSearch.toLowerCase())
  )

  const tipoServFiltro = orden.tipo === 'Cliente final' ? 'Cliente final' : 'Gremio'
  const filteredServs = serviciosCatalog
    .filter(s => !s.tipo || s.tipo === tipoServFiltro)
    .filter(s =>
      servSearch.length === 0 ||
      s.nombre.toLowerCase().includes(servSearch.toLowerCase()) ||
      s.categoria.toLowerCase().includes(servSearch.toLowerCase())
    )

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20, padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >← Volver</button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Orden #{orden.nOrden}</span>
          <Badge label={orden.estado} color={getEstadoColor(orden.estado)} />
          {orden.prioridad === 'Urgente' && <Badge label="Urgente" color="#f87171" />}
        </div>

        {/* Botón Acción */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setAccionPos({ top: rect.bottom + 4, left: rect.left })
              setAccionOpen(o => !o)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: accionOpen ? `${COLOR}22` : `${COLOR}14`,
              border: `1px solid ${COLOR}44`,
              color: COLOR, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            }}
          >⚡ Acción <span style={{ fontSize: 9 }}>▾</span></button>
        </div>

        <button
          onClick={() => printOrden(orden, logoLocal ?? '', terminosLocal ?? '')}
          title="Imprimir orden de servicio"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = 'var(--border)' }}
        >🖨 Imprimir</button>

        <button
          onClick={() => printComprobante(orden, logoLocal ?? '', garantiaRetiro ?? '')}
          title="Imprimir comprobante de retiro de equipo"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.30)',
            color: '#4ade80', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.15)'; e.currentTarget.style.borderColor = 'rgba(74,222,128,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.borderColor = 'rgba(74,222,128,0.30)' }}
        >🧾 Comprobante de retiro</button>

        <button
          onClick={() => printEtiqueta(orden, logoLocal ?? '', nombreNegocioLocal)}
          title="Imprimir etiqueta para pegar en el equipo"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(251,146,60,0.08)',
            border: '1px solid rgba(251,146,60,0.30)',
            color: '#fb923c', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,146,60,0.15)'; e.currentTarget.style.borderColor = 'rgba(251,146,60,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,146,60,0.08)'; e.currentTarget.style.borderColor = 'rgba(251,146,60,0.30)' }}
        >🏷 Etiqueta</button>

        <button
          onClick={onRefresh}
          title="Actualizar"
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: C.muted, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >🔄</button>
      </div>

      {/* Tracking code banner */}
      {orden.codigoSeguimiento && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 14,
          background: 'rgba(96,165,250,0.07)',
          border: '1px solid rgba(96,165,250,0.22)',
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, color: '#60a5fa' }}>🔗</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Código de seguimiento:</span>
          <span style={{
            fontFamily: 'monospace', fontSize: 16, fontWeight: 800,
            letterSpacing: '0.18em', color: '#60a5fa',
            background: 'rgba(96,165,250,0.10)', padding: '3px 12px',
            borderRadius: 7, border: '1px solid rgba(96,165,250,0.22)',
          }}>{orden.codigoSeguimiento}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(orden.codigoSeguimiento!)
              setCopiedDetail(true)
              setTimeout(() => setCopiedDetail(false), 2000)
            }}
            title="Copiar código"
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: copiedDetail ? 'rgba(74,222,128,0.1)' : 'rgba(96,165,250,0.10)',
              border: `1px solid ${copiedDetail ? '#4ade8088' : 'rgba(96,165,250,0.30)'}`,
              color: copiedDetail ? '#4ade80' : '#60a5fa',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{copiedDetail ? '✓ Copiado' : 'Copiar'}</button>
          <button
            onClick={() => window.open(`/seguimiento/${orden.codigoSeguimiento}`, '_blank')}
            title="Ver seguimiento del cliente"
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(96,165,250,0.10)',
              border: '1px solid rgba(96,165,250,0.30)',
              color: '#60a5fa', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >Ver página ↗</button>
          {/* Enviar por WhatsApp */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/seguimiento/${orden.codigoSeguimiento}`
              const text = `Hola ${orden.nombreCliente?.split(' ')[0] ?? ''}! Podés seguir el estado de tu reparación acá:\n${url}\n\nOrden #${orden.nOrden} · ${orden.modeloEquipo}`
              const phone = orden.telefonoCliente?.replace(/\D/g, '')
              window.open(
                phone
                  ? `https://wa.me/549${phone}?text=${encodeURIComponent(text)}`
                  : `https://wa.me/?text=${encodeURIComponent(text)}`,
                '_blank'
              )
            }}
            title="Enviar link de seguimiento por WhatsApp"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(37,211,102,0.10)',
              border: '1px solid rgba(37,211,102,0.30)',
              color: '#25d366', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
        </div>
      )}

      {/* Two-column info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Cliente */}
        <div style={cardSt}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: `${COLOR}22`, border: `2px solid ${COLOR}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: COLOR,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingCliente ? (
                /* ── Panel inline edición cliente ── */
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--surface2)', border: `1px solid ${COLOR}44`,
                  display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Editar cliente
                  </div>
                  {/* Tipo */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Tipo</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['Cliente final', 'Gremio'] as TipoOrden[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setClienteTipo(t)}
                          style={{
                            flex: 1, padding: '6px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${clienteTipo === t ? COLOR : 'var(--border)'}`,
                            background: clienteTipo === t ? `${COLOR}18` : 'var(--surface)',
                            color: clienteTipo === t ? COLOR : C.muted,
                          }}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                  {/* Nombre con buscador */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Nombre</div>
                    <ClienteCombo
                      tipo={clienteTipo}
                      nombre={clienteNombre}
                      telefono={clienteTelefono}
                      onNombre={setClienteNombre}
                      onTelefono={setClienteTelefono}
                    />
                  </div>
                  {/* Teléfono */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Teléfono</div>
                    <input
                      type="tel"
                      value={clienteTelefono}
                      onChange={e => setClienteTelefono(e.target.value)}
                      placeholder="Ej: 1123456789"
                      data-nocap
                      style={{ ...inputSt, fontSize: 13 }}
                    />
                  </div>
                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={saveCliente}
                      disabled={savingCliente || !clienteNombre.trim()}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700,
                        background: clienteNombre.trim() ? COLOR : '#aaa', color: '#fff',
                        cursor: clienteNombre.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >{savingCliente ? 'Guardando…' : '✓ Guardar'}</button>
                    <button
                      onClick={() => { setEditingCliente(false); setClienteNombre(orden.nombreCliente ?? ''); setClienteTelefono(orden.telefonoCliente ?? ''); setClienteTipo(orden.tipo ?? 'Cliente final') }}
                      style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: C.muted, cursor: 'pointer' }}
                    >✕ Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{orden.nombreCliente}</span>
                    <button
                      onClick={() => { setClienteNombre(orden.nombreCliente ?? ''); setClienteTelefono(orden.telefonoCliente ?? ''); setClienteTipo(orden.tipo ?? 'Cliente final'); setEditingCliente(true) }}
                      title="Cambiar cliente"
                      style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: `${COLOR}18`, border: `1px solid ${COLOR}44`,
                        color: COLOR, cursor: 'pointer', lineHeight: 1.5,
                      }}
                    >✏ editar</button>
                  </div>
                  <Badge label={orden.tipo} color={orden.tipo === 'Cliente final' ? COLOR : C.blue} />
                  {orden.telefonoCliente && (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      📞 {orden.telefonoCliente}
                      <button
                        onClick={() => setWaModal({ estado: orden.estado, mensaje: buildWAMessage(orden, orden.estado, waMensajesConfig) })}
                        title="Enviar notificación por WhatsApp"
                        style={{
                          background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.35)',
                          borderRadius: 6, cursor: 'pointer', fontSize: 13, padding: '2px 7px',
                          color: '#25d366', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >💬 WA</button>
                    </div>
                  )}
                </>
              )}
              <button
                onClick={() => setHistorialOpen(true)}
                style={{
                  marginTop: 8, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.30)',
                  color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >📋 Ver historial</button>
            </div>
          </div>
        </div>

        {/* Equipo */}
        <div style={cardSt}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, flexShrink: 0,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>📱</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Modelo + Color editable inline */}
              {editingModelo ? (
                <div style={{
                  marginBottom: 8, padding: '12px 14px', borderRadius: 10,
                  background: 'var(--surface2)', border: `1px solid ${COLOR}44`,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Editar equipo
                  </div>
                  {/* Selector de modelo */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Modelo</div>
                    <SearchableSelect
                      value={modeloValue}
                      onChange={v => { setModeloValue(v); setColorValue('') }}
                      options={MODELOS_DISPOSITIVOS}
                      emptyOption="— Seleccionar modelo —"
                      placeholder="Buscar modelo..."
                    />
                  </div>
                  {/* Selector de color */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Color</div>
                    {!modeloValue ? (
                      <div style={{ ...inputSt, color: C.muted, fontSize: 12, display: 'flex', alignItems: 'center', height: 36 }}>
                        Seleccioná un modelo primero
                      </div>
                    ) : (
                      <select
                        value={colorValue}
                        onChange={e => setColorValue(e.target.value)}
                        style={{ ...inputSt, fontSize: 13 }}
                      >
                        <option value="">— Sin especificar —</option>
                        {getColores(modeloValue).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={saveModelo}
                      disabled={savingModelo || !modeloValue}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 7, border: 'none',
                        fontSize: 12, fontWeight: 700,
                        background: modeloValue ? COLOR : '#aaa', color: '#fff',
                        cursor: modeloValue ? 'pointer' : 'not-allowed',
                      }}
                    >{savingModelo ? 'Guardando…' : '✓ Guardar'}</button>
                    <button
                      onClick={() => { setEditingModelo(false); setModeloValue(orden.modeloEquipo ?? ''); setColorValue((orden as any).colorEquipo ?? '') }}
                      style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: C.muted, cursor: 'pointer' }}
                    >✕ Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{orden.modeloEquipo || '—'}</span>
                  <button
                    onClick={() => { setModeloValue(orden.modeloEquipo ?? ''); setColorValue((orden as any).colorEquipo ?? ''); setEditingModelo(true) }}
                    title="Editar modelo y color"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11, padding: '1px 4px', borderRadius: 4, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >✏</button>
                </div>
              )}
              {(orden as any).colorEquipo && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>🎨 {(orden as any).colorEquipo}</div>
              )}
              <div style={{ marginBottom: 6 }}>
                {editingImei ? (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={imeiValue}
                      onChange={e => setImeiValue(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      maxLength={15}
                      placeholder="IMEI (15 dígitos)"
                      style={{
                        ...inputSt, fontSize: 11, fontFamily: 'monospace',
                        padding: '3px 8px', width: 150,
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') saveImei(); if (e.key === 'Escape') setEditingImei(false) }}
                    />
                    <button
                      onClick={saveImei}
                      disabled={savingImei}
                      style={{
                        padding: '3px 8px', borderRadius: 5, border: 'none', fontSize: 10,
                        fontWeight: 700, background: COLOR, color: '#FFFFFF', cursor: 'pointer',
                      }}
                    >{savingImei ? '...' : '✓'}</button>
                    <button
                      onClick={() => { setEditingImei(false); setImeiValue(orden.imei ?? '') }}
                      style={{
                        padding: '3px 6px', borderRadius: 5, fontSize: 10,
                        background: 'none', border: '1px solid var(--border)',
                        color: C.muted, cursor: 'pointer',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
                      {orden.imei || 'Sin IMEI'}
                    </span>
                    <button
                      onClick={() => { setImeiValue(orden.imei ?? ''); setEditingImei(true) }}
                      title="Editar IMEI"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: C.muted, fontSize: 11, padding: '1px 4px', borderRadius: 4,
                        lineHeight: 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                    >✏</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <Badge
                  label={orden.garantia ? 'Con garantía' : 'Sin garantía'}
                  color={orden.garantia ? '#4ade80' : C.muted}
                />
                {/* Estado actual */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: `${getEstadoColor(orden.estado)}22`,
                  border: `1px solid ${getEstadoColor(orden.estado)}55`,
                  color: getEstadoColor(orden.estado),
                  boxShadow: `0 0 8px ${getEstadoColor(orden.estado)}33`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getEstadoColor(orden.estado), display: 'inline-block' }} />
                  {orden.estado}
                </span>
              </div>
              {/* Historial del equipo */}
              <button
                onClick={() => setHistorialEquipoOpen(true)}
                style={{
                  marginTop: 8, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.30)',
                  color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >🔧 Historial del equipo</button>

              {/* Último evento */}
              {lastEvent && (
                <div style={{
                  marginTop: 10, paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {lastEvent.tipo === 'estado' ? '🔄' : lastEvent.tipo === 'foto' ? '📷' : '📝'}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      📅 {fmtDateTime(lastEvent.fecha)}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      👤 {lastEvent.usuario}
                    </div>
                    <div style={{ fontSize: 11, color: C.text, marginTop: 2 }}>
                      {lastEvent.descripcion}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order info */}
      <div style={cardSt}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 12 }}>
          <div>
            <div style={labelSt}>Técnico</div>
            <Badge label={orden.tecnico} color={TECNICO_COLORS[orden.tecnico] ?? C.muted} />
          </div>
          <div>
            <div style={labelSt}>Ingresado</div>
            <div style={valSt}>{formatDate(orden.createdAt)}</div>
          </div>
          <div>
            <div style={labelSt}>Fecha prometida</div>
            <div style={valSt}>{orden.fechaEntrega ? formatDate(orden.fechaEntrega) : '—'}</div>
          </div>
          <div>
            <div style={labelSt}>Prioridad</div>
            <Badge label={orden.prioridad} color={orden.prioridad === 'Urgente' ? '#f87171' : C.muted} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={labelSt}>Presupuesto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>
                {(orden.presupuesto ?? 0) > 0 ? fmtARS(orden.presupuesto) : '—'}
              </span>
              {(orden as any).nPresupuestoRef && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.35)',
                  color: '#818cf8', fontFamily: 'monospace',
                }}>
                  📋 Pres. #{String((orden as any).nPresupuestoRef).padStart(4,'0')}
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={labelSt}>Adelanto</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>
              {(orden.adelanto ?? 0) > 0 ? fmtARS(orden.adelanto) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tiempo de reparación ── */}
      {(() => {
        const entregado = orden.estado === 'Entregado'
        const dias = diasAbierta(orden)
        const color = diasBadgeColor(dias, entregado)
        const inicio = orden.createdAt || orden.fecha
        const pct = entregado ? 100 : Math.min(100, Math.round((dias / 14) * 100))
        return (
          <div style={{ ...cardSt, padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⏱ Tiempo de reparación
              </div>
              <span style={{
                fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                padding: '3px 10px', borderRadius: 20,
                background: `${color}18`, color, border: `1px solid ${color}44`,
              }}>
                {entregado ? `✓ Completado en ${dias} día${dias !== 1 ? 's' : ''}` : dias === 0 ? '⏱ Ingresó hoy' : `⏱ ${dias} día${dias !== 1 ? 's' : ''} en taller`}
              </span>
            </div>
            {/* Barra de progreso */}
            <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%`, transition: 'width 0.4s' }} />
            </div>
            {/* Fechas */}
            <div style={{ display: 'flex', gap: 24, fontSize: 11 }}>
              <div>
                <div style={{ color: C.muted, marginBottom: 2 }}>Ingresó</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(inicio)}</div>
              </div>
              {entregado && orden.fechaEntregadoAt && (
                <div>
                  <div style={{ color: C.muted, marginBottom: 2 }}>Entregado</div>
                  <div style={{ fontWeight: 600, color: C.green }}>{formatDate(orden.fechaEntregadoAt)}</div>
                </div>
              )}
              {orden.fechaEntrega && !entregado && (
                <div>
                  <div style={{ color: C.muted, marginBottom: 2 }}>Entrega prometida</div>
                  <div style={{ fontWeight: 600, color: new Date() > new Date(orden.fechaEntrega) ? '#ef4444' : 'var(--text-primary)' }}>
                    {formatDate(orden.fechaEntrega)}
                    {new Date() > new Date(orden.fechaEntrega) && <span style={{ color: '#ef4444', marginLeft: 4 }}>⚠️ Vencida</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Work description */}
      <div style={cardSt}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 12, letterSpacing: '0.05em' }}>
          📋 DESCRIPCIÓN DEL TRABAJO
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={labelSt}>Tipo de servicio</div>
            <div style={valSt}>{orden.tipoServicio || '—'}</div>
          </div>
          <div>
            <div style={labelSt}>Accesorios</div>
            <div style={valSt}>{orden.accesorios || '—'}</div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={labelSt}>Descripción de la falla</div>
            <div style={{ ...valSt, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
              {orden.descripcionFalla || '—'}
            </div>
          </div>
          {orden.notas && (
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelSt}>Notas</div>
              <div style={{ ...valSt, color: C.muted, fontSize: 12 }}>{orden.notas}</div>
            </div>
          )}

          {/* Checklist de funciones al ingreso */}
          {(orden as any).funciones && (orden as any).modeloEquipo && (() => {
            const fns: ChecklistFunciones = (orden as any).funciones
            const modelo: string = (orden as any).modeloEquipo
            const cameras = getCameras(modelo)
            const { ok, total } = funcionesOk(fns, modelo)
            const pct = total > 0 ? Math.round((ok / total) * 100) : 0
            const faults = ALL_FUNCION_KEYS.filter(k => !fns[k])
            const camFaults = cameras.filter(z => !fns.camaras?.includes(z))
            if (total === 0) return null
            return (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={labelSt}>Estado funcional al ingreso</div>
                {/* Barra de progreso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ade80' : pct >= 70 ? COLOR : '#ef4444', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#4ade80' : pct >= 70 ? COLOR : '#ef4444', whiteSpace: 'nowrap' }}>
                    {ok}/{total} OK
                  </span>
                </div>
                {/* Tiles de fallas */}
                {(faults.length > 0 || camFaults.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {faults.map(k => (
                      <span key={k} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        ✗ {FUNCION_META[k].label}
                      </span>
                    ))}
                    {camFaults.map(z => (
                      <span key={z} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        ✗ Cámara {z}
                      </span>
                    ))}
                  </div>
                )}
                {faults.length === 0 && camFaults.length === 0 && (
                  <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>✓ Todas las funciones OK al ingreso</div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Products & Services */}
      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>🔩 Productos y Servicios</span>
          <button
            onClick={() => { setShowAddProducto(s => !s); setShowAddServicio(false) }}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: showAddProducto ? `${C.blue}22` : 'var(--surface2)',
              border: `1px solid ${showAddProducto ? C.blue : 'var(--border)'}`,
              color: showAddProducto ? C.blue : C.text, cursor: 'pointer',
            }}
          >+ Producto</button>
          <button
            onClick={() => { setShowAddServicio(s => !s); setShowAddProducto(false); setShowAddManual(false) }}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: showAddServicio ? `${COLOR}22` : 'var(--surface2)',
              border: `1px solid ${showAddServicio ? COLOR : 'var(--border)'}`,
              color: showAddServicio ? COLOR : C.text, cursor: 'pointer',
            }}
          >+ Servicio</button>
          <button
            onClick={() => { setShowAddManual(s => !s); setShowAddProducto(false); setShowAddServicio(false) }}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: showAddManual ? '#fbbf2422' : 'var(--surface2)',
              border: `1px solid ${showAddManual ? '#fbbf24' : 'var(--border)'}`,
              color: showAddManual ? '#fbbf24' : C.text, cursor: 'pointer',
            }}
          >+ Manual</button>
        </div>

        {/* Add Producto form */}
        {showAddProducto && (
          <div style={{ marginBottom: 14, padding: '12px', borderRadius: 8, background: 'var(--surface2)', border: `1px solid ${C.blue}33` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 10 }}>
              {orden.tipo === 'Cliente final' ? 'AGREGAR ACCESORIO' : 'AGREGAR PRODUCTO DEL STOCK'}
            </div>
            <input
              value={prodSearch}
              onChange={e => { setProdSearch(e.target.value); setSelectedProd(null) }}
              placeholder={orden.tipo === 'Cliente final' ? 'Buscar accesorio...' : 'Buscar repuesto o accesorio...'}
              style={{ ...inputSt, marginBottom: 6, fontSize: 12 }}
            />
            {!selectedProd && filteredStock.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, maxHeight: 300, overflowY: 'auto' }}>
                {filteredStock.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedProd(s); setProdSearch(`${s.repuesto} ${s.modelo}`.trim()); setProdPrecio(s.costoUnitario) }}
                    style={{
                      width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--row-border)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontSize: 12, color: C.text }}>{s.repuesto} {s.modelo}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>Stock: {s.stock} · {fmtARS(s.costoUnitario)}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedProd && !showQuickBuy && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>CANTIDAD</div>
                  <input
                    type="number" min={1} value={prodCantidad}
                    onChange={e => setProdCantidad(parseInt(e.target.value) || 1)}
                    style={{ ...inputSt, fontSize: 12 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>PRECIO UNIT. (ARS)</div>
                  <input
                    type="number" min={0} value={prodPrecio}
                    onChange={e => setProdPrecio(parseFloat(e.target.value) || 0)}
                    style={{ ...inputSt, fontSize: 12 }}
                  />
                </div>
              </div>
            )}

            {selectedProd && !showQuickBuy && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => addProductoToOrden()}
                  disabled={!selectedProd}
                  style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                    background: !selectedProd ? 'var(--border)' : C.blue,
                    color: !selectedProd ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                    cursor: !selectedProd ? 'not-allowed' : 'pointer',
                  }}
                >✓ Agregar</button>
                <button onClick={resetProdForm} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </div>
            )}
          </div>
        )}

        {/* Add Servicio form */}
        {showAddServicio && (
          <div style={{ marginBottom: 14, padding: '12px', borderRadius: 8, background: 'var(--surface2)', border: `1px solid ${COLOR}33` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              AGREGAR SERVICIO
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                background: tipoServFiltro === 'Gremio' ? 'rgba(167,139,250,0.15)' : 'rgba(74,222,128,0.15)',
                color: tipoServFiltro === 'Gremio' ? '#a78bfa' : '#4ade80',
                border: `1px solid ${tipoServFiltro === 'Gremio' ? '#a78bfa44' : '#4ade8044'}`,
              }}>
                {tipoServFiltro === 'Gremio' ? '🔧 Gremio' : '👤 Cliente final'}
              </span>
            </div>

            {/* Búsqueda de servicio */}
            <input
              value={servSearch}
              onChange={e => { setServSearch(e.target.value); setSelectedServ(null); setShowServRepuesto(false); setSelectedServRep(null) }}
              placeholder={`Buscar en servicios ${tipoServFiltro === 'Gremio' ? 'gremio' : 'cliente final'}...`}
              style={{ ...inputSt, marginBottom: 6, fontSize: 12 }}
              autoFocus
            />
            {!selectedServ && filteredServs.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, maxHeight: 300, overflowY: 'auto' }}>
                {filteredServs.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedServ(s); setServSearch(s.nombre); setServPrecio(s.precio) }}
                    style={{
                      width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--row-border)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontSize: 12, color: C.text }}>{s.nombre}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{s.categoria} · {fmtARS(s.precio)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Precio + toggle repuesto */}
            {selectedServ && !showServQuickBuy && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>PRECIO (ARS)</div>
                  <input
                    type="number" min={0} value={servPrecio}
                    onChange={e => setServPrecio(parseFloat(e.target.value) || 0)}
                    style={{ ...inputSt, fontSize: 12 }}
                  />
                </div>

                {/* Toggle: ¿Usa repuesto? */}
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowServRepuesto(v => !v); setSelectedServRep(null); setServRepSearch(''); setServRepCantidad(1) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6,
                      background: showServRepuesto ? 'rgba(96,165,250,0.12)' : 'var(--surface)',
                      border: `1px solid ${showServRepuesto ? C.blue : 'var(--border)'}`,
                      color: showServRepuesto ? C.blue : C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    📦 {showServRepuesto ? 'Ocultar repuesto vinculado' : '¿Usa repuesto del stock?'}
                    {selectedServRep && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 700 }}>
                        {selectedServRep.repuesto} {selectedServRep.modelo} · Stock: {selectedServRep.stock}
                      </span>
                    )}
                  </button>
                </div>

                {/* Buscador de repuesto en stock */}
                {showServRepuesto && (
                  <div style={{ marginBottom: 10, padding: '10px', borderRadius: 7, background: `${C.blue}0d`, border: `1px solid ${C.blue}33` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, marginBottom: 6 }}>REPUESTO A DESCONTAR DEL STOCK</div>
                    <input
                      value={servRepSearch}
                      onChange={e => { setServRepSearch(e.target.value); setSelectedServRep(null) }}
                      placeholder="Buscar repuesto en stock..."
                      style={{ ...inputSt, marginBottom: 6, fontSize: 12 }}
                    />
                    {!selectedServRep && filteredServRepStock.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, maxHeight: 300, overflowY: 'auto' }}>
                        {filteredServRepStock.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { setSelectedServRep(s); setServRepSearch(`${s.repuesto} ${s.modelo}`.trim()) }}
                            style={{
                              width: '100%', padding: '7px 10px', textAlign: 'left', background: 'none', border: 'none',
                              borderBottom: '1px solid var(--row-border)', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <span style={{ fontSize: 12, color: C.text }}>{s.repuesto} {s.modelo}</span>
                            <span style={{ fontSize: 11, color: s.stock > 0 ? '#4ade80' : '#f87171' }}>
                              Stock: {s.stock}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedServRep && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>CANTIDAD A DESCONTAR</div>
                          <input
                            type="number" min={1} value={servRepCantidad}
                            onChange={e => setServRepCantidad(parseInt(e.target.value) || 1)}
                            style={{ ...inputSt, fontSize: 12 }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, paddingTop: 18 }}>
                          Stock actual: <span style={{ color: selectedServRep.stock > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{selectedServRep.stock}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => addServicioToOrden()}
                disabled={!selectedServ}
                style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                  background: !selectedServ ? 'var(--border)' : COLOR,
                  color: !selectedServ ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                  cursor: !selectedServ ? 'not-allowed' : 'pointer',
                }}
              >✓ Agregar{selectedServRep ? ' y descontar stock' : ''}</button>
              <button onClick={resetServForm} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Manual charge form */}
        {showAddManual && (
          <div style={{ marginBottom: 14, padding: '14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid #fbbf2444' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 12 }}>COBRO MANUAL</div>
            {/* Row 1: Tipo + Descripción */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>TIPO</div>
                <select
                  value={manualTipo}
                  onChange={e => setManualTipo(e.target.value)}
                  style={{ ...inputSt, fontSize: 12 }}
                >
                  {['Producto', 'Servicio', 'Mano de obra', 'Repuesto', 'Otro'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>DESCRIPCIÓN <span style={{ color: '#f87171' }}>*</span></div>
                <input
                  autoFocus
                  value={manualDesc}
                  onChange={e => setManualDesc(e.target.value)}
                  placeholder="Descripción del cobro..."
                  style={{ ...inputSt, fontSize: 12 }}
                />
              </div>
            </div>
            {/* Row 2: Costo | Neto S/IVA | IVA | Importe C/IVA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>COSTO</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 12 }}>$</span>
                  <input
                    type="number" min={0} step={0.01} value={manualCosto}
                    onChange={e => setManualCosto(parseFloat(e.target.value) || 0)}
                    style={{ ...inputSt, fontSize: 12, paddingLeft: 22 }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>NETO S/IVA</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 12 }}>$</span>
                  <input readOnly value={manualNetoSinIva.toFixed(2)} style={{ ...inputSt, fontSize: 12, paddingLeft: 22, opacity: 0.6, cursor: 'default' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>IVA</div>
                <select
                  value={manualIva}
                  onChange={e => setManualIva(parseFloat(e.target.value))}
                  style={{ ...inputSt, fontSize: 12 }}
                >
                  <option value={0}>0.00%</option>
                  <option value={10.5}>10.50%</option>
                  <option value={21}>21.00%</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>IMPORTE C/IVA</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#fbbf24', fontSize: 12 }}>$</span>
                  <input readOnly value={manualTotal.toFixed(2)} style={{ ...inputSt, fontSize: 12, paddingLeft: 22, color: '#fbbf24', fontWeight: 700, cursor: 'default' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={addManualToOrden}
                disabled={!manualDesc.trim()}
                style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                  background: !manualDesc.trim() ? 'var(--border)' : '#fbbf24',
                  color: !manualDesc.trim() ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                  cursor: !manualDesc.trim() ? 'not-allowed' : 'pointer',
                }}
              >✓ Agregar cobro</button>
              <button
                onClick={() => { setShowAddManual(false); setManualDesc(''); setManualCosto(0); setManualIva(0) }}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}
              >Cancelar</button>
            </div>
          </div>
        )}

        {/* Items table */}
        {ordenItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 12 }}>
            Sin productos ni servicios cargados
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['NOMBRE', 'TIPO', 'CANT.', 'PRECIO UNIT.', 'SUBTOTAL', ''].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 10, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordenItems.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: i < ordenItems.length - 1 ? '1px solid var(--row-border)' : 'none' }}>
                      <td style={{ padding: '7px 10px', color: C.text }}>{item.nombre}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <Badge label={item.tipo} color={item.tipo === 'producto' ? C.blue : item.tipo === 'manual' ? '#fbbf24' : COLOR} />
                      </td>
                      <td style={{ padding: '7px 10px', color: C.text, textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: '7px 10px', color: C.text, fontFamily: 'monospace', textAlign: 'right' }}>{fmtARS(item.precioUnitario)}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: C.text, textAlign: 'right' }}>{fmtARS(item.subtotal)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                Total: <span style={{ fontFamily: 'monospace', color: COLOR }}>{fmtARS(totalItems)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom tabs: Fotos / Notas internas */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'fotos' as const, label: `📷 Fotos${imagenes.length ? ` (${imagenes.length})` : ''}` },
            { id: 'notas' as const, label: `📝 Notas${notasLista.length ? ` (${notasLista.length})` : ''}` },
            { id: 'historial' as const, label: `🕐 Historial${historial.length ? ` (${historial.length})` : ''}` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id)}
              style={{
                padding: '10px 20px', background: detailTab === t.id ? `${COLOR}12` : 'transparent',
                border: 'none', borderBottom: detailTab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
                color: detailTab === t.id ? COLOR : C.muted, cursor: 'pointer',
                fontSize: 12, fontWeight: detailTab === t.id ? 700 : 400,
                borderRadius: '10px 10px 0 0', marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '16px 20px' }}>
          {detailTab === 'fotos' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer',
                  background: uploading ? 'var(--hover-bg)' : `${COLOR}18`,
                  border: `1px solid ${COLOR}44`,
                  color: uploading ? C.muted : COLOR,
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}>
                  {uploading ? '⏳ Subiendo...' : '📷 Subir fotos'}
                  <input
                    type="file" accept="image/*" multiple
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={e => e.target.files && uploadImages(e.target.files)}
                  />
                </label>
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 12 }}>JPG, PNG, WEBP · Podés subir varias a la vez</span>
              </div>
              {imagenes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: C.muted, fontSize: 13 }}>Sin fotos todavía</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {imagenes.map(filename => (
                    <div key={filename} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '4/3', background: 'var(--surface2)' }}>
                      <img
                        src={`/uploads/ordenes/${orden.id}/${filename}`}
                        alt={filename}
                        onClick={() => setLightboxSrc(`/uploads/ordenes/${orden.id}/${filename}`)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                      />
                      <button
                        onClick={() => deleteImage(filename)}
                        style={{
                          position: 'absolute', top: 5, right: 5,
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)', border: 'none',
                          color: '#f87171', fontSize: 13, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {detailTab === 'notas' && (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>Notas</span>
                <button
                  onClick={() => openNota()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: C.text, cursor: 'pointer',
                  }}
                >+ Agregar</button>
              </div>

              {/* Formulario agregar/editar */}
              {showNotaForm && (
                <div style={{
                  marginBottom: 14, padding: '14px', borderRadius: 10,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 10 }}>
                  <textarea
                    autoFocus
                    value={notaTexto}
                    onChange={e => setNotaTexto(e.target.value)}
                    rows={3}
                    placeholder="Escribir nota..."
                    style={{ ...inputSt, flex: 1, resize: 'vertical' }}
                  />
                  <DictateButton onResult={text => setNotaTexto(prev => (prev ? prev + ' ' : '') + text)} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Visibilidad toggle */}
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {(['publica', 'privada'] as const).map(v => (
                        <button
                          key={v}
                          onClick={() => setNotaVisibilidad(v)}
                          style={{
                            padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            background: notaVisibilidad === v
                              ? (v === 'privada' ? '#f87171' : C.blue)
                              : 'var(--surface)',
                            color: notaVisibilidad === v ? (v === 'privada' ? '#fff' : '#000') : C.muted,
                            transition: 'all 0.15s',
                          }}
                        >{v === 'publica' ? '👁 Pública' : '🔒 Privada'}</button>
                      ))}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button
                        onClick={saveNota}
                        disabled={!notaTexto.trim()}
                        style={{
                          padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700,
                          background: !notaTexto.trim() ? 'var(--border)' : COLOR,
                          color: !notaTexto.trim() ? C.muted : '#000', cursor: !notaTexto.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >{editingNota ? 'Guardar cambios' : 'Agregar nota'}</button>
                      <button
                        onClick={() => { setShowNotaForm(false); setEditingNota(null) }}
                        style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}
                      >Cancelar</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de notas */}
              {notasLista.length === 0 && !showNotaForm ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: C.muted, fontSize: 13 }}>
                  Sin notas todavía
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...notasLista].reverse().map(nota => (
                    <div key={nota.id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: 'var(--surface)',
                      border: `1px solid ${nota.visibilidad === 'privada' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>
                          {nota.texto}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Badge visibilidad */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: nota.visibilidad === 'privada' ? '#f87171' : `${C.blue}22`,
                            color: nota.visibilidad === 'privada' ? '#fff' : C.blue,
                            border: nota.visibilidad === 'privada' ? 'none' : `1px solid ${C.blue}44`,
                          }}>
                            {nota.visibilidad === 'privada' ? '🔒 Privada' : '👁 Pública'}
                          </span>
                          {/* Fecha */}
                          <span style={{ fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                            🗓 {fmtDateTime(nota.fecha)}
                          </span>
                          {/* Autor */}
                          <span style={{ fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                            👤 {nota.autor}
                          </span>
                        </div>
                      </div>
                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => openNota(nota)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                          title="Editar"
                        >✏</button>
                        <button
                          onClick={() => deleteNota(nota.id)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                          title="Eliminar"
                        >🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {detailTab === 'historial' && (
            <div>
              {historial.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: C.muted, fontSize: 13 }}>
                  Sin actividad registrada todavía
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[...historial].reverse().map((entry, i) => {
                    const icon = entry.tipo === 'estado' ? '🔄' : entry.tipo === 'foto' ? '📷' : '📝'
                    const col = entry.tipo === 'estado' ? C.blue : entry.tipo === 'foto' ? '#f472b6' : '#fbbf24'
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', gap: 12, padding: '10px 0',
                        borderBottom: i < historial.length - 1 ? '1px solid var(--row-border)' : 'none',
                      }}>
                        {/* Icono + línea vertical */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: `${col}18`, border: `1px solid ${col}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13,
                          }}>{icon}</div>
                          {i < historial.length - 1 && (
                            <div style={{ width: 1, flex: 1, minHeight: 8, background: 'rgba(0,0,0,0.04)', marginTop: 4 }} />
                          )}
                        </div>
                        {/* Contenido */}
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{entry.descripcion}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 3, display: 'flex', gap: 12 }}>
                            <span>📅 {fmtDateTime(entry.fecha)}</span>
                            <span>👤 {entry.usuario}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Dropdown Acción (fixed overlay) ─────────────────────────────── */}
      {accionOpen && accionPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 399 }} onClick={() => setAccionOpen(false)} />
          <div style={{
            position: 'fixed', top: accionPos.top, left: accionPos.left, zIndex: 400,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            minWidth: 210, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', borderBottom: '1px solid var(--row-border)' }}>
              CAMBIAR ESTADO
            </div>
            {estadosOrdenConfig.map((estado, estadoIdx) => {
              const col = getEstadoColor(estado, estadoIdx)
              const esActual = orden.estado === estado
              return (
                <button
                  key={estado}
                  onClick={() => cambiarEstadoDetalle(estado)}
                  disabled={esActual}
                  style={{
                    width: '100%', padding: '9px 14px', textAlign: 'left',
                    background: esActual ? `${col}18` : 'none',
                    border: 'none', cursor: esActual ? 'default' : 'pointer',
                    borderBottom: '1px solid var(--row-border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 12, color: esActual ? col : 'var(--text-primary)',
                    fontWeight: esActual ? 700 : 400, transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!esActual) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!esActual) e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0, display: 'inline-block', boxShadow: esActual ? `0 0 6px ${col}` : 'none' }} />
                  {estado}
                  {esActual && <span style={{ marginLeft: 'auto', fontSize: 10, color: col, opacity: 0.8 }}>actual</span>}
                </button>
              )
            })}
            {/* Divider + Entregar equipo */}
            <div style={{ borderTop: '1px solid var(--row-border)', margin: '4px 0' }} />
            <button
              onClick={entregarEquipo}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 12, fontWeight: 700, color: '#4ade80',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 15 }}>📦</span>
              Entregar equipo
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', opacity: 0.7 }}>
                {orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}
              </span>
            </button>
          </div>
        </>
      )}

      {/* ─── Modal confirmación entrega ──────────────────────────────────── */}
      {showEntregaConfirm && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 499, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
            onClick={() => !entregaLoading && setShowEntregaConfirm(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 500, width: 380, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--row-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📦</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Entregar equipo</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {entregaEsCC ? '💳 Se cargará a cuenta corriente del cliente' : `Registrará la venta como ${orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Info rows */}
              {[
                { label: 'Cliente', value: orden.nombreCliente },
                { label: 'Equipo',  value: orden.modeloEquipo  },
                { label: 'Orden',   value: orden.nOrden ? `#${orden.nOrden}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12,
                }}>
                  <span style={{ color: C.muted, fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value || '—'}</span>
                </div>
              ))}

              {/* Banner de seña — solo cuando hay adelanto */}
              {(orden.adelanto ?? 0) > 0 && (
                <div style={{
                  margin: '10px 0 4px',
                  padding: '10px 13px', borderRadius: 9,
                  background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    💰 Seña cobrada al ingreso
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ya cobrado</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24' }}>{fmtARS(orden.adelanto ?? 0)}</span>
                  </div>
                  {(orden.montoCobrado ?? 0) > (orden.adelanto ?? 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 3 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Resta cobrar</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4ade80' }}>
                        {fmtARS((orden.montoCobrado ?? 0) - (orden.adelanto ?? 0))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Monto cobrado — editable */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12, gap: 12,
              }}>
                <span style={{ color: C.muted, fontWeight: 500, flexShrink: 0 }}>Monto cobrado</span>
                <input
                  type="number"
                  value={entregaMonto}
                  onChange={e => setEntregaMonto(Number(e.target.value))}
                  style={{
                    width: 130, padding: '5px 8px', borderRadius: 6, textAlign: 'right',
                    background: 'var(--hover-bg)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none',
                  }}
                />
              </div>

              {/* Método de pago — selector */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: C.muted, fontWeight: 500, flexShrink: 0 }}>Método de pago</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito'] as MetodoPago[]).map(m => (
                    <button
                      key={m}
                      onClick={() => { setEntregaMetodoPago(m); setEntregaEsCC(false) }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${!entregaEsCC && entregaMetodoPago === m ? '#4ade80' : 'var(--border)'}`,
                        background: !entregaEsCC && entregaMetodoPago === m ? 'rgba(74,222,128,0.15)' : 'var(--hover-bg)',
                        color: !entregaEsCC && entregaMetodoPago === m ? '#4ade80' : 'var(--text-secondary)',
                        transition: 'all 0.12s',
                      }}
                    >{m}</button>
                  ))}
                  {/* CC Button */}
                  <button
                    onClick={() => setEntregaEsCC(v => !v)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${entregaEsCC ? '#f97316' : 'var(--border)'}`,
                      background: entregaEsCC ? 'rgba(249,115,22,0.15)' : 'var(--hover-bg)',
                      color: entregaEsCC ? '#f97316' : 'var(--text-secondary)',
                      transition: 'all 0.12s',
                    }}
                  >💳 Cuenta Corriente</button>
                </div>
                {/* CC Warning */}
                {entregaEsCC && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                    fontSize: 11, color: '#f97316', lineHeight: 1.5,
                  }}>
                    ⚠️ <strong>Cuenta Corriente:</strong> el equipo se entrega sin cobro inmediato. La venta y ganancia se registran cuando el cliente pague la deuda.
                  </div>
                )}
              </div>

              {/* Garantía */}
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 10,
                background: entregaGarantia ? 'rgba(74,222,128,0.08)' : 'var(--hover-bg)',
                border: `1px solid ${entregaGarantia ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: entregaGarantia ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🛡️</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: entregaGarantia ? COLOR : 'var(--text-secondary)' }}>
                      Incluye garantía
                    </span>
                  </div>
                  <div
                    onClick={() => setEntregaGarantia(v => !v)}
                    style={{
                      width: 38, height: 22, borderRadius: 11,
                      background: entregaGarantia ? COLOR : 'var(--border)',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3,
                      left: entregaGarantia ? 19 : 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
                {entregaGarantia && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Días de garantía:</span>
                    <input
                      type="number" min={1} max={3650}
                      value={entregaDiasGarantia}
                      onChange={e => setEntregaDiasGarantia(parseInt(e.target.value) || 90)}
                      style={{
                        width: 80, padding: '4px 8px', borderRadius: 6, textAlign: 'center',
                        background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        color: COLOR, fontSize: 14, fontWeight: 700, outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 12, color: C.muted }}>
                      → vence {new Date(Date.now() + entregaDiasGarantia * 86400000).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Warning */}
              {!entregaEsCC ? (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                  fontSize: 11, color: '#4ade80', lineHeight: 1.5,
                }}>
                  ✓ Se registrará en reportes y la orden pasará a <strong>Entregado</strong>
                </div>
              ) : (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                  fontSize: 11, color: '#f97316', lineHeight: 1.5,
                }}>
                  💳 La orden pasará a <strong>Entregado</strong> · Deuda de <strong>{fmtARS(entregaMonto)}</strong> quedará en Cuenta Corriente
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowEntregaConfirm(false)}
                disabled={entregaLoading}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: C.muted, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = C.muted }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEntrega}
                disabled={entregaLoading}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8, cursor: entregaLoading ? 'not-allowed' : 'pointer',
                  background: entregaLoading ? '#4ade80' : entregaEsCC ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {entregaLoading
                  ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Registrando...</>
                  : entregaEsCC ? '💳 Entregar a cuenta corriente' : '📦 Confirmar entrega'
                }
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Factura prompt modal ────────────────────────────────────────── */}
      {showFacturaPrompt && facturaOrden && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowFacturaPrompt(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 360, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>🧾 ¿Deseás generar factura?</div>
              <div style={{ fontSize: 12, color: C.muted }}>Orden #{facturaOrden.nOrden} — {facturaOrden.nombreCliente}</div>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setShowFacturaPrompt(false)}
                style={{ padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >Sin factura</button>
              <button
                onClick={() => {
                  printFacturaOrden({
                    nOrden: facturaOrden.nOrden,
                    nombreCliente: facturaOrden.nombreCliente,
                    telefonoCliente: facturaOrden.telefonoCliente,
                    modeloEquipo: facturaOrden.modeloEquipo,
                    tipoServicio: facturaOrden.tipoServicio,
                    montoCobrado: facturaOrden.montoCobrado,
                    metodoPago: facturaOrden.metodoPago,
                    ordenItems: (facturaOrden.ordenItems ?? []).map(it => ({ nombre: it.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.subtotal })),
                  }, 'B')
                  setShowFacturaPrompt(false)
                }}
                style={{ padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >📄 Factura B</button>
              <button
                onClick={() => {
                  printFacturaOrden({
                    nOrden: facturaOrden.nOrden,
                    nombreCliente: facturaOrden.nombreCliente,
                    telefonoCliente: facturaOrden.telefonoCliente,
                    modeloEquipo: facturaOrden.modeloEquipo,
                    tipoServicio: facturaOrden.tipoServicio,
                    montoCobrado: facturaOrden.montoCobrado,
                    metodoPago: facturaOrden.metodoPago,
                    ordenItems: (facturaOrden.ordenItems ?? []).map(it => ({ nombre: it.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.subtotal })),
                  }, 'A')
                  setShowFacturaPrompt(false)
                }}
                style={{ padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >📄 Factura A</button>
            </div>
          </div>
        </>
      )}

      {/* ─── WhatsApp notification modal ─────────────────────────────────── */}
      {waModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setWaModal(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 420, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#25d36620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                💬
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Notificar al cliente</div>
                <div style={{ fontSize: 11, color: '#25d366', fontWeight: 600 }}>
                  Estado → <strong>{waModal.estado}</strong> · {orden.telefonoCliente}
                </div>
              </div>
              <button onClick={() => setWaModal(null)} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
            {/* Message editor */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Mensaje (editable antes de enviar)
              </div>
              <textarea
                value={waModal.mensaje}
                onChange={e => setWaModal(prev => prev ? { ...prev, mensaje: e.target.value } : null)}
                rows={5}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Se abrirá WhatsApp con este mensaje pre-escrito. Vas a poder revisarlo antes de enviarlo.
              </div>
            </div>
            {/* Buttons */}
            <div style={{ padding: '0 20px 18px', display: 'flex', gap: 10 }}>
              <button onClick={() => setWaModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Omitir
              </button>
              <button
                onClick={() => {
                  const phone = formatWAPhone(orden.telefonoCliente ?? '')
                  const url = `https://wa.me/${phone}?text=${encodeURIComponent(waModal.mensaje)}`
                  window.open(url, '_blank')
                  setWaModal(null)
                }}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>📲</span> Abrir en WhatsApp
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Lightbox ────────────────────────────────────────────────────── */}
      {historialOpen && (
        <HistorialClienteModal
          nombre={orden.nombreCliente}
          telefono={orden.telefonoCliente ?? ''}
          ordenActualId={orden.id}
          onClose={() => setHistorialOpen(false)}
        />
      )}

      {historialEquipoOpen && (
        <HistorialEquipoModal
          imei={orden.imei ?? ''}
          modelo={orden.modeloEquipo ?? ''}
          ordenActualId={orden.id}
          onClose={() => setHistorialEquipoOpen(false)}
        />
      )}

      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 18, right: 22,
              background: 'rgba(0,0,0,0.06)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          <img
            src={lightboxSrc}
            alt="Foto ampliada"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw', maxHeight: '92vh',
              objectFit: 'contain', borderRadius: 10,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
              cursor: 'default',
            }}
          />
        </div>
      )}

      {/* ─── Modal: reponer stock al agregar producto a orden ──────────────── */}
      {showQuickBuy && selectedProd && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => { if (!quickSaving) { setShowQuickBuy(false); setQuickBuyStep('choose') } }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1301, width: 400, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--row-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📦</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Sin stock disponible</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {selectedProd.repuesto}{selectedProd.modelo ? ` ${selectedProd.modelo}` : ''} · Stock actual: <strong style={{ color: '#f87171' }}>0</strong>
                </div>
              </div>
              <button
                onClick={() => { if (!quickSaving) { setShowQuickBuy(false); setQuickBuyStep('choose') } }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Step 1: Choose */}
            {quickBuyStep === 'choose' && (
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>¿Cómo deseas proceder?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => setQuickBuyStep('form')}
                    style={{
                      padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(96,165,250,0.4)',
                      background: 'rgba(96,165,250,0.08)', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.16)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.08)')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 4 }}>📥 Agregar al stock primero</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Registra la compra, actualiza el stock y descuenta al agregar a la orden.</div>
                  </button>
                  <button
                    onClick={() => { setShowQuickBuy(false); setQuickBuyStep('choose'); addProductoToOrden(undefined, undefined, true) }}
                    style={{
                      padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>➡ Continuar sin agregar</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Agrega el producto a la orden sin modificar el stock.</div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Form */}
            {quickBuyStep === 'form' && (
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12, letterSpacing: '0.06em' }}>DATOS DE LA COMPRA</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>PROVEEDOR</div>
                  <ProveedorCombo value={quickProveedor} onChange={setQuickProveedor} proveedores={proveedoresList} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>CANTIDAD</div>
                    <input
                      type="number" min={1} value={prodCantidad}
                      onChange={e => setProdCantidad(parseInt(e.target.value) || 1)}
                      style={{ ...inputSt, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>COSTO UNIT. (ARS)</div>
                    <input
                      type="number" min={0} value={quickCosto}
                      onChange={e => setQuickCosto(parseFloat(e.target.value) || 0)}
                      style={{ ...inputSt, fontSize: 12 }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 14, padding: '7px 10px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  Se agregará <strong style={{ color: C.text }}>{prodCantidad}</strong> unidad{prodCantidad !== 1 ? 'es' : ''} de <strong style={{ color: C.text }}>{selectedProd.repuesto}{selectedProd.modelo ? ` ${selectedProd.modelo}` : ''}</strong> al stock{quickProveedor ? ` (${quickProveedor})` : ''} y se descontará 1 al agregar a la orden.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={quickBuyAndAdd}
                    disabled={quickSaving}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                      background: quickSaving ? 'var(--border)' : C.blue,
                      color: quickSaving ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                      cursor: quickSaving ? 'not-allowed' : 'pointer',
                    }}
                  >{quickSaving ? 'Guardando…' : '🛒 Registrar compra y agregar'}</button>
                  <button
                    onClick={() => setQuickBuyStep('choose')}
                    style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}
                  >← Atrás</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Modal: reponer stock al agregar repuesto vinculado a servicio ──── */}
      {showServQuickBuy && selectedServRep && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => { if (!servQuickSaving) { setShowServQuickBuy(false); setServQuickBuyStep('choose') } }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1301, width: 400, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--row-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🔧</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Sin stock de repuesto</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {selectedServRep.repuesto}{selectedServRep.modelo ? ` ${selectedServRep.modelo}` : ''} · Stock actual: <strong style={{ color: '#f87171' }}>0</strong>
                </div>
              </div>
              <button
                onClick={() => { if (!servQuickSaving) { setShowServQuickBuy(false); setServQuickBuyStep('choose') } }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Step 1: Choose */}
            {servQuickBuyStep === 'choose' && (
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>¿Cómo deseas proceder con el repuesto vinculado?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => setServQuickBuyStep('form')}
                    style={{
                      padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(96,165,250,0.4)',
                      background: 'rgba(96,165,250,0.08)', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.16)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.08)')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 4 }}>📥 Agregar al stock primero</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Registra la compra, actualiza el stock y descuenta al agregar el servicio.</div>
                  </button>
                  <button
                    onClick={() => { setShowServQuickBuy(false); setServQuickBuyStep('choose'); addServicioToOrden(undefined, undefined, true) }}
                    style={{
                      padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>➡ Continuar sin agregar</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Agrega el servicio a la orden sin modificar el stock del repuesto.</div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Form */}
            {servQuickBuyStep === 'form' && (
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12, letterSpacing: '0.06em' }}>DATOS DE LA COMPRA</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>PROVEEDOR</div>
                  <ProveedorCombo value={servQuickProveedor} onChange={setServQuickProveedor} proveedores={proveedoresList} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>CANTIDAD</div>
                    <input
                      type="number" min={1} value={servRepCantidad}
                      onChange={e => setServRepCantidad(parseInt(e.target.value) || 1)}
                      style={{ ...inputSt, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>COSTO UNIT. (ARS)</div>
                    <input
                      type="number" min={0} value={servQuickCosto}
                      onChange={e => setServQuickCosto(parseFloat(e.target.value) || 0)}
                      style={{ ...inputSt, fontSize: 12 }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 14, padding: '7px 10px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  Se agregará <strong style={{ color: C.text }}>{servRepCantidad}</strong> unidad{servRepCantidad !== 1 ? 'es' : ''} de <strong style={{ color: C.text }}>{selectedServRep.repuesto}{selectedServRep.modelo ? ` ${selectedServRep.modelo}` : ''}</strong> al stock{servQuickProveedor ? ` (${servQuickProveedor})` : ''} y se descontará {servRepCantidad} al agregar el servicio.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={servQuickBuyAndAdd}
                    disabled={servQuickSaving}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                      background: servQuickSaving ? 'var(--border)' : C.blue,
                      color: servQuickSaving ? C.muted : '#000', fontWeight: 700, fontSize: 12,
                      cursor: servQuickSaving ? 'not-allowed' : 'pointer',
                    }}
                  >{servQuickSaving ? 'Guardando…' : '🛒 Registrar compra y agregar'}</button>
                  <button
                    onClick={() => setServQuickBuyStep('choose')}
                    style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}
                  >← Atrás</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Form State ───────────────────────────────────────────────────────────────
type FormState = Omit<Orden, 'id' | 'createdAt' | 'nOrden'>

function buildEmpty(dolar: number): FormState {
  return {
    fecha: today(),
    tipo: 'Cliente final',
    estado: 'Entrada',
    prioridad: 'Normal',
    nombreCliente: '',
    telefonoCliente: '',
    mailCliente: '',
    categoriaDispositivo: 'iPhone',
    colorEquipo: '',
    imei: '',
    modeloEquipo: '',
    funciones: emptyChecklist(),
    descripcionFalla: '',
    accesorios: '',
    contrasena: '',
    tecnico: 'Ronald',
    fechaEntrega: '',
    garantia: false,
    diasGarantia: 90,
    tipoServicio: 'Cambio pantalla',
    proveedor: '',
    tipoRepuesto: '',
    repuestosUsados: '',
    costoRepuestoUSD: 0,
    precioDolar: dolar,
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
    notas: '',
    imagenes: [],
    presupuesto: 0,
    adelanto: 0,
    ordenItems: [],
    notas2: '',
    historial: [],
    notasLista: [],
  }
}

function recalc(f: FormState, dolar: number): FormState {
  const precioDolar = f.precioDolar || dolar
  const costoRepuestoPesos = Math.round(f.costoRepuestoUSD * precioDolar)
  const equivARS = f.moneda === 'USD $' ? Math.round(f.montoCobrado * precioDolar) : f.montoCobrado
  const comisionMP = f.metodoPago === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
  const iibb = Math.round(equivARS * 0.04)
  const totalCostos = f.tipo === 'Cliente final' ? costoRepuestoPesos : (f.costoRepuestos || 0)
  const gananciaReal = equivARS - totalCostos - comisionMP - iibb - (f.comisionVendedora || 0) - (f.comisionTecnico || 0)
  return { ...f, costoRepuestoPesos, equivARS, comisionMP, iibb, gananciaReal, precioDolar }
}

// ─── API Response ─────────────────────────────────────────────────────────────
interface ApiResponse { items: Orden[]; nextOrden: number; dolar: number }

// ─── BulkEntregaModal ────────────────────────────────────────────────────────
interface BulkEntregaItem {
  orden: Orden
  monto: number
  metodoPago: MetodoPago
  status: 'pendiente' | 'procesando' | 'ok' | 'error'
  error?: string
}

function BulkEntregaModal({ ordenes, dolar, currentUser, logoLocal, terminosLocal, onClose, onDone }: {
  ordenes: Orden[]
  dolar: number
  currentUser: string
  logoLocal: string
  terminosLocal: string
  onClose: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<BulkEntregaItem[]>(() =>
    ordenes.map(o => {
      const totalItems = (o.ordenItems ?? []).reduce((s, it) => s + (it.subtotal ?? 0), 0)
      return {
        orden: o,
        monto: totalItems > 0 ? totalItems : (o.equivARS || o.montoCobrado || 0),
        metodoPago: (o.metodoPago as MetodoPago) ?? 'Efectivo',
        status: 'pendiente',
      }
    })
  )
  const [globalMetodo, setGlobalMetodo] = useState<MetodoPago | ''>('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const setItemMonto  = (i: number, v: number)          => setItems(p => p.map((x, j) => j === i ? { ...x, monto: v } : x))
  const setItemMetodo = (i: number, v: MetodoPago)      => setItems(p => p.map((x, j) => j === i ? { ...x, metodoPago: v } : x))

  const applyGlobalMetodo = () => {
    if (!globalMetodo) return
    setItems(p => p.map(x => ({ ...x, metodoPago: globalMetodo as MetodoPago })))
  }

  const procesarEntrega = async (item: BulkEntregaItem): Promise<void> => {
    const { orden, monto, metodoPago } = item
    const equivARS = orden.moneda === 'USD $' ? Math.round(monto * dolar) : monto
    const comisionMP = metodoPago === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
    const iibb = Math.round(equivARS * 0.04)

    if (orden.tipo === 'Cliente final') {
      await fetch('/api/sistema/ventas-csf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: orden.fecha, nOrden: orden.nOrden,
          nombreCliente: orden.nombreCliente, modeloEquipo: orden.modeloEquipo,
          tipoServicio: orden.tipoServicio ?? '',
          ticket: equivARS, costoRepuestoUSD: orden.costoRepuestoUSD ?? 0,
          precioDolar: dolar, costoRepuestoPesos: Math.round((orden.costoRepuestoUSD ?? 0) * dolar),
          comisionMP, iibb, montoNetoRecibido: equivARS,
          comisionVendedora: orden.comisionVendedora ?? 0,
          comisionTecnico: orden.comisionTecnico ?? 0,
          gananciaReal: equivARS - Math.round((orden.costoRepuestoUSD ?? 0) * dolar) - comisionMP - iibb - (orden.comisionVendedora ?? 0) - (orden.comisionTecnico ?? 0),
          metodoPago,
        }),
      })
    } else {
      await fetch('/api/sistema/ventas-gremio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: orden.fecha, nOrden: orden.nOrden,
          cliente: orden.nombreCliente, modeloEquipo: orden.modeloEquipo,
          tipoReparacion: orden.tipoServicio ?? '',
          montoCobrado: monto, moneda: orden.moneda ?? 'ARS $',
          equivARS, montoNeto: equivARS, comisionMP, iibb,
          comisionTecnico: orden.comisionTecnico ?? 0,
          costoRepuestos: orden.costoRepuestos ?? 0,
          repuestosUsados: orden.repuestosUsados ?? '',
          gananciaReal: equivARS - (orden.costoRepuestos ?? 0) - comisionMP - iibb - (orden.comisionTecnico ?? 0),
          metodoPago,
        }),
      })
    }

    const entrada: HistorialItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'estado',
      descripcion: `Entregado (entrega masiva). Venta registrada (${orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}).`,
      fecha: new Date().toISOString(),
      usuario: currentUser,
    }
    await fetch(`/api/sistema/ordenes/${orden.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orden, montoCobrado: monto, metodoPago, estado: 'Entregado', historial: [...(orden.historial ?? []), entrada], fechaEntregadoAt: orden.fechaEntregadoAt ?? new Date().toISOString() }),
    })
  }

  const handleConfirmar = async () => {
    setRunning(true)
    for (let i = 0; i < items.length; i++) {
      setItems(p => p.map((x, j) => j === i ? { ...x, status: 'procesando' } : x))
      try {
        await procesarEntrega(items[i])
        setItems(p => p.map((x, j) => j === i ? { ...x, status: 'ok' } : x))
      } catch (e) {
        setItems(p => p.map((x, j) => j === i ? { ...x, status: 'error', error: String(e) } : x))
      }
    }
    setRunning(false)
    setDone(true)
  }

  const total = items.reduce((s, it) => {
    const eq = it.orden.moneda === 'USD $' ? it.monto * dolar : it.monto
    return s + eq
  }, 0)
  const okCount  = items.filter(x => x.status === 'ok').length
  const errCount = items.filter(x => x.status === 'error').length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2400, padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 700, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>🚚 Entrega masiva — {ordenes.length} orden{ordenes.length !== 1 ? 'es' : ''}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Confirmá monto y método de pago para cada orden, luego entregá todo a la vez</div>
          </div>
          {!running && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22, lineHeight: 1 }}>✕</button>}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Método global */}
          {!done && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface2)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>Aplicar a todos:</span>
              <select value={globalMetodo} onChange={e => setGlobalMetodo(e.target.value as MetodoPago)} style={{ ...inputSt, flex: 1, fontSize: 12 }}>
                <option value="">— Elegir método —</option>
                {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={applyGlobalMetodo} disabled={!globalMetodo} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: globalMetodo ? COLOR : '#aaa', color: '#000', fontSize: 12, fontWeight: 700, cursor: globalMetodo ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                ✓ Aplicar
              </button>
            </div>
          )}

          {/* Lista de órdenes */}
          {items.map((item, i) => {
            const o = item.orden
            const totalItems = (o.ordenItems ?? []).reduce((s, it) => s + (it.subtotal ?? 0), 0)
            const statusColor = item.status === 'ok' ? '#4ade80' : item.status === 'error' ? '#f87171' : item.status === 'procesando' ? '#fbbf24' : 'var(--border)'
            const statusIcon  = item.status === 'ok' ? '✓' : item.status === 'error' ? '✗' : item.status === 'procesando' ? '⟳' : '○'
            return (
              <div key={o.id} style={{ border: `1.5px solid ${statusColor}`, borderRadius: 10, padding: '12px 16px', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {/* Status indicator */}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${statusColor}20`, border: `2px solid ${statusColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: statusColor, flexShrink: 0, marginTop: 2 }}>
                    {item.status === 'procesando' ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> : statusIcon}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: C.text }}>#{o.nOrden}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.nombreCliente}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{o.modeloEquipo}</span>
                      <Badge label={o.tipo} color={o.tipo === 'Cliente final' ? COLOR : C.blue} />
                    </div>
                    {item.error && <div style={{ fontSize: 11, color: '#f87171', marginBottom: 4 }}>⚠️ {item.error}</div>}
                    {totalItems > 0 && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                        Items: {(o.ordenItems ?? []).map(it => `${it.nombre} × ${it.cantidad}`).join(', ')}
                      </div>
                    )}
                    {/* Monto + Método — editable solo si no está procesado */}
                    {!done && item.status === 'pendiente' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Monto:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {o.moneda === 'USD $' && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>U$D</span>}
                            {o.moneda !== 'USD $' && <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>$</span>}
                            <input
                              type="number"
                              value={item.monto || ''}
                              onChange={e => setItemMonto(i, Number(e.target.value))}
                              style={{ ...inputSt, width: 100, fontSize: 12, padding: '4px 8px', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Pago:</span>
                          <select value={item.metodoPago} onChange={e => setItemMetodo(i, e.target.value as MetodoPago)} style={{ ...inputSt, fontSize: 11, padding: '4px 8px' }}>
                            {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        {o.moneda === 'USD $' && (
                          <span style={{ fontSize: 10, color: C.muted }}>≈ {fmtARS(item.monto * dolar)}</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.text }}>
                        <span style={{ fontWeight: 700 }}>{o.moneda === 'USD $' ? `U$D ${item.monto}` : fmtARS(item.monto)}</span>
                        <span style={{ color: C.muted }}> · {item.metodoPago}</span>
                      </div>
                    )}
                  </div>
                  {/* Print button (available after done) */}
                  {item.status === 'ok' && (
                    <button
                      onClick={() => printOrden({ ...o, montoCobrado: item.monto, metodoPago: item.metodoPago, estado: 'Entregado' }, logoLocal, terminosLocal)}
                      title="Imprimir orden"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, padding: '4px 6px', borderRadius: 6, flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.blue)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                    >🖨</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {done ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13 }}>
                {errCount === 0
                  ? <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ {okCount} orden{okCount !== 1 ? 'es' : ''} entregada{okCount !== 1 ? 's' : ''} correctamente</span>
                  : <span style={{ color: '#f87171', fontWeight: 700 }}>⚠️ {okCount} OK · {errCount} con error</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const okItems = items.filter(x => x.status === 'ok')
                    okItems.forEach(item => printOrden({ ...item.orden, montoCobrado: item.monto, metodoPago: item.metodoPago, estado: 'Entregado' }, logoLocal, terminosLocal))
                  }}
                  style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.blue}44`, background: `${C.blue}12`, color: C.blue, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  🖨 Imprimir todas
                </button>
                <button
                  onClick={() => { onDone(); onClose() }}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#4ade80', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  ✓ Cerrar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: C.muted }}>
                Total estimado: <span style={{ fontWeight: 700, color: C.text }}>{fmtARS(total)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} disabled={running} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={running}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: running ? '#aaa' : '#4ade80', color: '#000', fontWeight: 700, fontSize: 13, cursor: running ? 'not-allowed' : 'pointer' }}
                >
                  {running ? 'Procesando…' : `✓ Entregar ${items.length} orden${items.length !== 1 ? 'es' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrdenesView({ initialSearch = '' }: { initialSearch?: string }) {
  const { data, loading, refresh } = useApi<ApiResponse>('/api/sistema/ordenes')
  const [estadosOrdenConfig, setEstadosOrdenConfig] = useState<string[]>(ESTADOS_ORDEN)
  const [categoriaTab, setCategoriaTab] = useState<'iPhone' | 'Mac/iPad'>('iPhone')
  const [activeTab, setActiveTab] = useState<string>('Entrada')
  type SortField = 'nOrden' | 'prioridad' | 'modeloEquipo' | 'nombreCliente'
  type SortDir = 'asc' | 'desc'
  const [sortField, setSortField] = useState<SortField>('nOrden')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [modalTab, setModalTab] = useState<'orden' | 'financiero' | 'fotos'>('orden')
  const [form, setForm] = useState<FormState>(buildEmpty(1200))
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  const [formLightbox, setFormLightbox] = useState<string | null>(null)
  const [accionMenu, setAccionMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const [entregaListOrdenId, setEntregaListOrdenId] = useState<string | null>(null)
  const [entregaListLoading, setEntregaListLoading] = useState(false)
  const [entregaListMonto, setEntregaListMonto] = useState(0)
  const [entregaListMetodoPago, setEntregaListMetodoPago] = useState<MetodoPago>('Efectivo')
  const [imeiCheck, setImeiCheck] = useState<{ status: 'idle' | 'loading' | 'ok' | 'bad' | 'error'; msg: string }>({ status: 'idle', msg: '' })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('microsmart_user') ?? 'Ronald'
    return 'Ronald'
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [waListOrden, setWaListOrden] = useState<{ orden: Orden; mensaje: string } | null>(null)
  const [waMensajesConfig, setWaMensajesConfig] = useState<Record<string, string>>({})

  // ─── Configuración inline ────────────────────────────────────────────────────
  const [configOpen, setConfigOpen] = useState(false)

  // ─── Selección masiva ────────────────────────────────────────────────────────
  const [selectMode, setSelectMode]         = useState(false)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [bulkEntregaOpen, setBulkEntregaOpen] = useState(false)
  const [bulkMoverEstado, setBulkMoverEstado] = useState('')
  const [bulkMoverOpen, setBulkMoverOpen]     = useState(false)

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selectAll = () => setSelectedIds(new Set(sorted.map(o => o.id)))
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false) }

  const bulkCambiarEstado = async () => {
    if (!bulkMoverEstado || selectedIds.size === 0) return
    const ordenesSel = list.filter(o => selectedIds.has(o.id))
    await Promise.all(ordenesSel.map(o => {
      const entrada: HistorialItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo: 'estado',
        descripcion: `Estado cambiado de "${o.estado}" a "${bulkMoverEstado}" (acción masiva)`,
        fecha: new Date().toISOString(),
        usuario: currentUser,
      }
      return fetch(`/api/sistema/ordenes/${o.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...o, estado: bulkMoverEstado, historial: [...(o.historial ?? []), entrada] }),
      })
    }))
    setBulkMoverOpen(false)
    setBulkMoverEstado('')
    clearSelection()
    await refresh()
  }

  const dolar = data?.dolar ?? 1200
  const list = data?.items ?? []
  const [logoLocal, setLogoLocal] = useState('')
  const [nombreNegocioLocal, setNombreNegocioLocal] = useState('')
  const [terminosLocal, setTerminosLocal] = useState('')
  const [garantiaRetiro, setGarantiaRetiro] = useState('')

  const detailOrden = detailId ? list.find(o => o.id === detailId) ?? null : null

  // ─── Cargar estados de orden configurables y logo ────────────────────────────
  useEffect(() => {
    fetch('/api/sistema/estados-orden')
      .then(r => r.json())
      .then((d: string[]) => { if (Array.isArray(d) && d.length) setEstadosOrdenConfig(d) })
      .catch(() => {})
    fetch('/api/sistema/negocio')
      .then(r => r.json())
      .then((d: { nombre: string }) => setNombreNegocioLocal(d.nombre ?? ''))
      .catch(() => {})
    fetch('/api/sistema/logo')
      .then(r => r.json())
      .then((d: { logo: string }) => setLogoLocal(d.logo ?? ''))
      .catch(() => {})
    fetch('/api/sistema/terminos')
      .then(r => r.json())
      .then((d: { terminos: string }) => setTerminosLocal(d.terminos ?? ''))
      .catch(() => {})
    fetch('/api/sistema/garantia-retiro')
      .then(r => r.json())
      .then((d: { garantia: string }) => setGarantiaRetiro(d.garantia ?? ''))
      .catch(() => {})
    fetch('/api/sistema/wa-mensajes')
      .then(r => r.json())
      .then((d: Record<string, string>) => setWaMensajesConfig(d))
      .catch(() => {})
  }, [])

  // ─── Setters ────────────────────────────────────────────────────────────────
  // Campos que NO deben auto-capitalizarse (numéricos, técnicos, selectores, códigos)
  const NO_CAP_KEYS = new Set(['imei', 'telefono', 'telefonoCliente', 'estado', 'tecnico', 'tipo', 'prioridad', 'moneda', 'metodoPago', 'categoriaDispositivo'])
  const set = (k: string, v: unknown) => {
    if (k === 'imei') setImeiCheck({ status: 'idle', msg: '' })
    const val = typeof v === 'string' && v.length > 0 && !NO_CAP_KEYS.has(k)
      ? v.charAt(0).toUpperCase() + v.slice(1)
      : v
    setForm(prev => recalc({ ...prev, [k]: val }, dolar))
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  const openNew = () => {
    setForm(recalc(buildEmpty(dolar), dolar))
    setEditId(null)
    setModalTab('orden')
    setModal('new')
  }

  const openEdit = (o: Orden) => {
    const { id, createdAt, nOrden, ...rest } = o
    setForm(rest)
    setEditId(id)
    setModalTab('orden')
    setModal('edit')
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/ordenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        await refresh()
        setModal(false)
      } else {
        await fetch(`/api/sistema/ordenes/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...form }),
        })
        await refresh()
        setModal(false)
        // si venía del detalle, quedarse en el detalle (detailId sigue seteado)
      }
    } finally { setSaving(false) }
  }

  const del = async (o: Orden) => {
    if (!confirm(`¿Eliminar la orden #${o.nOrden} de ${o.nombreCliente}?`)) return
    await fetch(`/api/sistema/ordenes/${o.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id }),
    })
    await refresh()
  }

  const copiarEnlace = async (o: Orden) => {
    let codigo = o.codigoSeguimiento
    if (!codigo) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      codigo = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      await fetch(`/api/sistema/ordenes/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...o, codigoSeguimiento: codigo }),
      })
      await refresh()
    }
    const url = `${window.location.origin}/seguimiento/${codigo}`
    navigator.clipboard.writeText(url)
    setCopiedId(o.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const verificarImei = async () => {
    const digits = form.imei.replace(/\D/g, '')
    if (digits.length !== 15) return
    setImeiCheck({ status: 'loading', msg: '' })
    try {
      const res = await fetch(`/api/imei?imei=${digits}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        const msg = String(data.error ?? 'Error al consultar ENACOM')
        const isBloq = msg.toLowerCase().includes('bloqueado') || msg.toLowerCase().includes('baja')
        setImeiCheck({ status: isBloq ? 'bad' : 'error', msg })
      } else {
        const resultado = String(data.resultado ?? 'Libre')
        const isBad = data.bloqueado === true ||
          resultado.toLowerCase().includes('bloqueado') ||
          resultado.toLowerCase().includes('baja') ||
          resultado.toLowerCase().includes('robado')
        setImeiCheck({ status: isBad ? 'bad' : 'ok', msg: resultado })
      }
    } catch {
      setImeiCheck({ status: 'error', msg: 'No se pudo conectar con ENACOM' })
    }
  }

  const uploadImages = async (files: FileList) => {
    if (!editId || !files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch(`/api/sistema/ordenes/${editId}/imagenes`, { method: 'POST', body: fd })
      const updated: Orden = await res.json()
      setForm(prev => ({ ...prev, imagenes: updated.imagenes ?? [] }))
      await refresh()
    } finally { setUploading(false) }
  }

  const deleteImage = async (filename: string) => {
    if (!editId) return
    await fetch(`/api/sistema/ordenes/${editId}/imagenes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    setForm(prev => ({ ...prev, imagenes: (prev.imagenes ?? []).filter(f => f !== filename) }))
    await refresh()
  }

  const cambiarEstado = async (o: Orden, nuevoEstado: string) => {
    setAccionMenu(null)
    const ahora = new Date().toISOString()
    const entrada: HistorialItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'estado',
      descripcion: `Estado cambiado de "${o.estado}" a "${nuevoEstado}"`,
      fecha: ahora,
      usuario: currentUser,
    }
    const patch: Partial<Orden> = {
      estado: nuevoEstado as EstadoOrden,
      historial: [...(o.historial ?? []), entrada],
      // Registrar timestamp de entrega
      ...(nuevoEstado === 'Entregado' && !o.fechaEntregadoAt ? { fechaEntregadoAt: ahora } : {}),
    }
    await fetch(`/api/sistema/ordenes/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...o, ...patch }),
    })
    await refresh()
    // Ofrecer notificación WhatsApp automáticamente al pasar a Salida
    if (nuevoEstado === 'Salida') {
      const ordenActualizada = { ...o, ...patch } as Orden
      setWaListOrden({ orden: ordenActualizada, mensaje: buildWAMessage(ordenActualizada, 'Salida', waMensajesConfig) })
    }
  }

  const confirmarEntregaFromList = async () => {
    const orden = list.find(o => o.id === entregaListOrdenId)
    if (!orden) return
    setEntregaListLoading(true)
    // Usar monto y método editados en el modal
    const montoFinal   = entregaListMonto
    const metodoFinal  = entregaListMetodoPago
    try {
      if (orden.tipo === 'Cliente final') {
        const dolarActual = data?.dolar ?? 1200
        const equivARS = orden.moneda === 'USD $' ? Math.round(montoFinal * dolarActual) : montoFinal
        const comisionMP = metodoFinal === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
        const iibb = Math.round(equivARS * 0.04)
        await fetch('/api/sistema/ventas-csf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: orden.fecha, nOrden: orden.nOrden,
            nombreCliente: orden.nombreCliente, modeloEquipo: orden.modeloEquipo,
            tipoServicio: orden.tipoServicio ?? '',
            ticket: equivARS, costoRepuestoUSD: orden.costoRepuestoUSD ?? 0,
            precioDolar: dolarActual, costoRepuestoPesos: Math.round((orden.costoRepuestoUSD ?? 0) * dolarActual),
            comisionMP, iibb, montoNetoRecibido: equivARS,
            comisionVendedora: orden.comisionVendedora ?? 0,
            comisionTecnico: orden.comisionTecnico ?? 0,
            gananciaReal: equivARS - Math.round((orden.costoRepuestoUSD ?? 0) * dolarActual) - comisionMP - iibb - (orden.comisionVendedora ?? 0) - (orden.comisionTecnico ?? 0),
            metodoPago: metodoFinal,
          }),
        })
      } else {
        const dolarActual = data?.dolar ?? 1200
        const equivARS = orden.moneda === 'USD $' ? Math.round(montoFinal * dolarActual) : montoFinal
        const comisionMP = metodoFinal === 'Mercado Pago' ? Math.round(equivARS * 0.045) : 0
        const iibb = Math.round(equivARS * 0.04)
        await fetch('/api/sistema/ventas-gremio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: orden.fecha, nOrden: orden.nOrden,
            nombreCliente: orden.nombreCliente, modeloEquipo: orden.modeloEquipo,
            tipoServicio: orden.tipoServicio ?? '',
            montoCobrado: montoFinal, moneda: orden.moneda ?? 'ARS $',
            equivARS, montoNeto: equivARS, comisionMP, iibb,
            comisionTecnico: orden.comisionTecnico ?? 0,
            costoRepuestos: orden.costoRepuestos ?? 0,
            gananciaReal: equivARS - (orden.costoRepuestos ?? 0) - comisionMP - iibb - (orden.comisionTecnico ?? 0),
            metodoPago: metodoFinal,
          }),
        })
      }
      const entrada: HistorialItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo: 'estado',
        descripcion: `Equipo entregado. Venta registrada en reportes (${orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}).`,
        fecha: new Date().toISOString(),
        usuario: currentUser,
      }
      await fetch(`/api/sistema/ordenes/${orden.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orden, montoCobrado: montoFinal, metodoPago: metodoFinal, estado: 'Entregado' as EstadoOrden, historial: [...(orden.historial ?? []), entrada], fechaEntregadoAt: orden.fechaEntregadoAt ?? new Date().toISOString() }),
      })
      setEntregaListOrdenId(null)
      await refresh()
    } catch (e) {
      alert(`Error al registrar la venta: ${String(e)}`)
    } finally {
      setEntregaListLoading(false)
    }
  }

  // ─── Filtered lists ─────────────────────────────────────────────────────────
  const listByCategoria = list.filter(o => (o.categoriaDispositivo ?? 'iPhone') === categoriaTab)
  const filtered = listByCategoria.filter(o => {
    const matchSearch = !search.trim() || (
      matchesAny([o.nombreCliente, o.modeloEquipo], search) ||
      o.imei.toLowerCase().includes(search.toLowerCase()) ||
      String(o.nOrden).includes(search)
    )
    return o.estado === activeTab && matchSearch
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'nOrden') return sortDir === 'asc' ? a.nOrden - b.nOrden : b.nOrden - a.nOrden
    if (sortField === 'prioridad') {
      const p: Record<string, number> = { 'Urgente': 0, 'Normal': 1 }
      const pa = p[a.prioridad] ?? 1
      const pb = p[b.prioridad] ?? 1
      return sortDir === 'asc' ? pa - pb : pb - pa
    }
    if (sortField === 'nombreCliente') {
      const ca = (a.nombreCliente ?? '').toLowerCase()
      const cb = (b.nombreCliente ?? '').toLowerCase()
      return sortDir === 'asc' ? ca.localeCompare(cb) : cb.localeCompare(ca)
    }
    // modeloEquipo
    const ma = (a.modeloEquipo ?? '').toLowerCase()
    const mb = (b.modeloEquipo ?? '').toLowerCase()
    return sortDir === 'asc' ? ma.localeCompare(mb) : mb.localeCompare(ma)
  })

  const countByEstado = (e: string) => listByCategoria.filter(o => o.estado === e).length

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const abiertas = listByCategoria.filter(o => o.estado !== 'Entregado').length
  const urgentes = listByCategoria.filter(o => o.prioridad === 'Urgente').length
  const listas = listByCategoria.filter(o => o.estado === 'Salida').length
  const sinMovimiento = listByCategoria.filter(o => o.estado !== 'Entregado' && diasSinMovimiento(o) >= 5).length

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ─── Detail view (superpuesto, el modal se renderiza encima) ──────── */}
      {detailId && detailOrden && !modal && (
        <OrdenDetailPanel
          orden={detailOrden}
          onBack={() => setDetailId(null)}
          onEdit={() => openEdit(detailOrden)}
          onRefresh={refresh}
          currentUser={currentUser}
          estadosOrdenConfig={estadosOrdenConfig}
          logoLocal={logoLocal}
          nombreNegocioLocal={nombreNegocioLocal}
          terminosLocal={terminosLocal}
          garantiaRetiro={garantiaRetiro}
          waMensajesConfig={waMensajesConfig}
        />
      )}

      {/* ─── Lista de órdenes (solo cuando no hay detalle abierto) ─────────── */}
      {!detailId && (<><PageHeader
        icon="🔧"
        title="Órdenes de trabajo"
        desc="Gestión de reparaciones"
        color={COLOR}
        count={list.length}
        onNew={openNew}
        newLabel="Nueva Orden"
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Abiertas" value={String(abiertas)} color={C.blue} icon="📂" />
        <KPICard label="Urgentes" value={String(urgentes)} color="#f87171" icon="🚨" />
        <KPICard label="Listas p/ entregar" value={String(listas)} color={COLOR} icon="✅" />
        <KPICard label="Sin movimiento" value={String(sinMovimiento)} color={sinMovimiento > 0 ? '#f97316' : C.muted} icon="⚠" />
      </div>

      {/* Search + Usuario actual */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, modelo, IMEI, N°orden..."
          style={{ ...inputSt, maxWidth: 400 }}
        />
        {activeTab !== 'Entregado' && (
          <button
            onClick={() => { setSelectMode(s => !s); if (selectMode) clearSelection() }}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${selectMode ? COLOR : 'var(--border)'}`,
              background: selectMode ? `${COLOR}18` : 'var(--surface2)',
              color: selectMode ? COLOR : C.muted,
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {selectMode ? '✕ Cancelar selección' : '☑ Seleccionar'}
          </button>
        )}
        <button
          onClick={() => setConfigOpen(true)}
          title="Configuración de órdenes de trabajo"
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: C.muted,
            display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          ⚙ Configurar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: C.muted }}>Trabajando como:</span>
          <select
            value={currentUser}
            onChange={e => { setCurrentUser(e.target.value); localStorage.setItem('microsmart_user', e.target.value) }}
            style={{ ...inputSt, width: 'auto', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}
          >
            {TECNICOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Categoría dispositivo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { id: 'iPhone', icon: '📱', label: 'iPhone' },
          { id: 'Mac/iPad', icon: '💻', label: 'Mac / iPad' },
        ] as const).map(cat => {
          const isActive = categoriaTab === cat.id
          const total = list.filter(o => (o.categoriaDispositivo ?? 'iPhone') === cat.id && o.estado !== 'Entregado').length
          return (
            <button
              key={cat.id}
              onClick={() => { setCategoriaTab(cat.id); setActiveTab('Entrada') }}
              style={{
                padding: '8px 18px', borderRadius: 9,
                border: `1px solid ${isActive ? COLOR : 'var(--border)'}`,
                background: isActive ? `${COLOR}18` : 'var(--surface)',
                color: isActive ? COLOR : C.muted,
                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {total > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 20, background: isActive ? COLOR : 'var(--surface2)',
                  color: isActive ? '#000' : C.muted,
                }}>
                  {total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Workflow tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {estadosOrdenConfig.filter(e => !(categoriaTab === 'Mac/iPad' && e === 'Técnico Saddi')).map((estado, estadoIdx) => {
          const cnt = countByEstado(estado)
          const isActive = activeTab === estado
          const col = getEstadoColor(estado, estadoIdx)
          return (
            <button
              key={estado}
              onClick={() => setActiveTab(estado)}
              style={{
                padding: '8px 14px',
                background: isActive ? `${col}18` : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${col}` : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? col : C.muted,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {estado}
              {cnt > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? `${col}30` : 'var(--hover-bg)',
                  color: isActive ? col : C.muted,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })}

        {/* Separador + pestaña Entregados */}
        <div style={{ width: 1, background: 'var(--border)', margin: '4px 4px', alignSelf: 'stretch' }} />
        {(() => {
          const cnt = countByEstado('Entregado')
          const isActive = activeTab === 'Entregado'
          const col = 'var(--text-secondary)'
          return (
            <button
              onClick={() => setActiveTab('Entregado')}
              style={{
                padding: '8px 14px',
                background: isActive ? 'var(--hover-bg)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid var(--text-secondary)` : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? 'var(--text-primary)' : C.muted,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              ✓ Entregados
              {cnt > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'var(--surface2)' : 'var(--hover-bg)',
                  color: isActive ? 'var(--text-primary)' : C.muted,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })()}

        {/* Separador + pestaña Garantías */}
        <div style={{ width: 1, background: 'var(--border)', margin: '4px 4px', alignSelf: 'stretch' }} />
        {(() => {
          const isActive = activeTab === 'garantias'
          return (
            <button
              onClick={() => setActiveTab('garantias')}
              style={{
                padding: '8px 14px',
                background: isActive ? 'rgba(74,222,128,0.08)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #4ade80' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? '#4ade80' : C.muted,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              🛡️ Garantías
            </button>
          )
        })()}
      </div>

      {/* Sort controls */}
      {activeTab !== 'garantias' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>Ordenar:</span>
        {([
          { field: 'nOrden' as SortField, label: 'N° Orden' },
          { field: 'prioridad' as SortField, label: 'Prioridad' },
          { field: 'modeloEquipo' as SortField, label: 'Modelo' },
          { field: 'nombreCliente' as SortField, label: 'Cliente' },
        ]).map(opt => {
          const isActive = sortField === opt.field
          return (
            <button
              key={opt.field}
              onClick={() => {
                if (sortField === opt.field) {
                  setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortField(opt.field)
                  setSortDir(opt.field === 'nOrden' ? 'desc' : 'asc')
                }
              }}
              style={{
                padding: '4px 11px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${isActive ? COLOR : 'var(--border)'}`,
                background: isActive ? `${COLOR}18` : 'var(--surface)',
                color: isActive ? COLOR : C.muted,
                fontWeight: isActive ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.12s',
              }}
            >
              {opt.label}
              {isActive && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </button>
          )
        })}
        <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>
          {sorted.length} orden{sorted.length !== 1 ? 'es' : ''}
        </span>
      </div>}

      {/* Bulk action bar */}
      {activeTab !== 'garantias' && selectMode && (
        <div style={{ marginBottom: 10, padding: '10px 14px', background: `${COLOR}10`, border: `1.5px solid ${COLOR}44`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Conteo + select all */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.text, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === sorted.length}
                onChange={e => e.target.checked ? selectAll() : setSelectedIds(new Set())}
                style={{ width: 15, height: 15, accentColor: COLOR, cursor: 'pointer' }}
              />
              Seleccionar todo
            </label>
            <span style={{ fontSize: 12, color: C.muted }}>
              {selectedIds.size > 0
                ? <span style={{ fontWeight: 700, color: COLOR }}>{selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
                : <span>Ninguna seleccionada</span>
              }
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Mover a estado */}
          {selectedIds.size > 0 && (
            <>
              {!bulkMoverOpen ? (
                <button
                  onClick={() => setBulkMoverOpen(true)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  🔄 Mover a estado
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={bulkMoverEstado}
                    onChange={e => setBulkMoverEstado(e.target.value)}
                    style={{ ...inputSt, fontSize: 12, padding: '5px 10px', minWidth: 170 }}
                  >
                    <option value="">— Elegir estado —</option>
                    {estadosOrdenConfig.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <button
                    onClick={bulkCambiarEstado}
                    disabled={!bulkMoverEstado}
                    style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: bulkMoverEstado ? COLOR : '#aaa', color: '#000', fontSize: 12, fontWeight: 700, cursor: bulkMoverEstado ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                  >✓ Confirmar</button>
                  <button onClick={() => { setBulkMoverOpen(false); setBulkMoverEstado('') }}
                    style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: C.muted, fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              )}

              {/* Entregar masivo (solo en pestaña Salida) */}
              {activeTab === 'Salida' && (
                <button
                  onClick={() => setBulkEntregaOpen(true)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4ade80', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  🚚 Entregar seleccionadas
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Garantías tab content */}
      {activeTab === 'garantias' ? (
        <GarantiasView />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          No hay órdenes en "{activeTab}"
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {selectMode && (
                  <th style={{ padding: '9px 12px', textAlign: 'center', width: 40, borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === sorted.length}
                      onChange={e => e.target.checked ? selectAll() : setSelectedIds(new Set())}
                      style={{ width: 15, height: 15, accentColor: COLOR, cursor: 'pointer' }}
                    />
                  </th>
                )}
                {['N°', 'PRIORIDAD', 'MODELO / IMEI', 'CLIENTE', 'TÉCNICO', 'TIPO', 'MONTO', 'ACCIONES'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((o, i) => {
                const totalItems = (o.ordenItems ?? []).reduce((sum, it) => sum + (it.subtotal ?? 0), 0)
                const monto = totalItems > 0 ? totalItems : (o.equivARS || o.montoCobrado)
                const isSelected = selectedIds.has(o.id)
                return (
                  <tr
                    key={o.id}
                    style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--row-border)' : 'none', transition: 'background 0.1s', background: isSelected ? `${COLOR}0c` : '', cursor: selectMode ? 'pointer' : '' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--row-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? `${COLOR}0c` : '' }}
                    onClick={selectMode ? () => toggleSelect(o.id) : undefined}
                  >
                    {/* Checkbox (select mode) */}
                    {selectMode && (
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'center', width: 40 }} onClick={e => { e.stopPropagation(); toggleSelect(o.id) }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(o.id)}
                          style={{ width: 15, height: 15, accentColor: COLOR, cursor: 'pointer' }}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {/* N° + días */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: C.text }}>#{o.nOrden}</span>
                        <DiasBadge orden={o} />
                        <SinMovimientoBadge orden={o} />
                      </div>
                    </td>
                    {/* Prioridad */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <Badge label={o.prioridad} color={o.prioridad === 'Urgente' ? '#f87171' : C.muted} />
                    </td>
                    {/* Modelo / IMEI */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{o.modeloEquipo || '—'}</div>
                      {(o as any).colorEquipo && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>🎨 {(o as any).colorEquipo}</div>}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: 'monospace' }}>{o.imei || '—'}</div>
                    </td>
                    {/* Cliente */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <div style={{ color: C.text, fontSize: 12 }}>{o.nombreCliente}</div>
                      {o.telefonoCliente && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{o.telefonoCliente}</div>
                      )}
                    </td>
                    {/* Técnico */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <Badge label={o.tecnico} color={TECNICO_COLORS[o.tecnico] ?? C.muted} />
                    </td>
                    {/* Tipo */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <Badge label={o.tipo} color={o.tipo === 'Cliente final' ? COLOR : C.blue} />
                    </td>
                    {/* Monto */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                        {monto > 0 ? fmtARS(monto) : '—'}
                      </span>
                    </td>
                    {/* Acciones */}
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Botón Acción */}
                        <button
                          onClick={e => {
                            if (accionMenu?.id === o.id) { setAccionMenu(null); return }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setAccionMenu({ id: o.id, top: rect.bottom + 4, left: rect.left })
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: 6,
                            border: `1px solid ${COLOR}44`,
                            background: accionMenu?.id === o.id ? `${COLOR}22` : `${COLOR}12`,
                            color: COLOR, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          ⚡ Acción <span style={{ fontSize: 9 }}>▾</span>
                        </button>
                        {/* Ver detalle */}
                        <button
                          onClick={() => setDetailId(o.id)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5 }}
                          onMouseEnter={e => (e.currentTarget.style.color = C.blue)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                          title="Ver detalle"
                        >
                          👁
                        </button>
                        {/* Imprimir */}
                        <button
                          onClick={() => printOrden(o, logoLocal, terminosLocal)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                          title="Imprimir orden"
                        >
                          🖨
                        </button>
                        {/* WhatsApp */}
                        <button
                          onClick={() => setWaListOrden({ orden: o, mensaje: buildWAMessage(o, o.estado, waMensajesConfig) })}
                          title={o.telefonoCliente ? 'Enviar notificación por WhatsApp' : 'Sin teléfono — podés ingresarlo en el modal'}
                          style={{ background: 'none', border: 'none', color: o.telefonoCliente ? '#25d366' : 'var(--text-secondary)', cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5, opacity: o.telefonoCliente ? 1 : 0.45 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = o.telefonoCliente ? '1' : '0.45')}
                        >💬</button>
                        <button
                          onClick={() => del(o)}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 14, borderRadius: 5 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                          title="Eliminar"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {/* ─── WhatsApp modal (lista) ──────────────────────────────────────────── */}
      {waListOrden && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setWaListOrden(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 600, width: 420, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#25d36620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💬</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Notificar al cliente</div>
                <div style={{ fontSize: 11, color: '#25d366', fontWeight: 600 }}>
                  #{waListOrden.orden.nOrden} · {waListOrden.orden.nombreCliente} · estado: {waListOrden.orden.estado}
                </div>
              </div>
              <button onClick={() => setWaListOrden(null)} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!waListOrden.orden.telefonoCliente && (
                <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.3)', fontSize: 12, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚠️ Esta orden no tiene teléfono registrado. Ingresalo manualmente abajo.
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teléfono del cliente
              </div>
              <input
                type="tel"
                placeholder="Ej: 1123456789"
                defaultValue={waListOrden.orden.telefonoCliente ?? ''}
                id="wa-list-phone-input"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 9,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-primary)', fontSize: 13,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                Mensaje (editable antes de enviar)
              </div>
              <textarea
                value={waListOrden.mensaje}
                onChange={e => setWaListOrden(prev => prev ? { ...prev, mensaje: e.target.value } : null)}
                rows={5}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Se abrirá WhatsApp con este mensaje pre-escrito. Podés revisarlo antes de enviarlo.
              </div>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'flex', gap: 10 }}>
              <button onClick={() => setWaListOrden(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  const phoneInput = document.getElementById('wa-list-phone-input') as HTMLInputElement | null
                  const rawPhone = phoneInput?.value || waListOrden.orden.telefonoCliente || ''
                  if (!rawPhone.replace(/\D/g, '')) { alert('Ingresá el teléfono del cliente'); return }
                  const phone = formatWAPhone(rawPhone)
                  const url = `https://wa.me/${phone}?text=${encodeURIComponent(waListOrden.mensaje)}`
                  window.open(url, '_blank')
                  setWaListOrden(null)
                }}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>📲</span> Abrir en WhatsApp
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Bulk entrega modal ──────────────────────────────────────────────── */}
      {bulkEntregaOpen && (() => {
        const ordenesSel = list.filter(o => selectedIds.has(o.id))
        return (
          <BulkEntregaModal
            ordenes={ordenesSel}
            dolar={dolar}
            currentUser={currentUser}
            logoLocal={logoLocal}
            terminosLocal={terminosLocal}
            onClose={() => setBulkEntregaOpen(false)}
            onDone={() => { clearSelection(); refresh() }}
          />
        )
      })()}

      {/* ─── Configuración inline ────────────────────────────────────────── */}
      {configOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg)',
            overflowY: 'auto',
            padding: '24px 0',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
            <OrdenesEstadosPanel
              onBack={() => setConfigOpen(false)}
              backLabel="✕ Cerrar configuración"
            />
          </div>
        </div>
      )}

      {/* ─── Modal (siempre disponible, encima de detalle o lista) ────────── */}
      {modal && (
        <Modal
          title={modal === 'new' ? `Nueva Orden #${data?.nextOrden ?? '—'}` : `Editar Orden`}
          onClose={() => { setModal(false) }}
          onSubmit={save}
          submitting={saving}
          submitColor={COLOR}
          width={720}
        >
          {/* Internal tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 4, marginTop: -4 }}>
            {([
              { id: 'orden', label: '📋 Orden' },
              { id: 'financiero', label: '💰 Financiero' },
              { id: 'fotos', label: `📷 Fotos${form.imagenes?.length ? ` (${form.imagenes.length})` : ''}` },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setModalTab(t.id)}
                style={{
                  padding: '7px 16px',
                  background: modalTab === t.id ? `${COLOR}14` : 'transparent',
                  border: 'none',
                  borderBottom: modalTab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  color: modalTab === t.id ? COLOR : C.muted,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: modalTab === t.id ? 700 : 400,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Orden ──────────────────────────────────────────────── */}
          {modalTab === 'orden' && (
            <FormGrid cols={2}>
              <Field label="Fecha" required>
                <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
              </Field>
              <Field label="N° Orden" calc>
                <input readOnly value={modal === 'new' ? (data?.nextOrden ?? '—') : (data?.items.find(o => o.id === editId)?.nOrden ?? '—')} style={calcSt} />
              </Field>

              <Field label="Dispositivo">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['iPhone', 'Mac/iPad'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => set('categoriaDispositivo', cat)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 7,
                        border: `1px solid ${(form.categoriaDispositivo ?? 'iPhone') === cat ? COLOR : 'var(--border)'}`,
                        background: (form.categoriaDispositivo ?? 'iPhone') === cat ? `${COLOR}18` : 'transparent',
                        color: (form.categoriaDispositivo ?? 'iPhone') === cat ? COLOR : C.muted,
                        cursor: 'pointer', fontSize: 12, fontWeight: (form.categoriaDispositivo ?? 'iPhone') === cat ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat === 'iPhone' ? '📱' : '💻'} {cat}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Tipo" required>
                <SearchableSelect value={form.tipo} onChange={v => set('tipo', v)} options={['Cliente final', 'Gremio']} placeholder="Seleccionar tipo..." />
              </Field>
              <Field label="Prioridad">
                <SearchableSelect value={form.prioridad} onChange={v => set('prioridad', v)} options={['Normal', 'Urgente']} placeholder="Seleccionar prioridad..." />
              </Field>

              <Field label="Cliente" required col={2}>
                <ClienteCombo
                  tipo={form.tipo}
                  nombre={form.nombreCliente}
                  telefono={form.telefonoCliente}
                  onNombre={v => set('nombreCliente', v)}
                  onTelefono={v => set('telefonoCliente', v)}
                  onMail={v => set('mailCliente', v)}
                />
              </Field>

              <Field label="Correo electrónico">
                <input
                  type="email"
                  value={form.mailCliente ?? ''}
                  onChange={e => set('mailCliente', e.target.value)}
                  placeholder="cliente@email.com"
                  style={inputSt}
                />
              </Field>
              <Field label="Modelo equipo" required>
                <SearchableSelect
                  value={form.modeloEquipo}
                  onChange={v => { set('modeloEquipo', v); set('colorEquipo', ''); set('funciones', { ...emptyChecklist(), camaras: [] }) }}
                  options={MODELOS_DISPOSITIVOS}
                  emptyOption="— Seleccionar modelo —"
                  placeholder="Buscar modelo..."
                />
              </Field>
              <Field label="Color del dispositivo">
                {!form.modeloEquipo ? (
                  <div style={{ ...inputSt, color: '#676767', fontSize: 12, display: 'flex', alignItems: 'center', height: 38 }}>Seleccioná un modelo primero</div>
                ) : (
                  <select value={form.colorEquipo ?? ''} onChange={e => set('colorEquipo', e.target.value)} style={inputSt}>
                    <option value="">— Sin especificar —</option>
                    {getColores(form.modeloEquipo).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </Field>
              <Field label="IMEI / Serie" required>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={form.imei}
                    onChange={e => set('imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                    placeholder="356622125571779"
                    style={{ ...inputSt, flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em',
                      borderColor: form.imei.length >= 6 && list.some(o => o.imei === form.imei && (modal !== 'edit' || o.id !== editId)) ? '#fbbf24' : undefined,
                    }}
                    maxLength={15}
                  />
                  {form.imei.length === 15 && imeiCheck.status !== 'loading' && (
                    <button
                      type="button"
                      onClick={verificarImei}
                      title="Verificar IMEI en ENACOM"
                      style={{
                        padding: '0 13px', borderRadius: 8, flexShrink: 0,
                        background: imeiCheck.status === 'ok' ? 'rgba(74,222,128,0.12)'
                          : imeiCheck.status === 'bad' ? 'rgba(248,113,113,0.12)'
                          : 'var(--surface2)',
                        border: `1px solid ${imeiCheck.status === 'ok' ? '#4ade80'
                          : imeiCheck.status === 'bad' ? '#f87171'
                          : 'var(--border)'}`,
                        color: imeiCheck.status === 'ok' ? '#4ade80'
                          : imeiCheck.status === 'bad' ? '#f87171'
                          : C.muted,
                        cursor: 'pointer', fontSize: 15, fontWeight: 700,
                        transition: 'all 0.15s',
                      }}
                    >✓</button>
                  )}
                  {imeiCheck.status === 'loading' && (
                    <div style={{ padding: '0 13px', display: 'flex', alignItems: 'center', color: '#fbbf24', fontSize: 12 }}>⏳</div>
                  )}
                </div>
                {imeiCheck.status === 'ok' && (
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>✓ Libre — {imeiCheck.msg}</span>
                  </div>
                )}
                {imeiCheck.status === 'bad' && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>✗ {imeiCheck.msg}</span>
                  </div>
                )}
                {imeiCheck.status === 'error' && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 11, color: '#fbbf24' }}>⚠ {imeiCheck.msg}</span>
                  </div>
                )}

                {/* ── Aviso: IMEI ya registrado en órdenes anteriores ── */}
                {form.imei.length >= 6 && (() => {
                  const prev = list.filter(o => o.imei === form.imei && (modal !== 'edit' || o.id !== editId))
                  if (prev.length === 0) return null
                  return (
                    <div style={{
                      marginTop: 7, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
                          IMEI ya registrado — {prev.length} orden{prev.length > 1 ? 'es' : ''} anterior{prev.length > 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {prev.slice(0, 4).map(o => (
                          <div key={o.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                            padding: '5px 8px', borderRadius: 6,
                            background: 'rgba(251,191,36,0.06)', fontSize: 11,
                          }}>
                            <span style={{ fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>#{o.nOrden}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{o.nombreCliente}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{o.modeloEquipo}</span>
                            <span style={{
                              padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                              background: `${getEstadoColor(o.estado)}18`, color: getEstadoColor(o.estado),
                              border: `1px solid ${getEstadoColor(o.estado)}44`,
                            }}>{o.estado}</span>
                            <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>{formatDate(o.fecha)}</span>
                          </div>
                        ))}
                        {prev.length > 4 && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', paddingLeft: 8 }}>
                            + {prev.length - 4} más…
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, color: '#fbbf24', opacity: 0.7 }}>
                        Verificá si el equipo ingresa por garantía antes de continuar.
                      </div>
                    </div>
                  )
                })()}
              </Field>

              <Field label="Técnico" required>
                <SearchableSelect value={form.tecnico} onChange={v => set('tecnico', v)} options={[...TECNICOS]} placeholder="Seleccionar técnico..." />
              </Field>
              <Field label="Fecha entrega prometida">
                <input type="date" value={form.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} style={inputSt} />
              </Field>

              <Field label="Descripción de la falla" required col={2}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <textarea
                    value={form.descripcionFalla}
                    onChange={e => set('descripcionFalla', e.target.value)}
                    rows={3}
                    placeholder="Describe el problema del equipo..."
                    style={{ ...inputSt, resize: 'vertical', flex: 1 }}
                  />
                  <DictateButton onResult={text => set('descripcionFalla', (form.descripcionFalla ? form.descripcionFalla + ' ' : '') + text)} />
                </div>
              </Field>

              <Field label="Accesorios" col={2}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" value={form.accesorios} onChange={e => set('accesorios', e.target.value)} placeholder="Funda, cable, caja..." style={{ ...inputSt, flex: 1 }} />
                  <DictateButton onResult={text => set('accesorios', (form.accesorios ? form.accesorios + ' ' : '') + text)} />
                </div>
              </Field>

              <Field label="Detalles físicos" col={2}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Estado físico del equipo, rayones, roturas, detalles..." style={{ ...inputSt, resize: 'vertical', flex: 1 }} />
                  <DictateButton onResult={text => set('notas', (form.notas ? form.notas + ' ' : '') + text)} />
                </div>
              </Field>

              {/* ── Checklist de funciones al ingreso ── */}
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>📋 Estado funcional al ingreso</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Grupos de funciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {GRUPOS_FUNCIONES.map(grupo => (
                    <div key={grupo.label}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 12 }}>{grupo.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{grupo.label}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {grupo.keys.map(key => {
                          const { label, icon } = FUNCION_META[key]
                          const funciones: ChecklistFunciones = form.funciones ?? emptyChecklist()
                          const checked = funciones[key] as boolean
                          return (
                            <label
                              key={key}
                              onClick={() => {
                                const current: ChecklistFunciones = form.funciones ?? emptyChecklist()
                                set('funciones', { ...current, [key]: !checked })
                              }}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '8px 10px', borderRadius: 10, cursor: 'pointer', width: 88, minHeight: 72,
                                background: checked ? 'rgba(74,222,128,0.09)' : 'rgba(239,68,68,0.06)',
                                border: `1.5px solid ${checked ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.3)'}`,
                                transition: 'all 0.12s', gap: 3, textAlign: 'center', userSelect: 'none',
                              }}
                            >
                              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: checked ? '#4ade80' : 'var(--text-secondary)', lineHeight: 1.25, marginTop: 2 }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: checked ? '#4ade80' : '#ef4444', marginTop: 1 }}>{checked ? '✓' : '✗'}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Cámaras traseras */}
                  {form.modeloEquipo && (() => {
                    const cameras = getCameras(form.modeloEquipo)
                    const funciones: ChecklistFunciones = form.funciones ?? emptyChecklist()
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 12 }}>📷</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Cámaras traseras — {form.modeloEquipo}
                          </span>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {cameras.map(zoom => {
                            const checked = funciones.camaras?.includes(zoom)
                            return (
                              <label
                                key={zoom}
                                style={{
                                  display: 'flex', alignItems: 'center', padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                                  background: checked ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.07)',
                                  border: `2px solid ${checked ? '#4ade80' : '#ef4444'}`,
                                  transition: 'all 0.12s', flex: '1 1 70px', justifyContent: 'center', flexDirection: 'column', gap: 3,
                                }}
                                onClick={() => {
                                  const current: ChecklistFunciones = form.funciones ?? emptyChecklist()
                                  const newCams = checked
                                    ? current.camaras.filter(z => z !== zoom)
                                    : [...current.camaras, zoom]
                                  set('funciones', { ...current, camaras: newCams })
                                }}
                              >
                                <span style={{ fontSize: 18 }}>📷</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: checked ? '#4ade80' : '#ef4444' }}>{zoom}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: checked ? '#4ade80' : '#ef4444' }}>
                                  {checked ? 'OK ✓' : '✗ Falla'}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Resumen compacto */}
                {form.funciones && form.modeloEquipo && (() => {
                  const { ok, total } = funcionesOk(form.funciones, form.modeloEquipo)
                  const pct = total > 0 ? Math.round((ok / total) * 100) : 0
                  if (total === 0) return null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ade80' : pct >= 70 ? COLOR : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#4ade80' : pct >= 70 ? COLOR : '#ef4444', whiteSpace: 'nowrap' }}>
                        {ok}/{total} funciones OK ({pct}%)
                      </span>
                    </div>
                  )
                })()}
              </div>

              <Field label="Contraseña / PIN" col={2}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={form.contrasena ?? ''}
                    onChange={e => set('contrasena', e.target.value)}
                    placeholder="Contraseña, PIN o patrón de desbloqueo del equipo"
                    style={{ ...inputSt, flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  />
                </div>
              </Field>

              <Field label="Presupuesto">
                <input type="number" min={0} value={form.presupuesto} onChange={e => set('presupuesto', parseFloat(e.target.value) || 0)} style={inputSt} />
              </Field>
              <Field label="Adelanto">
                <input type="number" min={0} value={form.adelanto} onChange={e => set('adelanto', parseFloat(e.target.value) || 0)} style={inputSt} />
              </Field>

              {/* La garantía se configura al momento de entregar el equipo */}
            </FormGrid>
          )}

          {/* ── Tab: Financiero ─────────────────────────────────────────── */}
          {modalTab === 'financiero' && (
            <>
              {form.tipo === 'Cliente final' ? (
                <>
                  <SectionDivider label="Servicio y repuesto" color={C.orange} />
                  <FormGrid cols={2}>
                    <Field label="Tipo servicio">
                      <SearchableSelect value={form.tipoServicio ?? ''} onChange={v => set('tipoServicio', v)} options={SERVICIOS} placeholder="Seleccionar servicio..." />
                    </Field>
                    <Field label="Proveedor">
                      <AutoCapInput value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre del proveedor" style={inputSt} />
                    </Field>
                    <Field label="Tipo repuesto">
                      <AutoCapInput value={form.tipoRepuesto} onChange={e => set('tipoRepuesto', e.target.value)} placeholder="Ej: Pantalla OLED" style={inputSt} />
                    </Field>
                    <Field label="Costo repuesto USD">
                      <input type="number" min={0} value={form.costoRepuestoUSD} onChange={e => set('costoRepuestoUSD', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Precio dólar">
                      <input type="number" min={0} value={form.precioDolar} onChange={e => set('precioDolar', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Costo repuesto ARS" calc>
                      <input readOnly value={fmtARS(form.costoRepuestoPesos)} style={calcSt} />
                    </Field>
                  </FormGrid>

                  <SectionDivider label="Ticket cobrado" color={COLOR} />
                  <FormGrid cols={2}>
                    <Field label="Ticket cobrado ARS" required>
                      <input type="number" min={0} value={form.montoCobrado} onChange={e => set('montoCobrado', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Método pago">
                      <SearchableSelect value={form.metodoPago} onChange={v => set('metodoPago', v as MetodoPago)} options={METODOS} placeholder="Seleccionar método..." />
                    </Field>
                    <Field label="Comisión MP (4.5%)" calc>
                      <input readOnly value={fmtARS(form.comisionMP)} style={calcSt} />
                    </Field>
                    <Field label="IIBB (4%)" calc>
                      <input readOnly value={fmtARS(form.iibb)} style={calcSt} />
                    </Field>
                  </FormGrid>

                  <SectionDivider label="Comisiones" color={C.purple} />
                  <FormGrid cols={2}>
                    <Field label="Comisión vendedora">
                      <input type="number" min={0} value={form.comisionVendedora} onChange={e => set('comisionVendedora', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Comisión técnico">
                      <input type="number" min={0} value={form.comisionTecnico} onChange={e => set('comisionTecnico', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                  </FormGrid>
                </>
              ) : (
                <>
                  <SectionDivider label="Reparación" color={C.blue} />
                  <FormGrid cols={2}>
                    <Field label="Repuestos usados" col={2}>
                      <input type="text" value={form.repuestosUsados} onChange={e => set('repuestosUsados', e.target.value)} placeholder="Pantalla, batería..." style={inputSt} />
                    </Field>
                    <Field label="Costo repuestos ARS">
                      <input type="number" min={0} value={form.costoRepuestos} onChange={e => set('costoRepuestos', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Monto cobrado" required>
                      <input type="number" min={0} value={form.montoCobrado} onChange={e => set('montoCobrado', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                    <Field label="Moneda">
                      <SearchableSelect value={form.moneda} onChange={v => set('moneda', v as Moneda)} options={['ARS $', 'USD $']} placeholder="Seleccionar moneda..." />
                    </Field>
                    <Field label="Equiv ARS" calc>
                      <input readOnly value={fmtARS(form.equivARS)} style={calcSt} />
                    </Field>
                    <Field label="Método pago">
                      <SearchableSelect value={form.metodoPago} onChange={v => set('metodoPago', v as MetodoPago)} options={METODOS} placeholder="Seleccionar método..." />
                    </Field>
                    <Field label="Comisión MP (4.5%)" calc>
                      <input readOnly value={fmtARS(form.comisionMP)} style={calcSt} />
                    </Field>
                    <Field label="IIBB (4%)" calc>
                      <input readOnly value={fmtARS(form.iibb)} style={calcSt} />
                    </Field>
                    <Field label="Comisión técnico">
                      <input type="number" min={0} value={form.comisionTecnico} onChange={e => set('comisionTecnico', parseFloat(e.target.value) || 0)} style={inputSt} />
                    </Field>
                  </FormGrid>
                </>
              )}

              <SectionDivider label="Resultado" color={form.gananciaReal >= 0 ? COLOR : '#f87171'} />
              <Field label="Ganancia real" calc>
                <input
                  readOnly
                  value={fmtARS(form.gananciaReal)}
                  style={{ ...calcSt, color: form.gananciaReal >= 0 ? COLOR : '#f87171', fontSize: 16 }}
                />
              </Field>
            </>
          )}

          {/* ── Tab: Fotos ──────────────────────────────────────────── */}
          {modalTab === 'fotos' && (
            <div style={{ padding: '8px 0' }}>
              {modal === 'new' ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: C.muted, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  Guardá la orden primero para poder agregar fotos.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '9px 18px', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer',
                      background: uploading ? 'var(--hover-bg)' : `${COLOR}18`,
                      border: `1px solid ${COLOR}44`,
                      color: uploading ? C.muted : COLOR,
                      fontSize: 13, fontWeight: 600,
                      transition: 'all 0.15s',
                    }}>
                      {uploading ? '⏳ Subiendo...' : '📷 Subir fotos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={e => e.target.files && uploadImages(e.target.files)}
                      />
                    </label>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 12 }}>
                      JPG, PNG, WEBP · Podés subir varias a la vez
                    </span>
                  </div>

                  {(form.imagenes ?? []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: C.muted, fontSize: 13 }}>
                      Sin fotos todavía
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                      {(form.imagenes ?? []).map(filename => (
                        <div key={filename} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '4/3', background: 'var(--surface2)' }}>
                          <img
                            src={`/uploads/ordenes/${editId}/${filename}`}
                            alt={filename}
                            onClick={() => setFormLightbox(`/uploads/ordenes/${editId}/${filename}`)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                          />
                          <button
                            onClick={() => deleteImage(filename)}
                            title="Eliminar foto"
                            style={{
                              position: 'absolute', top: 5, right: 5,
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'rgba(0,0,0,0.7)', border: 'none',
                              color: '#f87171', fontSize: 13, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ─── Lightbox formulario ─────────────────────────────────────────── */}
      {formLightbox && (
        <div
          onClick={() => setFormLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setFormLightbox(null)}
            style={{
              position: 'absolute', top: 18, right: 22,
              background: 'rgba(0,0,0,0.06)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          <img
            src={formLightbox}
            alt="Foto ampliada"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw', maxHeight: '92vh',
              objectFit: 'contain', borderRadius: 10,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
              cursor: 'default',
            }}
          />
        </div>
      )}

      {/* ─── Dropdown Acción (fixed overlay, fuera de la tabla) ─────────── */}
      {accionMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 399 }}
            onClick={() => setAccionMenu(null)}
          />
          <div style={{
            position: 'fixed',
            top: accionMenu.top,
            left: accionMenu.left,
            zIndex: 400,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            minWidth: 210,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', borderBottom: '1px solid var(--row-border)' }}>
              CAMBIAR ESTADO
            </div>
            {estadosOrdenConfig.map((estado, estadoIdx) => {
              const col = getEstadoColor(estado, estadoIdx)
              const orden = list.find(o => o.id === accionMenu.id)
              const esActual = orden?.estado === estado
              return (
                <button
                  key={estado}
                  onClick={() => orden && cambiarEstado(orden, estado)}
                  disabled={esActual}
                  style={{
                    width: '100%', padding: '9px 14px', textAlign: 'left',
                    background: esActual ? `${col}18` : 'none',
                    border: 'none', cursor: esActual ? 'default' : 'pointer',
                    borderBottom: '1px solid var(--row-border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 12,
                    color: esActual ? col : 'var(--text-primary)',
                    fontWeight: esActual ? 700 : 400,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!esActual) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!esActual) e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0, display: 'inline-block', boxShadow: esActual ? `0 0 6px ${col}` : 'none' }} />
                  {estado}
                  {esActual && <span style={{ marginLeft: 'auto', fontSize: 10, color: col, opacity: 0.8 }}>actual</span>}
                </button>
              )
            })}
            {/* Entregar equipo */}
            <div style={{ borderTop: '1px solid var(--row-border)', margin: '4px 0' }} />
            <button
              onClick={() => {
                const id = accionMenu.id
                const o = list.find(x => x.id === id)
                setAccionMenu(null)
                setEntregaListMonto(o?.montoCobrado ?? 0)
                setEntregaListMetodoPago(o?.metodoPago ?? 'Efectivo')
                setEntregaListOrdenId(id)
              }}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 12, fontWeight: 700, color: '#4ade80',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 15 }}>📦</span>
              Entregar equipo
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', opacity: 0.7 }}>
                {(() => { const o = list.find(x => x.id === accionMenu.id); return o?.tipo === 'Cliente final' ? 'B2C' : 'B2B' })()}
              </span>
            </button>
          </div>
        </>
      )}

      {/* ─── Modal confirmación entrega (desde lista) ────────────────────── */}
      {entregaListOrdenId && (() => {
        const orden = list.find(o => o.id === entregaListOrdenId)
        if (!orden) return null
        const fmtARS2 = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 800 }} onClick={() => !entregaListLoading && setEntregaListOrdenId(null)} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 801, width: 360, borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--row-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📦</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Entregar equipo</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      Esto registrará la venta como {orden.tipo === 'Cliente final' ? 'B2C' : 'B2B'}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                {/* Info fija */}
                {[
                  { label: 'Cliente', value: orden.nombreCliente },
                  { label: 'Equipo',  value: orden.modeloEquipo  },
                  { label: 'Orden',   value: `#${orden.nOrden}`  },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12,
                  }}>
                    <span style={{ color: C.muted, fontWeight: 500 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value || '—'}</span>
                  </div>
                ))}

                {/* Monto cobrado — editable */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12, gap: 12,
                }}>
                  <span style={{ color: C.muted, fontWeight: 500, flexShrink: 0 }}>Monto cobrado</span>
                  <input
                    type="number"
                    min={0}
                    value={entregaListMonto}
                    onChange={e => setEntregaListMonto(Number(e.target.value))}
                    style={{
                      width: 120, padding: '5px 8px', borderRadius: 6, textAlign: 'right',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none',
                    }}
                  />
                </div>

                {/* Método de pago — selector */}
                <div style={{
                  padding: '10px 0', borderBottom: '1px solid var(--row-border)', fontSize: 12,
                }}>
                  <div style={{ color: C.muted, fontWeight: 500, marginBottom: 8 }}>Método de pago</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito'] as MetodoPago[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setEntregaListMetodoPago(m)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${entregaListMetodoPago === m ? '#4ade80' : 'var(--border)'}`,
                          background: entregaListMetodoPago === m ? 'rgba(74,222,128,0.15)' : 'var(--surface2)',
                          color: entregaListMetodoPago === m ? '#4ade80' : 'var(--text-secondary)',
                          transition: 'all 0.12s',
                        }}
                      >{m}</button>
                    ))}
                  </div>
                </div>

                <div style={{
                  marginTop: 14, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                  fontSize: 11, color: '#4ade80', lineHeight: 1.5,
                }}>
                  ✓ Se registrará en reportes y la orden pasará a <strong>Entregado</strong>
                </div>
              </div>
              <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setEntregaListOrdenId(null)}
                  disabled={entregaListLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: C.muted, fontSize: 13, fontWeight: 600 }}
                >Cancelar</button>
                <button
                  onClick={confirmarEntregaFromList}
                  disabled={entregaListLoading}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, cursor: entregaListLoading ? 'not-allowed' : 'pointer', background: entregaListLoading ? '#4ade80' : 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  {entregaListLoading
                    ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Registrando...</>
                    : '📦 Confirmar entrega'}
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
