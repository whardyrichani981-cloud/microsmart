'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import type { EquipoUsado, ChecklistFunciones, EstadoEquipo, ProveedorEquipo, CompraCliente, ReparacionEstimada, ClientePersona, ClienteB2B, Proveedor, MetodoPago } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  Modal, Field, FormGrid, SectionDivider,
  inputSt, SearchableSelect,
} from './shared'
import { MODELOS_DISPOSITIVOS } from './modelos'
import {
  getColores, getCapacidades, getCameras,
  FUNCION_META, ALL_FUNCION_KEYS, GRUPOS_FUNCIONES,
  emptyChecklist, listFaults, funcionesOk,
  type FuncionFija,
} from './equipo-data'

const COLOR = '#f97316'

// ── Capacidades (importadas de equipo-data — copia local sólo para referencia) ──
const CAPACIDAD_MAP: Record<string, string[]> = {
  // iPhone 17 series
  'iPhone 17 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 17 Pro':     ['256GB', '512GB', '1TB'],
  'iPhone 17 Air':     ['128GB', '256GB', '512GB'],
  'iPhone 17':         ['128GB', '256GB', '512GB'],
  // iPhone 16 series
  'iPhone 16 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 16 Pro':     ['256GB', '512GB', '1TB'],
  'iPhone 16 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 16':         ['128GB', '256GB', '512GB'],
  // iPhone 15 series
  'iPhone 15 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 15 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 15 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 15':         ['128GB', '256GB', '512GB'],
  // iPhone 14 series
  'iPhone 14 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 14 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 14 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 14':         ['128GB', '256GB', '512GB'],
  // iPhone 13 series
  'iPhone 13 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 13 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 13':         ['128GB', '256GB', '512GB'],
  'iPhone 13 Mini':    ['128GB', '256GB', '512GB'],
  // iPhone 12 series
  'iPhone 12 Pro Max': ['128GB', '256GB', '512GB'],
  'iPhone 12 Pro':     ['128GB', '256GB', '512GB'],
  'iPhone 12':         ['64GB', '128GB', '256GB'],
  'iPhone 12 Mini':    ['64GB', '128GB', '256GB'],
  // iPhone 11 series
  'iPhone 11 Pro Max': ['64GB', '256GB', '512GB'],
  'iPhone 11 Pro':     ['64GB', '256GB', '512GB'],
  'iPhone 11':         ['64GB', '128GB', '256GB'],
  // iPhone X / XS / XR
  'iPhone XS Max':     ['64GB', '256GB', '512GB'],
  'iPhone XS':         ['64GB', '256GB', '512GB'],
  'iPhone XR':         ['64GB', '128GB', '256GB'],
  'iPhone X':          ['64GB', '256GB'],
  // iPhone SE
  'iPhone SE (3ra gen)': ['64GB', '128GB', '256GB'],
  'iPhone SE (2da gen)': ['64GB', '128GB', '256GB'],
  // iPhone 8
  'iPhone 8 Plus': ['64GB', '256GB'],
  'iPhone 8':      ['64GB', '256GB'],
  // iPhone 7
  'iPhone 7 Plus': ['32GB', '128GB', '256GB'],
  'iPhone 7':      ['32GB', '128GB', '256GB'],
}


type FormState = Omit<EquipoUsado, 'id' | 'createdAt' | 'nOrden'>

function buildEmpty(): FormState {
  return {
    fecha: today(), modelo: '', color: '', capacidad: '', imei: '',
    bateria: 0,
    funciones: emptyChecklist(),
    estado: 'En stock',
    precioCompra: 0, monedaCompra: 'USD',
    precioVenta: 0,  monedaVenta: 'USD',
    proveedorId: '',
    detallesFisicos: '',
    fotos: [],
  }
}

// ── Tamaños de etiqueta ───────────────────────────────────────────────────────
const LABEL_SIZES = [
  { id: '58x40',  w: '58mm',  h: '40mm',  barH: 32, label: '58 × 40 mm  (estándar)' },
  { id: '62x29',  w: '62mm',  h: '29mm',  barH: 22, label: '62 × 29 mm  (Dymo / Brother)' },
  { id: '100x50', w: '100mm', h: '50mm',  barH: 42, label: '100 × 50 mm (grande)' },
  { id: '100x40', w: '100mm', h: '40mm',  barH: 32, label: '100 × 40 mm' },
] as const
type LabelSizeId = typeof LABEL_SIZES[number]['id']

// ── Configuración persistente ─────────────────────────────────────────────────
const CFG_KEY = 'ms-equipos-config'
type EquiposConfig = {
  labelSize: LabelSizeId
  // aquí se agregarán más opciones en el futuro
}
const DEFAULT_CFG: EquiposConfig = { labelSize: '58x40' }

function loadCfg(): EquiposConfig {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CFG_KEY) : null
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : DEFAULT_CFG
  } catch { return DEFAULT_CFG }
}
function saveCfg(cfg: EquiposConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { /* noop */ }
}

// ── Imprimir etiqueta ─────────────────────────────────────────────────────────
function printLabel(eq: EquipoUsado, sizeId: LabelSizeId = '58x40') {
  const sz     = LABEL_SIZES.find(s => s.id === sizeId) ?? LABEL_SIZES[0]
  const nOrden = String(eq.nOrden ?? 1).padStart(4, '0')
  const barVal = eq.imei?.trim() || `MS${nOrden}`
  const bat    = eq.bateria ?? 0
  const batPct = Math.round(bat)
  // barra de batería en ASCII (solo caracteres imprimibles en B&W)
  const batFill = Math.round(batPct / 10)
  const batBar  = '█'.repeat(batFill) + '░'.repeat(10 - batFill)
  const isWide  = parseInt(sz.w) >= 100

  const w = window.open('', '_blank', 'width=420,height=500,menubar=no,toolbar=no,scrollbars=no')
  if (!w) { alert('Habilitá las ventanas emergentes para imprimir la etiqueta.'); return }

  w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiqueta N° ${nOrden}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:${sz.w} ${sz.h};margin:0}
  html,body{
    width:${sz.w};height:${sz.h};
    background:#fff;color:#000;
    font-family:Arial,Helvetica,sans-serif;
    overflow:hidden;
  }
  .wrap{
    width:${sz.w};height:${sz.h};
    padding:${isWide?'3mm 4mm':'2mm 2.5mm'};
    display:flex;flex-direction:column;justify-content:space-between;
  }
  .top{border-bottom:1px solid #000;padding-bottom:${isWide?'1.5mm':'1mm'};margin-bottom:${isWide?'1.5mm':'1mm'};
    display:flex;justify-content:space-between;align-items:baseline}
  .shop{font-size:${isWide?'9':'7.5'}pt;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
  .orden{font-size:${isWide?'8':'7'}pt;font-weight:700}
  .modelo{font-size:${isWide?'11':'8.5'}pt;font-weight:900;line-height:1.15;margin-bottom:.5mm}
  .sub{font-size:${isWide?'8.5':'7'}pt;font-weight:600;margin-bottom:${isWide?'1.5mm':'.8mm'}}
  .rows{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${isWide?'1.2mm':'.6mm'}}
  .row{display:flex;justify-content:space-between;align-items:center;font-size:${isWide?'7.5':'6.5'}pt}
  .lbl{font-weight:700}
  .val{font-weight:500;font-family:monospace}
  .bat-row{display:flex;align-items:center;gap:2mm;font-size:${isWide?'7':'6'}pt}
  .bat-bar{font-family:monospace;letter-spacing:-0.5px;font-size:${isWide?'8':'6.5'}pt;line-height:1}
  .bc-wrap{text-align:center;margin-top:${isWide?'1.5mm':'1mm'}}
  .bc-wrap svg{display:block;width:100%}
  .bc-num{text-align:center;font-size:${isWide?'6.5':'5.5'}pt;font-family:monospace;letter-spacing:.04em;margin-top:.5mm}
</style>
</head>
<body>
<div class="wrap">
  <div>
    <div class="top">
      <span class="shop">Microsmart</span>
      <span class="orden">N° ${nOrden}</span>
    </div>
    <div class="modelo">${eq.modelo}</div>
    <div class="sub">${[eq.capacidad, eq.color].filter(Boolean).join(' · ')}</div>
    <div class="rows">
      <div class="bat-row">
        <span class="lbl">Bat.</span>
        <span class="bat-bar">${batBar}</span>
        <span class="lbl">${batPct}%</span>
      </div>
      <div class="row"><span class="lbl">IMEI</span><span class="val">${eq.imei || '—'}</span></div>
    </div>
  </div>
  <div class="bc-wrap">
    <svg id="bc"></svg>
    <div class="bc-num">${barVal}</div>
  </div>
</div>
<script>
  JsBarcode('#bc','${barVal}',{
    format:'CODE128',
    width:${isWide?2:1.5},
    height:${sz.barH},
    displayValue:false,
    margin:0,
    background:'#ffffff',
    lineColor:'#000000'
  });
  setTimeout(function(){window.print();},500);
<\/script>
</body></html>`)
  w.document.close()
}

// ── Comprimir imagen antes de guardar ────────────────────────────────────────
async function compressImage(file: File, maxPx = 1000): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// funcionesOk y listFaults importados de equipo-data

// ── Confirm dialog personalizado ──────────────────────────────────────────────
type ConfirmOpts = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean       // botón rojo si es acción destructiva
}

function useConfirm() {
  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)

  const confirm = (opts: ConfirmOpts): Promise<boolean> =>
    new Promise(resolve => setPending({ ...opts, resolve }))

  const dialog = pending ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 28px 22px', maxWidth: 360, width: '90%', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{pending.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 22 }}>{pending.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => { pending.resolve(false); setPending(null) }}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >Cancelar</button>
          <button
            onClick={() => { pending.resolve(true); setPending(null) }}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: pending.danger ? '#ef4444' : COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{pending.confirmLabel ?? 'Confirmar'}</button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}

function estadoBadge(estado: EstadoEquipo) {
  const map: Record<EstadoEquipo, { bg: string; color: string }> = {
    'En stock':       { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    'Vendido':        { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
    'Reservado':      { bg: 'rgba(249,115,22,0.12)',  color: '#f97316' },
    'En reparación':  { bg: 'rgba(234,179,8,0.14)',   color: '#ca8a04' },
  }
  const s = map[estado] ?? map['En stock']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color }}>{estado}</span>
}

function MonedaToggle({ value, onChange }: { value: 'ARS' | 'USD'; onChange: (v: 'ARS' | 'USD') => void }) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
      {(['USD', 'ARS'] as const).map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: value === m ? (m === 'USD' ? '#16a34a' : '#2563eb') : 'var(--surface2)',
          color: value === m ? '#fff' : '#676767', transition: 'all 0.12s',
        }}>{m === 'USD' ? 'U$D' : 'ARS'}</button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  VentaModal — Asistente de venta (3 pasos)
// ════════════════════════════════════════════════════════════════════════════
type TipoClienteUnif = 'persona' | 'b2b' | 'proveedor-equipo' | 'proveedor'
interface ClienteUnif {
  id: string
  tipo: TipoClienteUnif
  nombre: string
  empresa: string
  telefono: string
  mail: string
}
const TIPO_BADGE: Record<TipoClienteUnif, { label: string; color: string }> = {
  persona:            { label: 'Cliente final',  color: '#2563eb' },
  b2b:                { label: 'Empresa',         color: '#7c3aed' },
  'proveedor-equipo': { label: 'Prov. equipos',  color: '#ea580c' },
  proveedor:          { label: 'Proveedor',       color: '#0891b2' },
}

function normalizeClientes(
  personas: ClientePersona[],
  b2bs: ClienteB2B[],
  provEquipos: ProveedorEquipo[],
  provs: Proveedor[],
): ClienteUnif[] {
  return [
    ...personas.map(p => ({ id: p.id, tipo: 'persona' as TipoClienteUnif, nombre: p.nombre, empresa: '', telefono: p.telefono, mail: p.mail })),
    ...b2bs.map(p => ({ id: p.id, tipo: 'b2b' as TipoClienteUnif, nombre: p.nombre, empresa: p.empresa, telefono: p.telefono, mail: p.mail })),
    ...provEquipos.map(p => ({ id: p.id, tipo: 'proveedor-equipo' as TipoClienteUnif, nombre: `${p.nombre} ${p.apellido}`.trim(), empresa: p.empresa, telefono: p.telefono, mail: '' })),
    ...provs.map(p => ({ id: p.id, tipo: 'proveedor' as TipoClienteUnif, nombre: p.nombre, empresa: '', telefono: p.telefono, mail: p.mail })),
  ]
}

function VentaModal({ equipos, onClose, onSaved }: {
  equipos: EquipoUsado[]
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep]   = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  // ── Step 1: Cliente ───────────────────────────────────────────────────────
  const [clienteSearch, setClienteSearch]   = useState('')
  const [selectedCliente, setSelectedCliente] = useState<ClienteUnif | null>(null)
  const [showAdd, setShowAdd]               = useState(false)
  const [nuevoCliente, setNuevoCliente]     = useState({ nombre: '', telefono: '', mail: '' })
  const [savingCliente, setSavingCliente]   = useState(false)

  const { data: personasData } = useApi<ClientePersona[]>('/api/sistema/clientes-personas')
  const { data: b2bData }      = useApi<ClienteB2B[]>('/api/sistema/clientes')
  const { data: provEqData }   = useApi<ProveedorEquipo[]>('/api/sistema/proveedores-equipos')
  const { data: provData }     = useApi<Proveedor[]>('/api/sistema/proveedores')

  const clientes = useMemo(() => normalizeClientes(
    personasData ?? [], b2bData ?? [], provEqData ?? [], provData ?? []
  ), [personasData, b2bData, provEqData, provData])

  const clientesFiltrados = useMemo(() => {
    const q = clienteSearch.toLowerCase()
    return clientes.filter(c => !q || c.nombre.toLowerCase().includes(q) || c.empresa.toLowerCase().includes(q) || c.telefono.includes(q))
  }, [clientes, clienteSearch])

  const saveNuevoCliente = async () => {
    if (!nuevoCliente.nombre.trim()) return alert('El nombre es obligatorio')
    setSavingCliente(true)
    try {
      const res = await fetch('/api/sistema/clientes-personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente),
      })
      const created: ClientePersona = await res.json()
      const unif: ClienteUnif = { id: created.id, tipo: 'persona', nombre: created.nombre, empresa: '', telefono: created.telefono, mail: created.mail }
      setSelectedCliente(unif)
      setShowAdd(false)
      setNuevoCliente({ nombre: '', telefono: '', mail: '' })
    } finally { setSavingCliente(false) }
  }

  // ── Step 2: Equipos ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [scanInput, setScanInput]     = useState('')
  const [scanError, setScanError]     = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  const disponibles = useMemo(() =>
    equipos.filter(e => e.estado === 'En stock' || e.estado === 'En reparación'),
    [equipos]
  )

  const toggleEquipo = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const val = scanInput.trim()
    setScanInput('')
    if (!val) return
    const match = disponibles.find(eq =>
      eq.imei === val ||
      `MS${String(eq.nOrden ?? '').padStart(4, '0')}` === val ||
      String(eq.nOrden) === val
    )
    if (match) {
      setSelectedIds(prev => new Set([...prev, match.id]))
      setScanError('')
    } else {
      setScanError(`No se encontró ningún equipo con IMEI/código "${val}"`)
      setTimeout(() => setScanError(''), 3500)
    }
  }

  // ── Step 3: Confirmar ─────────────────────────────────────────────────────
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [fechaVenta, setFechaVenta] = useState(today())
  const [notas, setNotas]           = useState('')

  const selectedEquipos = disponibles.filter(e => selectedIds.has(e.id))

  const submit = async () => {
    if (!selectedCliente || selectedIds.size === 0) return
    setSaving(true)
    try {
      await Promise.all(
        selectedEquipos.map(eq =>
          fetch('/api/sistema/equipos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: eq.id,
              estado: 'Vendido',
              vendidoA: selectedCliente.nombre,
              vendidoTelefono: selectedCliente.telefono,
              vendidoMail: selectedCliente.mail,
              vendidoTipoCliente: selectedCliente.tipo,
              fechaVenta,
              metodoPagoVenta: metodoPago,
            }),
          })
        )
      )
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  const canNext = step === 1 ? !!selectedCliente : selectedIds.size > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 620, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>🛒 Nueva venta</div>
            <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 2 }}>
              Paso {step} de 3 · {step === 1 ? 'Seleccionar cliente' : step === 2 ? 'Seleccionar equipos' : 'Confirmar venta'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 22, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 0 }}>
          {([1, 2, 3] as const).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 3 ? 1 : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
                background: step === s ? COLOR : step > s ? '#22c55e' : 'var(--surface2)',
                color: step >= s ? '#fff' : '#8A8A8A',
                border: step >= s ? 'none' : '1.5px solid var(--border)',
              }}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? '#22c55e' : 'var(--border)', margin: '0 8px' }} />}
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#8A8A8A', marginLeft: 12, alignSelf: 'center', whiteSpace: 'nowrap' }}>
            {step === 1 ? 'Cliente' : step === 2 ? 'Equipos' : 'Confirmar'}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── PASO 1: CLIENTE ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Cliente seleccionado */}
              {selectedCliente && (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.35)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>✓ {selectedCliente.nombre}{selectedCliente.empresa ? ` · ${selectedCliente.empresa}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {selectedCliente.telefono && <span>📞 {selectedCliente.telefono}</span>}
                      <span style={{ background: TIPO_BADGE[selectedCliente.tipo].color + '22', color: TIPO_BADGE[selectedCliente.tipo].color, padding: '1px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                        {TIPO_BADGE[selectedCliente.tipo].label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCliente(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>
              )}

              {/* Buscador */}
              <input value={clienteSearch} onChange={e => setClienteSearch(e.target.value)}
                placeholder="Buscar cliente por nombre, empresa o teléfono…" style={inputSt} autoFocus />

              {/* Lista */}
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {clientesFiltrados.slice(0, 50).map(c => {
                  const isSelected = selectedCliente?.id === c.id && selectedCliente?.tipo === c.tipo
                  const badge = TIPO_BADGE[c.tipo]
                  return (
                    <div key={`${c.tipo}-${c.id}`} onClick={() => setSelectedCliente(c)} style={{
                      padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                      background: isSelected ? 'rgba(34,197,94,0.08)' : 'var(--surface2)',
                      border: `1.5px solid ${isSelected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.1s',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.nombre}{c.empresa ? <span style={{ color: '#8A8A8A', fontWeight: 400 }}> · {c.empresa}</span> : null}
                        </div>
                        {c.telefono && <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 1 }}>📞 {c.telefono}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: badge.color + '20', color: badge.color, flexShrink: 0, marginLeft: 10 }}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
                {clientesFiltrados.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#8A8A8A', fontSize: 13, padding: '24px 0' }}>
                    Sin resultados.
                  </div>
                )}
              </div>

              {/* Agregar nuevo cliente */}
              {!showAdd ? (
                <button onClick={() => setShowAdd(true)} style={{ padding: '9px 16px', borderRadius: 8, border: `1.5px dashed ${COLOR}`, background: `${COLOR}10`, color: COLOR, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  + Agregar nuevo cliente
                </button>
              ) : (
                <div style={{ background: 'var(--surface2)', border: `1.5px solid ${COLOR}40`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: COLOR, marginBottom: 10 }}>👤 Nuevo cliente final</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 3 }}>Nombre <span style={{ color: '#ef4444' }}>*</span></div>
                      <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: María García" style={inputSt} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 3 }}>Teléfono</div>
                      <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 9 11…" style={inputSt} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 3 }}>Mail</div>
                      <input value={nuevoCliente.mail} onChange={e => setNuevoCliente(p => ({ ...p, mail: e.target.value }))} placeholder="mail@ejemplo.com" style={inputSt} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={saveNuevoCliente} disabled={savingCliente} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: COLOR, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {savingCliente ? 'Guardando…' : '✓ Crear y seleccionar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: EQUIPOS ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Scanner */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', marginBottom: 5 }}>📡 Escáner de código de barras</div>
                <input
                  ref={scanRef}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={handleScan}
                  placeholder="Apuntá el escáner al código o escribí el IMEI y presioná Enter…"
                  style={{ ...inputSt, fontFamily: 'monospace', letterSpacing: '0.04em' }}
                  autoFocus
                />
                {scanError && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5, background: 'rgba(239,68,68,0.08)', padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.25)' }}>
                    ⚠️ {scanError}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A' }}>
                📱 Disponibles ({disponibles.length}) — seleccionados: <span style={{ color: COLOR }}>{selectedIds.size}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 360, overflowY: 'auto' }}>
                {disponibles.map(eq => {
                  const isSelected = selectedIds.has(eq.id)
                  const { ok, total } = funcionesOk(eq.funciones, eq.modelo)
                  return (
                    <div key={eq.id} onClick={() => toggleEquipo(eq.id)} style={{
                      padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                      background: isSelected ? `${COLOR}10` : 'var(--surface2)',
                      border: `1.5px solid ${isSelected ? COLOR : 'var(--border)'}`,
                      display: 'flex', gap: 12, alignItems: 'center', transition: 'all 0.1s',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: isSelected ? COLOR : 'var(--surface)',
                        border: `2px solid ${isSelected ? COLOR : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{eq.modelo}</span>
                          {estadoBadge(eq.estado)}
                        </div>
                        <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {eq.capacidad && <span>{eq.capacidad}</span>}
                          {eq.color && <span>🎨 {eq.color}</span>}
                          {eq.imei && <span style={{ fontFamily: 'monospace' }}>IMEI: {eq.imei}</span>}
                          <span>{ok}/{total} func.</span>
                          <span>N° {String(eq.nOrden ?? '').padStart(4, '0')}</span>
                        </div>
                      </div>
                      {eq.precioVenta > 0 && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>
                            {eq.monedaVenta === 'USD' ? `U$D ${eq.precioVenta}` : fmtARS(eq.precioVenta)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {disponibles.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#8A8A8A', fontSize: 13, padding: '32px 0' }}>
                    No hay equipos disponibles en stock o reparación.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: CONFIRMAR ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Resumen cliente */}
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Cliente</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCliente?.nombre}</div>
                {selectedCliente?.empresa && <div style={{ fontSize: 12, color: '#8A8A8A' }}>{selectedCliente.empresa}</div>}
                {selectedCliente?.telefono && <div style={{ fontSize: 12, color: '#8A8A8A' }}>📞 {selectedCliente.telefono}</div>}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: TIPO_BADGE[selectedCliente!.tipo].color + '20', color: TIPO_BADGE[selectedCliente!.tipo].color, marginTop: 4, display: 'inline-block' }}>
                  {TIPO_BADGE[selectedCliente!.tipo].label}
                </span>
              </div>

              {/* Resumen equipos */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📱 Equipos ({selectedEquipos.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedEquipos.map(eq => (
                    <div key={eq.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{eq.modelo}</span>
                        <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 1 }}>
                          {[eq.capacidad, eq.color, eq.imei ? `IMEI: ${eq.imei}` : ''].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {eq.precioVenta > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                          {eq.monedaVenta === 'USD' ? `U$D ${eq.precioVenta}` : fmtARS(eq.precioVenta)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Forma de pago y fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 5 }}>Método de pago</div>
                  <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPago)} style={inputSt}>
                    {(['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta Débito', 'Tarjeta Crédito', 'Cheque'] as const).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 5 }}>Fecha de venta</div>
                  <input type="date" value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} style={inputSt} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 5 }}>Notas (opcional)</div>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Ej: entrega con caja y cargador, pago en cuotas…"
                  style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, height: 'auto' }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={step === 1 ? onClose : () => setStep(s => (s - 1) as 1 | 2 | 3)}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 2 | 3)}
              disabled={!canNext}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: canNext ? COLOR : '#aaa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: canNext ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: saving ? '#aaa' : '#22c55e', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Guardando…' : `✓ Confirmar venta (${selectedEquipos.length} equipo${selectedEquipos.length !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Sub-vista: Stock de equipos
// ════════════════════════════════════════════════════════════════════════════
function StockEquiposTab({ proveedores, onRefreshProveedores, config }: { proveedores: ProveedorEquipo[]; onRefreshProveedores: () => void; config: EquiposConfig }) {
  const { data, loading, refresh } = useApi<EquipoUsado[]>('/api/sistema/equipos')
  const equipos: EquipoUsado[] = data ?? []
  const [modal, setModal]         = useState<false | 'new' | 'edit'>(false)
  const [form, setForm]           = useState<FormState>(buildEmpty())
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoEquipo | 'Todos'>('Todos')
  const [lightbox, setLightbox]   = useState<string | null>(null)
  const [printPending, setPrintPending]   = useState<EquipoUsado | null>(null)
  const [repairPending, setRepairPending] = useState<EquipoUsado | null>(null)
  const [labelSize, setLabelSize]         = useState<LabelSizeId>(config.labelSize)
  const [ventaModal, setVentaModal]       = useState(false)
  useEffect(() => { setLabelSize(config.labelSize) }, [config.labelSize])
  // ── Modal rápido de proveedor ──
  type ProvForm = Omit<ProveedorEquipo, 'id' | 'createdAt'>
  const emptyProv = (): ProvForm => ({ nombre: '', apellido: '', empresa: '', cuil: '', telefono: '', direccion: '' })
  const [quickProv, setQuickProv]   = useState(false)
  const [provForm, setProvForm]     = useState<ProvForm>(emptyProv())
  const [savingProv, setSavingProv] = useState(false)
  const setProv = (k: keyof ProvForm, v: string) => setProvForm(p => ({ ...p, [k]: v }))

  const saveQuickProv = async () => {
    if (!provForm.nombre.trim()) return alert('El nombre es obligatorio')
    setSavingProv(true)
    try {
      const res = await fetch('/api/sistema/proveedores-equipos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provForm),
      })
      const created: ProveedorEquipo = await res.json()
      setQuickProv(false)
      setProvForm(emptyProv())
      onRefreshProveedores()
      set('proveedorId', created.id)   // auto-selecciona el nuevo proveedor
    } finally { setSavingProv(false) }
  }

  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormState, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const setModelo = (modelo: string) =>
    setForm(p => ({ ...p, modelo, color: '', capacidad: '', funciones: { ...p.funciones, camaras: [] } }))

  const setFuncion = (k: keyof Omit<ChecklistFunciones, 'camaras'>, v: boolean) =>
    setForm(p => ({ ...p, funciones: { ...p.funciones, [k]: v } }))

  const toggleCamera = (zoom: string, checked: boolean) =>
    setForm(p => ({
      ...p,
      funciones: {
        ...p.funciones,
        camaras: checked
          ? [...p.funciones.camaras, zoom]
          : p.funciones.camaras.filter(z => z !== zoom),
      },
    }))

  const addFotos = async (files: FileList) => {
    if (form.fotos.length + files.length > 8) return alert('Máximo 8 fotos por equipo.')
    const compressed = await Promise.all(Array.from(files).map(f => compressImage(f)))
    setForm(p => ({ ...p, fotos: [...p.fotos, ...compressed] }))
  }

  const removeFoto = (idx: number) =>
    setForm(p => ({ ...p, fotos: p.fotos.filter((_, i) => i !== idx) }))

  const openNew  = () => { setForm(buildEmpty()); setEditId(null); setModal('new') }
  const openEdit = (eq: EquipoUsado) => {
    const { id, createdAt, ...rest } = eq
    setForm({
      ...rest,
      fotos: rest.fotos ?? [],
      monedaCompra: rest.monedaCompra ?? 'USD',
      monedaVenta:  rest.monedaVenta  ?? 'USD',
      detallesFisicos: rest.detallesFisicos ?? '',
      proveedorId: rest.proveedorId ?? '',
    })
    setEditId(id); setModal('edit')
  }

  const save = async () => {
    if (!form.modelo) return alert('El modelo es obligatorio')
    setSaving(true)
    try {
      const body = editId ? { id: editId, ...form } : form
      const res = await fetch('/api/sistema/equipos', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const saved: EquipoUsado = await res.json()
      setModal(false)
      refresh()
      if (!editId) {
        const faults = listFaults(saved.funciones, saved.modelo)
        if (faults.length > 0) setRepairPending(saved)   // hay fallas → preguntar
        else                   setPrintPending(saved)     // sin fallas → ir directo a etiqueta
      }
    } finally { setSaving(false) }
  }

  const { confirm: confirmDialog, dialog: confirmEl } = useConfirm()

  const del = async (id: string, modelo: string) => {
    const ok = await confirmDialog({ title: 'Eliminar equipo', message: `¿Eliminar "${modelo}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    await fetch('/api/sistema/equipos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    refresh()
  }

  // Equipos vendidos se muestran en la pestaña "Vendidos"
  const filtered = equipos.filter(eq => {
    if (eq.estado === 'Vendido') return false   // excluir vendidos del stock
    const q = search.toLowerCase()
    return (!q || eq.modelo.toLowerCase().includes(q) || eq.color.toLowerCase().includes(q) || (eq.imei ?? '').includes(q))
      && (filterEstado === 'Todos' || eq.estado === filterEstado)
  })

  const enStock    = equipos.filter(e => e.estado === 'En stock').length
  const vendidos   = equipos.filter(e => e.estado === 'Vendido').length
  const reservados = equipos.filter(e => e.estado === 'Reservado').length
  const formCameras = getCameras(form.modelo)

  const { data: comprasData } = useApi<CompraCliente[]>('/api/sistema/compras-clientes')
  const comprasMap = useMemo(() => {
    const m: Record<string, CompraCliente> = {}
    ;(comprasData ?? []).forEach(c => { if (c.equipoId) m[c.equipoId] = c })
    return m
  }, [comprasData])

  const provNombre = (id: string) => {
    const p = proveedores.find(p => p.id === id)
    if (!p) return ''
    return p.empresa ? p.empresa : `${p.nombre} ${p.apellido}`
  }

  // Origen del equipo: proveedor registrado o cliente particular
  const origenEquipo = (eq: EquipoUsado): { label: string; icon: string } | null => {
    const prov = provNombre(eq.proveedorId ?? '')
    if (prov) return { label: prov, icon: '🏢' }
    const compra = comprasMap[eq.id]
    if (compra) return { label: `${compra.nombreCliente}${compra.dniCliente ? ` · DNI ${compra.dniCliente}` : ''}`, icon: '👤' }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'En stock',   v: enStock,    c: '#22c55e' },
          { label: 'Reservados', v: reservados, c: COLOR },
          { label: 'Vendidos',   v: vendidos,   c: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${k.c}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por modelo, color o IMEI…" style={{ ...inputSt, flex: 1, minWidth: 180 }} />
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoEquipo | 'Todos')} style={{ ...inputSt, width: 145 }}>
          <option value="Todos">Todos</option>
          <option value="En stock">En stock</option>
          <option value="Reservado">Reservado</option>
          <option value="En reparación">En reparación</option>
        </select>
        <button onClick={() => setVentaModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
          🛒 Venta
        </button>
        <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Agregar equipo
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#676767', fontSize: 13, textAlign: 'center', padding: 40 }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: '#676767', fontSize: 13 }}>
          {equipos.length === 0 ? 'No hay equipos cargados. Hacé clic en "+ Agregar equipo".' : 'Sin resultados para la búsqueda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(eq => {
            const { ok, total } = funcionesOk(eq.funciones, eq.modelo)
            const pct = total > 0 ? Math.round((ok / total) * 100) : 0
            const cameras = getCameras(eq.modelo)
            const origen = origenEquipo(eq)
            return (
              <div key={eq.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, alignItems: 'center' }}>
                  {/* Info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{eq.modelo}</span>
                      {estadoBadge(eq.estado)}
                      {origen && (
                        <span style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5 }}>
                          {origen.icon} {origen.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#8A8A8A', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>🎨 {eq.color || '—'}</span>
                      <span>💾 {eq.capacidad}</span>
                      {eq.imei && <span>IMEI: {eq.imei}</span>}
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {cameras.map(z => {
                          const ok = eq.funciones.camaras?.includes(z)
                          return (
                            <span key={z} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2, background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: ok ? '#22c55e' : '#ef4444', border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.35)'}` }}>
                              📷{z} {ok ? '✓' : '✗'}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    {/* Fotos mini */}
                    {(eq.fotos?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {eq.fotos.map((f, i) => (
                          <img key={i} src={f} alt="" onClick={() => setLightbox(f)}
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--border)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Funciones */}
                  <div style={{ textAlign: 'center', minWidth: 70 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#22c55e' : pct >= 80 ? COLOR : '#ef4444' }}>{ok}/{total}</div>
                    <div style={{ fontSize: 10, color: '#676767' }}>funciones OK</div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 80 ? COLOR : '#ef4444', borderRadius: 2 }} />
                    </div>
                  </div>
                  {/* Precios */}
                  <div style={{ textAlign: 'right', minWidth: 110 }}>
                    {eq.precioCompra > 0 && <div style={{ fontSize: 11, color: '#676767' }}>Costo: {eq.monedaCompra === 'USD' ? `U$D ${eq.precioCompra}` : fmtARS(eq.precioCompra)}</div>}
                    {eq.precioVenta  > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>Venta: {eq.monedaVenta === 'USD' ? `U$D ${eq.precioVenta}` : fmtARS(eq.precioVenta)}</div>}
                  </div>
                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(eq)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>Editar</button>
                    <button onClick={() => del(eq.id, eq.modelo)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#676767', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} />
        </div>
      )}

      {/* Modal agregar/editar */}
      {modal && (
        <Modal
          title={modal === 'new' ? '📱 Agregar equipo' : '✏️ Editar equipo'}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitLabel={modal === 'new' ? 'Agregar al stock' : 'Guardar'}
          submitting={saving}
          submitColor={COLOR}
          width={660}
        >
          {/* Datos básicos */}
          <SectionDivider label="Datos del equipo" />
          <FormGrid cols={2}>
            <Field label="Modelo" required col={2}>
              <SearchableSelect value={form.modelo} onChange={setModelo} options={MODELOS_DISPOSITIVOS} placeholder="Buscar modelo…" />
            </Field>
            <Field label="Color">
              {!form.modelo ? (
                <div style={{ ...inputSt, color: '#676767', fontSize: 12, display: 'flex', alignItems: 'center', height: 38 }}>
                  Seleccioná un modelo primero
                </div>
              ) : (
                <select value={form.color} onChange={e => set('color', e.target.value)} style={inputSt}>
                  <option value="">— Seleccionar color —</option>
                  {getColores(form.modelo).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </Field>
            <Field label="Capacidad">
              {!form.modelo ? (
                <div style={{ ...inputSt, color: '#676767', fontSize: 12, display: 'flex', alignItems: 'center', height: 38 }}>
                  Seleccioná un modelo primero
                </div>
              ) : (
                <select value={form.capacidad} onChange={e => set('capacidad', e.target.value)} style={inputSt}>
                  <option value="">— Seleccionar capacidad —</option>
                  {getCapacidades(form.modelo).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </Field>
            <Field label="IMEI">
              <input value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="15 dígitos…" maxLength={20} style={inputSt} />
            </Field>
            <Field label="Batería">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range" min={0} max={100} step={1}
                  value={form.bateria ?? 0}
                  onChange={e => set('bateria', Number(e.target.value))}
                  style={{ flex: 1, accentColor: (form.bateria??0) >= 60 ? '#22c55e' : (form.bateria??0) >= 30 ? '#f59e0b' : '#ef4444' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <input
                    type="number" min={0} max={100}
                    value={form.bateria ?? 0}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, Number(e.target.value)))
                      set('bateria', isNaN(v) ? 0 : v)
                    }}
                    style={{
                      ...inputSt, width: 56, textAlign: 'center', fontWeight: 800, padding: '6px 6px',
                      color: (form.bateria??0) >= 60 ? '#22c55e' : (form.bateria??0) >= 30 ? '#f59e0b' : '#ef4444',
                      borderColor: (form.bateria??0) >= 60 ? 'rgba(34,197,94,0.4)' : (form.bateria??0) >= 30 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#8A8A8A' }}>%</span>
                </div>
              </div>
            </Field>
            <Field label="Proveedor" col={2}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.proveedorId} onChange={e => set('proveedorId', e.target.value)} style={{ ...inputSt, flex: 1 }}>
                  <option value="">— Sin proveedor —</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.empresa ? `${p.empresa} — ` : ''}{p.nombre} {p.apellido}{p.telefono ? ` · ${p.telefono}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setProvForm(emptyProv()); setQuickProv(true) }}
                  title="Agregar nuevo proveedor"
                  style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${COLOR}`, background: `${COLOR}15`, color: COLOR, fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                >+</button>
              </div>
            </Field>

            {/* Mini-modal: nuevo proveedor rápido */}
            {quickProv && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--surface2)', border: `1.5px solid ${COLOR}40`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: COLOR, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>👤 Nuevo proveedor</span>
                  <button onClick={() => setQuickProv(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>Empresa / Razón social</div>
                    <input value={provForm.empresa} onChange={e => setProv('empresa', e.target.value)} placeholder="Ej: Cokocell S.A." style={inputSt} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>Nombre <span style={{ color: '#ef4444' }}>*</span></div>
                    <input value={provForm.nombre} onChange={e => setProv('nombre', e.target.value)} placeholder="Juan" style={inputSt} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>Apellido</div>
                    <input value={provForm.apellido} onChange={e => setProv('apellido', e.target.value)} placeholder="García" style={inputSt} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>Teléfono</div>
                    <input value={provForm.telefono} onChange={e => setProv('telefono', e.target.value)} placeholder="+54 9 11 1234-5678" style={inputSt} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>CUIL / CUIT</div>
                    <input value={provForm.cuil} onChange={e => setProv('cuil', e.target.value)} placeholder="20-12345678-9" style={inputSt} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => setQuickProv(false)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Cancelar
                  </button>
                  <button onClick={saveQuickProv} disabled={savingProv} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: COLOR, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                    {savingProv ? 'Guardando…' : '✓ Crear y seleccionar'}
                  </button>
                </div>
              </div>
            )}
          </FormGrid>

          {/* Funciones */}
          <SectionDivider label="Funciones probadas" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {GRUPOS_FUNCIONES.map(grupo => (
              <div key={grupo.label}>
                {/* Encabezado de grupo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>{grupo.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{grupo.label}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
                </div>
                {/* Tiles del grupo */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {grupo.keys.map(key => {
                    const { label, icon } = FUNCION_META[key]
                    const checked = form.funciones[key] as boolean
                    return (
                      <label key={key} onClick={() => setFuncion(key, !checked)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '8px 10px', borderRadius: 10, cursor: 'pointer', width: 88, minHeight: 72,
                        background: checked ? 'rgba(34,197,94,0.09)' : 'rgba(239,68,68,0.06)',
                        border: `1.5px solid ${checked ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
                        transition: 'all 0.12s', gap: 3, textAlign: 'center', userSelect: 'none',
                      }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: checked ? '#22c55e' : 'var(--text-secondary)', lineHeight: 1.25, marginTop: 2 }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: checked ? '#22c55e' : '#ef4444', marginTop: 1 }}>
                          {checked ? '✓' : '✗'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Cámaras */}
          <SectionDivider label={`📷 Cámaras traseras${form.modelo ? ` — ${form.modelo}` : ''}`} />
          {!form.modelo ? (
            <div style={{ fontSize: 12, color: '#676767', padding: '8px 0' }}>Seleccioná un modelo para ver las cámaras disponibles.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {formCameras.map(zoom => {
                  const checked = form.funciones.camaras.includes(zoom)
                  return (
                    <label key={zoom} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderRadius: 10, cursor: 'pointer', background: checked ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.07)', border: `2px solid ${checked ? '#22c55e' : '#ef4444'}`, transition: 'all 0.12s', flex: '1 1 80px', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                      <input type="checkbox" checked={checked} onChange={e => toggleCamera(zoom, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
                      <span style={{ fontSize: 20 }}>📷</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: checked ? '#22c55e' : '#ef4444' }}>{zoom}</span>
                      {checked
                        ? <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>OK ✓</span>
                        : <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗ Falla</span>
                      }
                    </label>
                  )
                })}
              </div>
              {form.funciones.camaras.length < formCameras.length && (
                <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '7px 12px', marginTop: 4 }}>
                  ⚠️ Hay cámaras con falla — describí el desperfecto en <strong>Detalles físicos</strong> (ej: "manchas cámara 1x", "no enfoca 0.5x").
                </div>
              )}
            </>
          )}

          {/* Fotos */}
          <SectionDivider label="Fotos del equipo" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Grid de fotos */}
            {form.fotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {form.fotos.map((foto, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={foto} alt={`Foto ${i + 1}`} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                    <button onClick={() => removeFoto(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {/* Zona de carga */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLOR }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={async e => {
                e.preventDefault()
                e.currentTarget.style.borderColor = 'var(--border)'
                if (e.dataTransfer.files.length) await addFotos(e.dataTransfer.files)
              }}
              style={{ border: `2px dashed var(--border)`, borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Hacé clic o arrastrá fotos aquí</div>
              <div style={{ fontSize: 11, color: '#676767', marginTop: 3 }}>JPG, PNG, HEIC · Máx. 8 fotos · Se comprimen automáticamente</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={async e => { if (e.target.files) { await addFotos(e.target.files); e.target.value = '' } }} />
          </div>

          {/* Detalles físicos */}
          <SectionDivider label="Detalles físicos" />
          <textarea
            value={form.detallesFisicos}
            onChange={e => set('detallesFisicos', e.target.value)}
            placeholder="Describí el estado físico: rayones, golpes, pantalla, marcos, tapa trasera… Si alguna cámara tiene falla indicá el detalle (ej: manchas cámara 1x, no enfoca 0.5x)."
            rows={4}
            style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, minHeight: 90, height: 'auto' }}
          />

          {/* Precio */}
          <SectionDivider label="Precio de compra y venta" />
          <FormGrid cols={2}>
            <Field label="Precio de compra">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <MonedaToggle value={form.monedaCompra} onChange={v => set('monedaCompra', v)} />
                <input type="number" value={form.precioCompra || ''} onChange={e => set('precioCompra', Number(e.target.value))} placeholder="0" style={{ ...inputSt, flex: 1 }} />
              </div>
            </Field>
            <Field label="Precio de venta">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <MonedaToggle value={form.monedaVenta} onChange={v => set('monedaVenta', v)} />
                <input type="number" value={form.precioVenta || ''} onChange={e => set('precioVenta', Number(e.target.value))} placeholder="0" style={{ ...inputSt, flex: 1 }} />
              </div>
            </Field>
          </FormGrid>

          <Field label="Fecha">
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ ...inputSt, width: 180 }} />
          </Field>
        </Modal>
      )}

      {/* Dialog: ¿enviar a reparación? */}
      {repairPending && (() => {
        const faults = listFaults(repairPending.funciones, repairPending.modelo)
        const sendToRepair = async () => {
          await fetch('/api/sistema/equipos', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: repairPending.id, estado: 'En reparación' }),
          })
          refresh()
          const updated = { ...repairPending, estado: 'En reparación' as const }
          setRepairPending(null)
          setPrintPending(updated)
        }
        const keepInStock = () => { setRepairPending(null); setPrintPending(repairPending) }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 420, width: '92%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔧</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Fallas detectadas</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>{repairPending.modelo}</strong>{repairPending.capacidad ? ` · ${repairPending.capacidad}` : ''}
                </div>
              </div>
              {/* Lista de fallas */}
              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ca8a04', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚠️ {faults.length} {faults.length === 1 ? 'falla' : 'fallas'} encontradas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {faults.map(f => (
                    <span key={f} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                      ✗ {f}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 18 }}>
                ¿Querés enviar este equipo a reparación?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={sendToRepair} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: '#ca8a04', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  🔧 Sí, enviar a reparación
                </button>
                <button onClick={keepInStock} style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Dejar en stock
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {confirmEl}

      {/* Modal de venta */}
      {ventaModal && (
        <VentaModal
          equipos={equipos}
          onClose={() => setVentaModal(false)}
          onSaved={() => { setVentaModal(false); refresh() }}
        />
      )}

      {/* Dialog: ¿imprimir etiqueta? */}
      {printPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 36px', maxWidth: 360, width: '92%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🏷️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Equipo guardado</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>
              <strong>{printPending.modelo}</strong>{printPending.capacidad ? ` · ${printPending.capacidad}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#8A8A8A', marginBottom: 8 }}>
              Orden N° {String(printPending.nOrden).padStart(4, '0')}
            </div>
            <div style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', borderRadius: 7, padding: '5px 12px', display: 'inline-block', marginBottom: 22 }}>
              🖨️ Etiqueta: {LABEL_SIZES.find(s => s.id === labelSize)?.label ?? labelSize}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              ¿Querés imprimir la etiqueta?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { printLabel(printPending, labelSize); setPrintPending(null) }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                🖨️ Sí, imprimir
              </button>
              <button
                onClick={() => setPrintPending(null)}
                style={{ padding: '12px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Sub-vista: Equipos en reparación
// ════════════════════════════════════════════════════════════════════════════
function ReparacionTab({ proveedores }: { proveedores: ProveedorEquipo[] }) {
  const { data, loading, refresh } = useApi<EquipoUsado[]>('/api/sistema/equipos')
  const todos: EquipoUsado[] = data ?? []
  const equipos = todos.filter(e => e.estado === 'En reparación')
  const [search, setSearch] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data: comprasData } = useApi<CompraCliente[]>('/api/sistema/compras-clientes')
  const comprasMap = useMemo(() => {
    const m: Record<string, CompraCliente> = {}
    ;(comprasData ?? []).forEach(c => { if (c.equipoId) m[c.equipoId] = c })
    return m
  }, [comprasData])

  const origenEquipo = (eq: EquipoUsado) => {
    const p = proveedores.find(p => p.id === eq.proveedorId)
    if (p) return { label: p.empresa || `${p.nombre} ${p.apellido}`, icon: '🏢' }
    const compra = comprasMap[eq.id]
    if (compra) return { label: `${compra.nombreCliente}${compra.dniCliente ? ` · DNI ${compra.dniCliente}` : ''}`, icon: '👤' }
    return null
  }

  const { confirm: confirmDialog, dialog: confirmEl } = useConfirm()

  const marcarReparado = async (eq: EquipoUsado) => {
    const ok = await confirmDialog({ title: 'Reparación completada', message: `¿Marcar "${eq.modelo}" como reparado y mover al stock?`, confirmLabel: '✓ Sí, al stock' })
    if (!ok) return
    await fetch('/api/sistema/equipos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eq.id, estado: 'En stock' }),
    })
    refresh()
  }

  const filtered = equipos.filter(eq => {
    const q = search.toLowerCase()
    return !q || eq.modelo.toLowerCase().includes(q) || (eq.imei ?? '').includes(q) || eq.color.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 12, padding: '14px 20px', borderLeft: '4px solid #ca8a04', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 28 }}>🔧</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ca8a04' }}>{equipos.length}</div>
          <div style={{ fontSize: 11, color: '#676767' }}>equipo{equipos.length !== 1 ? 's' : ''} en reparación</div>
        </div>
      </div>

      {/* Búsqueda */}
      {equipos.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por modelo, color o IMEI…" style={{ ...inputSt }} />
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#676767', fontSize: 13, textAlign: 'center', padding: 40 }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: '#676767', fontSize: 13 }}>
          {equipos.length === 0 ? 'No hay equipos en reparación.' : 'Sin resultados.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(eq => {
            const faults = listFaults(eq.funciones, eq.modelo)
            const cameras = getCameras(eq.modelo)
            const origen = origenEquipo(eq)
            return (
              <div key={eq.id} style={{ background: 'var(--surface)', border: '1.5px solid rgba(234,179,8,0.35)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{eq.modelo}</span>
                      {estadoBadge(eq.estado)}
                      {origen && <span style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5 }}>{origen.icon} {origen.label}</span>}
                    </div>
                    {/* Datos */}
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#8A8A8A', flexWrap: 'wrap', marginBottom: 10 }}>
                      {eq.capacidad && <span>💾 {eq.capacidad}</span>}
                      {eq.color && <span>🎨 {eq.color}</span>}
                      {eq.imei && <span>IMEI: {eq.imei}</span>}
                      {eq.bateria !== undefined && <span>🔋 {eq.bateria}%</span>}
                      <span style={{ color: '#ca8a04' }}>N° {String(eq.nOrden).padStart(4, '0')}</span>
                    </div>
                    {/* Fallas */}
                    {faults.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#ca8a04', marginBottom: 5 }}>⚠️ Fallas registradas</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {faults.map(f => (
                            <span key={f} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>✗ {f}</span>
                          ))}
                          {/* Cámaras OK */}
                          {cameras.map(z => {
                            const ok = eq.funciones.camaras?.includes(z)
                            if (!ok) return null
                            return <span key={z} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', fontWeight: 600 }}>📷{z} ✓</span>
                          })}
                        </div>
                      </div>
                    )}
                    {/* Detalles físicos */}
                    {eq.detallesFisicos && (
                      <div style={{ fontSize: 12, color: '#8A8A8A', fontStyle: 'italic', marginBottom: 8, background: 'var(--surface2)', padding: '6px 10px', borderRadius: 7 }}>
                        "{eq.detallesFisicos}"
                      </div>
                    )}
                    {/* Fotos */}
                    {(eq.fotos?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {eq.fotos.map((f, i) => (
                          <img key={i} src={f} alt="" onClick={() => setLightbox(f)}
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--border)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Acciones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
                    <button onClick={() => marcarReparado(eq)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ✓ Reparado
                    </button>
                    <div style={{ fontSize: 10, color: '#676767', textAlign: 'center' }}>→ vuelve al stock</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmEl}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Sub-vista: Equipos vendidos
// ════════════════════════════════════════════════════════════════════════════
function VendidosTab({ proveedores }: { proveedores: ProveedorEquipo[] }) {
  const { data, loading, refresh } = useApi<EquipoUsado[]>('/api/sistema/equipos')
  const todos: EquipoUsado[]   = data ?? []
  const equipos                = todos.filter(e => e.estado === 'Vendido')
  const [search, setSearch]    = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data: comprasData } = useApi<CompraCliente[]>('/api/sistema/compras-clientes')
  const comprasMap = useMemo(() => {
    const m: Record<string, CompraCliente> = {}
    ;(comprasData ?? []).forEach(c => { if (c.equipoId) m[c.equipoId] = c })
    return m
  }, [comprasData])

  const origenEquipo = (eq: EquipoUsado) => {
    const p = proveedores.find(p => p.id === eq.proveedorId)
    if (p) return { label: p.empresa || `${p.nombre} ${p.apellido}`, icon: '🏢' }
    const compra = comprasMap[eq.id]
    if (compra) return { label: `${compra.nombreCliente}${compra.dniCliente ? ` · DNI ${compra.dniCliente}` : ''}`, icon: '👤' }
    return null
  }

  const { confirm: confirmDialog, dialog: confirmEl } = useConfirm()

  const volverAlStock = async (eq: EquipoUsado) => {
    const ok = await confirmDialog({ title: 'Volver al stock', message: `¿Mover "${eq.modelo}" de vuelta al stock?`, confirmLabel: '↩ Sí, volver al stock' })
    if (!ok) return
    await fetch('/api/sistema/equipos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eq.id, estado: 'En stock' }),
    })
    refresh()
  }

  const eliminar = async (eq: EquipoUsado) => {
    const ok = await confirmDialog({ title: 'Eliminar equipo', message: `¿Eliminar definitivamente "${eq.modelo}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    await fetch('/api/sistema/equipos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eq.id }),
    })
    refresh()
  }

  const filtered = equipos.filter(eq => {
    const q = search.toLowerCase()
    return !q || eq.modelo.toLowerCase().includes(q) || (eq.imei ?? '').includes(q) || eq.color.toLowerCase().includes(q)
  })

  // Totales para KPIs
  const totalARS = equipos.filter(e => e.monedaVenta === 'ARS').reduce((s, e) => s + (e.precioVenta ?? 0), 0)
  const totalUSD = equipos.filter(e => e.monedaVenta === 'USD').reduce((s, e) => s + (e.precioVenta ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: '3px solid #ef4444' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{equipos.length}</div>
          <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>Equipos vendidos</div>
        </div>
        {totalUSD > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: '3px solid #16a34a' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>U$D {totalUSD.toLocaleString('es-AR')}</div>
            <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>Total vendido en USD</div>
          </div>
        )}
        {totalARS > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: '3px solid #2563eb' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>{fmtARS(totalARS)}</div>
            <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>Total vendido en ARS</div>
          </div>
        )}
      </div>

      {/* Búsqueda */}
      {equipos.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por modelo, color o IMEI…" style={{ ...inputSt }} />
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#676767', fontSize: 13, textAlign: 'center', padding: 40 }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: '#676767', fontSize: 13 }}>
          {equipos.length === 0 ? 'Todavía no hay equipos vendidos.' : 'Sin resultados.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(eq => {
            const origen = origenEquipo(eq)
            const cameras = getCameras(eq.modelo)
            return (
              <div key={eq.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{eq.modelo}</span>
                      {estadoBadge(eq.estado)}
                      <span style={{ fontSize: 11, color: '#8A8A8A' }}>N° {String(eq.nOrden).padStart(4, '0')}</span>
                      {origen && (
                        <span style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5 }}>
                          {origen.icon} {origen.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#8A8A8A', flexWrap: 'wrap', alignItems: 'center' }}>
                      {eq.capacidad && <span>💾 {eq.capacidad}</span>}
                      {eq.color     && <span>🎨 {eq.color}</span>}
                      {eq.imei      && <span>IMEI: {eq.imei}</span>}
                      {eq.bateria !== undefined && <span>🔋 {eq.bateria}%</span>}
                      {/* Cámaras */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {cameras.map(z => {
                          const ok = eq.funciones.camaras?.includes(z)
                          return <span key={z} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: ok ? '#22c55e' : '#ef4444', border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}` }}>📷{z}{ok ? ' ✓' : ' ✗'}</span>
                        })}
                      </div>
                    </div>
                    {/* Info venta */}
                    {eq.vendidoA && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', padding: '3px 10px', borderRadius: 6 }}>
                          🛒 {eq.vendidoA}
                        </span>
                        {eq.fechaVenta && <span style={{ fontSize: 11, color: '#8A8A8A' }}>📅 {eq.fechaVenta}</span>}
                        {eq.metodoPagoVenta && <span style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5 }}>💳 {eq.metodoPagoVenta}</span>}
                        {eq.vendidoTipoCliente && (() => {
                          const badge = TIPO_BADGE[eq.vendidoTipoCliente as TipoClienteUnif]
                          if (!badge) return null
                          return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: badge.color + '20', color: badge.color }}>{badge.label}</span>
                        })()}
                      </div>
                    )}
                    {/* Precios */}
                    <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12 }}>
                      {eq.precioCompra > 0 && <span style={{ color: '#8A8A8A' }}>Costo: {eq.monedaCompra === 'USD' ? `U$D ${eq.precioCompra}` : fmtARS(eq.precioCompra)}</span>}
                      {eq.precioVenta  > 0 && <span style={{ color: '#22c55e', fontWeight: 700 }}>Venta: {eq.monedaVenta === 'USD' ? `U$D ${eq.precioVenta}` : fmtARS(eq.precioVenta)}</span>}
                    </div>
                    {/* Fotos */}
                    {(eq.fotos?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                        {eq.fotos.map((f, i) => (
                          <img key={i} src={f} alt="" onClick={() => setLightbox(f)}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 5, cursor: 'zoom-in', border: '1px solid var(--border)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Acciones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
                    <button onClick={() => volverAlStock(eq)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ↩ Volver al stock
                    </button>
                    <button onClick={() => eliminar(eq)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmEl}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Sub-vista: Compras a clientes particulares
// ════════════════════════════════════════════════════════════════════════════
type CompraFormState = {
  fecha: string
  // Vendedor
  nombreCliente: string
  telefonoCliente: string
  dniCliente: string
  fotoDniFrente: string
  fotoDniDorso: string
  // Equipo
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
  tipoCambio: number
  reparaciones: ReparacionEstimada[]
  precioVentaEstimado: number
  monedaVenta: 'ARS' | 'USD'
  enviarAReparacion: boolean
  notas: string
}

function buildEmptyCompra(): CompraFormState {
  return {
    fecha: today(), nombreCliente: '', telefonoCliente: '', dniCliente: '',
    fotoDniFrente: '', fotoDniDorso: '',
    modelo: '', color: '', capacidad: '', imei: '', bateria: 0,
    funciones: emptyChecklist(), detallesFisicos: '', fotos: [],
    precioCompra: 0, monedaCompra: 'USD', tipoCambio: 1200,
    reparaciones: [], precioVentaEstimado: 0, monedaVenta: 'USD',
    enviarAReparacion: false, notas: '',
  }
}

function calcGanancia(form: CompraFormState): { compraARS: number; ventaARS: number; costoRepsARS: number; gananciaARS: number } {
  const tc = form.tipoCambio || 1
  const compraARS   = form.monedaCompra === 'USD' ? form.precioCompra * tc : form.precioCompra
  const ventaARS    = form.monedaVenta  === 'USD' ? form.precioVentaEstimado * tc : form.precioVentaEstimado
  const costoRepsARS = form.reparaciones.reduce((s, r) => s + (r.costoEstimado || 0), 0)
  const gananciaARS = ventaARS - compraARS - costoRepsARS
  return { compraARS, ventaARS, costoRepsARS, gananciaARS }
}

function ComprasClientesTab({ config }: { config: EquiposConfig }) {
  const { data, loading, refresh } = useApi<CompraCliente[]>('/api/sistema/compras-clientes')
  const compras: CompraCliente[] = data ?? []
  const [modal, setModal]     = useState<false | 'new' | 'view'>(false)
  const [selected, setSelected] = useState<CompraCliente | null>(null)
  const [form, setForm]       = useState<CompraFormState>(buildEmptyCompra())
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [printPending, setPrintPending] = useState<EquipoUsado | null>(null)
  const [labelSize, setLabelSize] = useState<LabelSizeId>(config.labelSize)
  useEffect(() => { setLabelSize(config.labelSize) }, [config.labelSize])

  const { confirm: confirmDialog, dialog: confirmEl } = useConfirm()

  const fotoDniRef  = useRef<HTMLInputElement>(null)
  const fotoDniRef2 = useRef<HTMLInputElement>(null)
  const fotoEqRef   = useRef<HTMLInputElement>(null)

  const set = (k: keyof CompraFormState, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const setModelo = (modelo: string) =>
    setForm(p => ({ ...p, modelo, color: '', capacidad: '', funciones: { ...p.funciones, camaras: [] }, reparaciones: [] }))
  const setFuncion = (k: keyof Omit<ChecklistFunciones, 'camaras'>, v: boolean) =>
    setForm(p => ({ ...p, funciones: { ...p.funciones, [k]: v } }))
  const toggleCamera = (zoom: string, checked: boolean) =>
    setForm(p => ({ ...p, funciones: { ...p.funciones, camaras: checked ? [...p.funciones.camaras, zoom] : p.funciones.camaras.filter(z => z !== zoom) } }))

  // Sync reparaciones con fallas detectadas
  useEffect(() => {
    if (!modal) return
    const faults = listFaults(form.funciones, form.modelo)
    setForm(prev => ({
      ...prev,
      reparaciones: faults.map(f => ({
        falla: f,
        costoEstimado: prev.reparaciones.find(r => r.falla === f)?.costoEstimado ?? 0,
      })),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.funciones, form.modelo, modal])

  const addFotos = async (files: FileList) => {
    if (form.fotos.length + files.length > 8) return alert('Máximo 8 fotos.')
    const compressed = await Promise.all(Array.from(files).map(f => compressImage(f)))
    setForm(p => ({ ...p, fotos: [...p.fotos, ...compressed] }))
  }

  const loadDniFoto = async (file: File, side: 'frente' | 'dorso') => {
    const compressed = await compressImage(file, 1200)
    if (side === 'frente') set('fotoDniFrente', compressed)
    else set('fotoDniDorso', compressed)
  }

  const openNew  = () => { setForm(buildEmptyCompra()); setModal('new') }
  const openView = (c: CompraCliente) => { setSelected(c); setModal('view') }

  const save = async () => {
    if (!form.modelo.trim())         return alert('El modelo es obligatorio')
    if (!form.nombreCliente.trim())  return alert('El nombre del cliente es obligatorio')
    setSaving(true)
    try {
      const { costoRepsARS, compraARS, ventaARS, gananciaARS } = calcGanancia(form)
      const body = {
        fecha: form.fecha,
        nombreCliente: form.nombreCliente, telefonoCliente: form.telefonoCliente,
        dniCliente: form.dniCliente, fotoDniFrente: form.fotoDniFrente, fotoDniDorso: form.fotoDniDorso,
        modelo: form.modelo, color: form.color, capacidad: form.capacidad,
        imei: form.imei, bateria: form.bateria, funciones: form.funciones,
        detallesFisicos: form.detallesFisicos, fotos: form.fotos,
        precioCompra: form.precioCompra, monedaCompra: form.monedaCompra,
        tipoCambio: form.tipoCambio,
        reparaciones: form.reparaciones,
        costoReparacionesARS: costoRepsARS,
        precioVentaEstimado: form.precioVentaEstimado, monedaVenta: form.monedaVenta,
        gananciaEstimadaARS: gananciaARS,
        enviarAReparacion: form.enviarAReparacion,
        notas: form.notas,
      }
      const res = await fetch('/api/sistema/compras-clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const { equipo } = await res.json()
      setModal(false)
      refresh()
      setPrintPending(equipo)
    } finally { setSaving(false) }
  }

  const del = async (c: CompraCliente) => {
    const ok = await confirmDialog({ title: 'Eliminar compra', message: `¿Eliminar la compra de "${c.modelo}" de ${c.nombreCliente}? El equipo en stock no se elimina.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    await fetch('/api/sistema/compras-clientes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    })
    refresh()
  }

  const filtered = compras.filter(c => {
    const q = search.toLowerCase()
    return !q || c.modelo.toLowerCase().includes(q) || c.nombreCliente.toLowerCase().includes(q) || (c.imei ?? '').includes(q)
  })

  // KPIs
  const totalInvertidoARS = compras.reduce((s, c) => s + (c.monedaCompra === 'USD' ? c.precioCompra * (c.tipoCambio || 1) : c.precioCompra), 0)
  const gananciaEstTotalARS = compras.reduce((s, c) => s + (c.gananciaEstimadaARS ?? 0), 0)
  const formCameras = getCameras(form.modelo)
  const { compraARS, ventaARS, costoRepsARS, gananciaARS } = calcGanancia(form)

  const renderFormModal = () => (
    <Modal
      title="💰 Compra a cliente particular"
      onClose={() => setModal(false)}
      onSubmit={save}
      submitLabel="Registrar compra"
      submitting={saving}
      submitColor={COLOR}
      width={700}
    >
      {/* ── Datos del vendedor ── */}
      <SectionDivider label="Datos del vendedor" />
      <FormGrid cols={2}>
        <Field label="Nombre completo" required col={2}>
          <input value={form.nombreCliente} onChange={e => set('nombreCliente', e.target.value)} placeholder="Juan García" style={inputSt} />
        </Field>
        <Field label="Teléfono">
          <input value={form.telefonoCliente} onChange={e => set('telefonoCliente', e.target.value)} placeholder="+54 9 11 1234-5678" style={inputSt} />
        </Field>
        <Field label="Número de DNI">
          <input value={form.dniCliente} onChange={e => set('dniCliente', e.target.value)} placeholder="12.345.678" maxLength={12} style={inputSt} />
        </Field>
      </FormGrid>

      {/* Fotos DNI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
        {(['frente', 'dorso'] as const).map(side => {
          const foto = side === 'frente' ? form.fotoDniFrente : form.fotoDniDorso
          const ref  = side === 'frente' ? fotoDniRef : fotoDniRef2
          return (
            <div key={side}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8A', marginBottom: 6 }}>
                📄 DNI {side === 'frente' ? 'frente' : 'dorso'}
              </div>
              {foto ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={foto} alt={`DNI ${side}`} style={{ width: '100%', maxWidth: 280, height: 140, objectFit: 'cover', borderRadius: 8, border: `2px solid ${COLOR}`, display: 'block' }} />
                  <button onClick={() => side === 'frente' ? set('fotoDniFrente', '') : set('fotoDniDorso', '')}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ) : (
                <div onClick={() => ref.current?.click()} style={{ border: `2px dashed var(--border)`, borderRadius: 8, padding: '22px 12px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface2)', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = COLOR)} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🪪</div>
                  <div style={{ fontSize: 11, color: '#8A8A8A' }}>Subir foto DNI {side === 'frente' ? 'frente' : 'dorso'}</div>
                </div>
              )}
              <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) { loadDniFoto(e.target.files[0], side); e.target.value = '' } }} />
            </div>
          )
        })}
      </div>

      {/* ── Datos del equipo ── */}
      <SectionDivider label="Datos del equipo" />
      <FormGrid cols={2}>
        <Field label="Modelo" required col={2}>
          <SearchableSelect value={form.modelo} onChange={setModelo} options={MODELOS_DISPOSITIVOS} placeholder="Buscar modelo…" />
        </Field>
        <Field label="Color">
          {!form.modelo ? <div style={{ ...inputSt, color: '#676767', fontSize: 12, display: 'flex', alignItems: 'center', height: 38 }}>Seleccioná un modelo</div> : (
            <select value={form.color} onChange={e => set('color', e.target.value)} style={inputSt}>
              <option value="">— Color —</option>
              {getColores(form.modelo).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field label="Capacidad">
          {!form.modelo ? <div style={{ ...inputSt, color: '#676767', fontSize: 12, display: 'flex', alignItems: 'center', height: 38 }}>Seleccioná un modelo</div> : (
            <select value={form.capacidad} onChange={e => set('capacidad', e.target.value)} style={inputSt}>
              <option value="">— Capacidad —</option>
              {getCapacidades(form.modelo).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field label="IMEI">
          <input value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="15 dígitos…" maxLength={20} style={inputSt} />
        </Field>
        <Field label="Batería">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={0} max={100} step={1} value={form.bateria ?? 0}
              onChange={e => set('bateria', Number(e.target.value))}
              style={{ flex: 1, accentColor: (form.bateria ?? 0) >= 60 ? '#22c55e' : (form.bateria ?? 0) >= 30 ? '#f59e0b' : '#ef4444' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <input type="number" min={0} max={100} value={form.bateria ?? 0}
                onChange={e => { const v = Math.min(100, Math.max(0, Number(e.target.value))); set('bateria', isNaN(v) ? 0 : v) }}
                style={{ ...inputSt, width: 56, textAlign: 'center', fontWeight: 800, padding: '6px 6px',
                  color: (form.bateria ?? 0) >= 60 ? '#22c55e' : (form.bateria ?? 0) >= 30 ? '#f59e0b' : '#ef4444',
                  borderColor: (form.bateria ?? 0) >= 60 ? 'rgba(34,197,94,0.4)' : (form.bateria ?? 0) >= 30 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#8A8A8A' }}>%</span>
            </div>
          </div>
        </Field>
      </FormGrid>

      {/* ── Funciones ── */}
      <SectionDivider label="Funciones probadas" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                const checked = form.funciones[key] as boolean
                return (
                  <label key={key} onClick={() => setFuncion(key, !checked)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer', width: 88, minHeight: 72,
                    background: checked ? 'rgba(34,197,94,0.09)' : 'rgba(239,68,68,0.06)',
                    border: `1.5px solid ${checked ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
                    transition: 'all 0.12s', gap: 3, textAlign: 'center', userSelect: 'none',
                  }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: checked ? '#22c55e' : 'var(--text-secondary)', lineHeight: 1.25, marginTop: 2 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: checked ? '#22c55e' : '#ef4444', marginTop: 1 }}>{checked ? '✓' : '✗'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Cámaras ── */}
      <SectionDivider label={`📷 Cámaras traseras${form.modelo ? ` — ${form.modelo}` : ''}`} />
      {!form.modelo ? (
        <div style={{ fontSize: 12, color: '#676767', padding: '8px 0' }}>Seleccioná un modelo para ver las cámaras disponibles.</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {formCameras.map(zoom => {
            const checked = form.funciones.camaras.includes(zoom)
            return (
              <label key={zoom} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderRadius: 10, cursor: 'pointer', background: checked ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.07)', border: `2px solid ${checked ? '#22c55e' : '#ef4444'}`, transition: 'all 0.12s', flex: '1 1 80px', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                <input type="checkbox" checked={checked} onChange={e => toggleCamera(zoom, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
                <span style={{ fontSize: 20 }}>📷</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: checked ? '#22c55e' : '#ef4444' }}>{zoom}</span>
                {checked ? <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>OK ✓</span> : <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗ Falla</span>}
              </label>
            )
          })}
        </div>
      )}

      {/* ── Costos de reparación ── */}
      <SectionDivider label={`🔧 Costos de reparación estimados${form.reparaciones.length > 0 ? ` (${form.reparaciones.length} falla${form.reparaciones.length > 1 ? 's' : ''})` : ''}`} />
      {form.reparaciones.length === 0 ? (
        <div style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px' }}>
          ✓ Sin fallas detectadas — no hay reparaciones necesarias
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.reparaciones.map((rep, idx) => (
            <div key={rep.falla} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', flex: 1 }}>✗ {rep.falla}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#8A8A8A' }}>Costo estimado:</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8A' }}>$</span>
                <input
                  type="number" min={0} placeholder="0"
                  value={rep.costoEstimado || ''}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value) || 0)
                    setForm(prev => ({ ...prev, reparaciones: prev.reparaciones.map((r, i) => i === idx ? { ...r, costoEstimado: val } : r) }))
                  }}
                  style={{ ...inputSt, width: 110, textAlign: 'right', fontWeight: 700 }}
                />
              </div>
            </div>
          ))}
          {/* Total reparaciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
              Total reparaciones: {fmtARS(form.reparaciones.reduce((s, r) => s + (r.costoEstimado || 0), 0))}
            </span>
          </div>
          {/* Toggle enviar a reparación */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: form.enviarAReparacion ? 'rgba(202,138,4,0.08)' : 'var(--surface2)', border: `1.5px solid ${form.enviarAReparacion ? 'rgba(202,138,4,0.4)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.12s' }}>
            <input type="checkbox" checked={form.enviarAReparacion} onChange={e => set('enviarAReparacion', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ca8a04', cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: form.enviarAReparacion ? '#ca8a04' : 'var(--text-primary)' }}>🔧 Enviar a reparación al guardar</div>
              <div style={{ fontSize: 11, color: '#8A8A8A' }}>El equipo quedará en la pestaña "Reparación" en vez de "Stock"</div>
            </div>
          </label>
        </div>
      )}

      {/* ── Análisis financiero ── */}
      <SectionDivider label="📊 Análisis financiero" />
      <FormGrid cols={2}>
        <Field label="Precio de compra (pagado al cliente)">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MonedaToggle value={form.monedaCompra} onChange={v => set('monedaCompra', v)} />
            <input type="number" min={0} value={form.precioCompra || ''} onChange={e => set('precioCompra', Number(e.target.value))} placeholder="0" style={{ ...inputSt, flex: 1 }} />
          </div>
        </Field>
        <Field label="Precio de venta estimado">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MonedaToggle value={form.monedaVenta} onChange={v => set('monedaVenta', v)} />
            <input type="number" min={0} value={form.precioVentaEstimado || ''} onChange={e => set('precioVentaEstimado', Number(e.target.value))} placeholder="0" style={{ ...inputSt, flex: 1 }} />
          </div>
        </Field>
        {(form.monedaCompra === 'USD' || form.monedaVenta === 'USD') && (
          <Field label="Tipo de cambio (ARS por USD)" col={2}>
            <input type="number" min={1} value={form.tipoCambio || ''} onChange={e => set('tipoCambio', Number(e.target.value))} placeholder="1200" style={{ ...inputSt, maxWidth: 180 }} />
          </Field>
        )}
      </FormGrid>

      {/* Calculadora de ganancia */}
      {(form.precioCompra > 0 || form.precioVentaEstimado > 0) && (
        <div style={{ background: gananciaARS >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${gananciaARS >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, padding: '16px 20px', marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#8A8A8A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Estimación de rentabilidad</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>+ Precio de venta estimado</span>
              <span style={{ fontWeight: 700, color: '#22c55e' }}>+{fmtARS(ventaARS)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>− Precio de compra</span>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>−{fmtARS(compraARS)}</span>
            </div>
            {costoRepsARS > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>− Costo reparaciones</span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>−{fmtARS(costoRepsARS)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Ganancia estimada</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: gananciaARS >= 0 ? '#22c55e' : '#ef4444' }}>
                {gananciaARS >= 0 ? '' : '−'}{fmtARS(Math.abs(gananciaARS))}
                {gananciaARS < 0 && <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>⚠️ pérdida</span>}
              </span>
            </div>
            {form.monedaCompra === 'USD' || form.monedaVenta === 'USD' ? (
              <div style={{ fontSize: 10, color: '#8A8A8A', textAlign: 'right' }}>Conversión al tipo de cambio ${form.tipoCambio.toLocaleString('es-AR')}/USD</div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Fotos del equipo ── */}
      <SectionDivider label="Fotos del equipo" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {form.fotos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {form.fotos.map((foto, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={foto} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                <button onClick={() => setForm(p => ({ ...p, fotos: p.fotos.filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div onClick={() => fotoEqRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLOR }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          onDrop={async e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; if (e.dataTransfer.files.length) await addFotos(e.dataTransfer.files) }}
          style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Hacé clic o arrastrá fotos del equipo</div>
          <div style={{ fontSize: 11, color: '#676767', marginTop: 3 }}>JPG, PNG · Máx. 8 fotos</div>
        </div>
        <input ref={fotoEqRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={async e => { if (e.target.files) { await addFotos(e.target.files); e.target.value = '' } }} />
      </div>

      {/* ── Detalles físicos ── */}
      <SectionDivider label="Detalles físicos" />
      <textarea value={form.detallesFisicos} onChange={e => set('detallesFisicos', e.target.value)}
        placeholder="Estado físico: rayones, golpes, pantalla, marcos…"
        rows={3} style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, minHeight: 80, height: 'auto' }} />

      {/* ── Notas ── */}
      <SectionDivider label="Notas internas" />
      <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
        placeholder="Notas adicionales sobre la compra…"
        rows={2} style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, minHeight: 66, height: 'auto' }} />

      <Field label="Fecha de compra">
        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ ...inputSt, width: 180 }} />
      </Field>
    </Modal>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Compras registradas', v: compras.length,                                  c: COLOR,      fmt: String(compras.length) },
          { label: 'Total invertido',     v: totalInvertidoARS,                               c: '#ef4444',  fmt: fmtARS(totalInvertidoARS) },
          { label: 'Ganancia est. total', v: gananciaEstTotalARS,                             c: gananciaEstTotalARS >= 0 ? '#22c55e' : '#ef4444', fmt: fmtARS(gananciaEstTotalARS) },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${k.c}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.fmt}</div>
            <div style={{ fontSize: 11, color: '#676767', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por modelo, cliente o IMEI…" style={{ ...inputSt, flex: 1 }} />
        <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          💰 Nueva compra
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#676767', fontSize: 13, textAlign: 'center', padding: 40 }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: '#676767', fontSize: 13 }}>
          {compras.length === 0 ? 'No hay compras registradas. Hacé clic en "💰 Nueva compra".' : 'Sin resultados para la búsqueda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const ganancia = c.gananciaEstimadaARS ?? 0
            const cameras  = getCameras(c.modelo)
            const faults   = listFaults(c.funciones, c.modelo)
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
                {/* Row 1: cabecera */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{c.modelo}</span>
                  {c.capacidad && <span style={{ fontSize: 12, color: '#8A8A8A' }}>{c.capacidad}</span>}
                  {c.color && <span style={{ fontSize: 12, color: '#8A8A8A' }}>· {c.color}</span>}
                  <span style={{ fontSize: 11, color: '#8A8A8A', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5 }}>N° {String(c.nOrden).padStart(4, '0')}</span>
                  <span style={{ fontSize: 11, color: '#8A8A8A' }}>{c.fecha}</span>
                </div>
                {/* Row 2: cliente */}
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#8A8A8A', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>👤 <strong style={{ color: 'var(--text-primary)' }}>{c.nombreCliente}</strong></span>
                  {c.telefonoCliente && <span>📞 {c.telefonoCliente}</span>}
                  {c.dniCliente && <span>🪪 DNI {c.dniCliente}</span>}
                  {c.imei && <span>IMEI: {c.imei}</span>}
                  <span>🔋 {c.bateria}%</span>
                  {/* Cámaras mini */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    {cameras.map(z => {
                      const ok = c.funciones.camaras?.includes(z)
                      return <span key={z} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: ok ? '#22c55e' : '#ef4444', border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}` }}>📷{z}{ok ? ' ✓' : ' ✗'}</span>
                    })}
                  </div>
                </div>
                {/* Row 3: financiero */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: faults.length > 0 ? 10 : 0 }}>
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 12 }}>
                    <span style={{ color: '#8A8A8A' }}>Compra: </span>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>{c.monedaCompra === 'USD' ? `U$D ${c.precioCompra}` : fmtARS(c.precioCompra)}</span>
                  </div>
                  {(c.reparaciones?.length ?? 0) > 0 && (
                    <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, padding: '7px 14px', fontSize: 12 }}>
                      <span style={{ color: '#8A8A8A' }}>Reparaciones: </span>
                      <span style={{ fontWeight: 700, color: '#ca8a04' }}>−{fmtARS(c.costoReparacionesARS ?? 0)}</span>
                    </div>
                  )}
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 12 }}>
                    <span style={{ color: '#8A8A8A' }}>Venta est.: </span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>{c.monedaVenta === 'USD' ? `U$D ${c.precioVentaEstimado}` : fmtARS(c.precioVentaEstimado)}</span>
                  </div>
                  <div style={{ background: ganancia >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ganancia >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '7px 14px', fontSize: 12 }}>
                    <span style={{ color: '#8A8A8A' }}>Ganancia: </span>
                    <span style={{ fontWeight: 800, color: ganancia >= 0 ? '#22c55e' : '#ef4444' }}>
                      {ganancia >= 0 ? '' : '−'}{fmtARS(Math.abs(ganancia))}
                    </span>
                  </div>
                </div>
                {/* Fallas */}
                {faults.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    {faults.map(f => (
                      <span key={f} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>✗ {f}</span>
                    ))}
                  </div>
                )}
                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => openView(c)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>Ver detalles</button>
                  <button onClick={() => del(c)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#676767', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: nuevo */}
      {modal === 'new' && renderFormModal()}

      {/* Modal: ver detalle */}
      {modal === 'view' && selected && (() => {
        const c = selected
        const faults = listFaults(c.funciones, c.modelo)
        const cameras = getCameras(c.modelo)
        const gan = c.gananciaEstimadaARS ?? 0
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 600, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>💰 Compra N° {String(c.nOrden).padStart(4, '0')}</div>
                  <div style={{ fontSize: 12, color: '#8A8A8A' }}>{c.fecha}</div>
                </div>
                <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 20 }}>✕</button>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Cliente */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>👤 Datos del vendedor</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{c.nombreCliente}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#8A8A8A', flexWrap: 'wrap' }}>
                        {c.telefonoCliente && <span>📞 {c.telefonoCliente}</span>}
                        {c.dniCliente     && <span>🪪 DNI {c.dniCliente}</span>}
                      </div>
                    </div>
                    {/* Miniaturas DNI */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[c.fotoDniFrente, c.fotoDniDorso].filter(Boolean).map((f, i) => (
                        <img key={i} src={f} alt="" style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: `1.5px solid ${COLOR}`, cursor: 'zoom-in' }} onClick={() => window.open(f, '_blank')} />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Equipo */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📱 Equipo</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{c.modelo} {c.capacidad} {c.color}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#8A8A8A', flexWrap: 'wrap' }}>
                    {c.imei    && <span>IMEI: {c.imei}</span>}
                    <span>🔋 {c.bateria}%</span>
                    {/* Cámaras */}
                    {cameras.map(z => {
                      const ok = c.funciones.camaras?.includes(z)
                      return <span key={z} style={{ padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: ok ? '#22c55e' : '#ef4444', border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}` }}>📷{z}{ok ? ' ✓' : ' ✗'}</span>
                    })}
                  </div>
                  {c.detallesFisicos && <div style={{ fontSize: 12, color: '#8A8A8A', fontStyle: 'italic', marginTop: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 7 }}>"{c.detallesFisicos}"</div>}
                  {(c.fotos?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {c.fotos.map((f, i) => <img key={i} src={f} alt="" onClick={() => window.open(f, '_blank')} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--border)' }} />)}
                    </div>
                  )}
                </div>
                {/* Fallas */}
                {faults.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🔧 Fallas y costos de reparación</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(c.reparaciones ?? []).map(r => (
                        <div key={r.falla} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '7px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)' }}>
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {r.falla}</span>
                          <span style={{ fontWeight: 700, color: '#ef4444' }}>−{fmtARS(r.costoEstimado)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, fontWeight: 700, color: '#ef4444', padding: '4px 12px' }}>
                        Total reparaciones: −{fmtARS(c.costoReparacionesARS ?? 0)}
                      </div>
                    </div>
                  </div>
                )}
                {/* Análisis financiero */}
                <div style={{ background: gan >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${gan >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>📊 Análisis financiero</div>
                  {[
                    { label: '+ Venta estimada', val: fmtARS(c.monedaVenta === 'USD' ? c.precioVentaEstimado * (c.tipoCambio || 1) : c.precioVentaEstimado), color: '#22c55e' },
                    { label: '− Precio de compra', val: fmtARS(c.monedaCompra === 'USD' ? c.precioCompra * (c.tipoCambio || 1) : c.precioCompra), color: '#ef4444' },
                    ...(c.costoReparacionesARS > 0 ? [{ label: '− Reparaciones', val: fmtARS(c.costoReparacionesARS), color: '#ef4444' }] : []),
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>Ganancia estimada</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: gan >= 0 ? '#22c55e' : '#ef4444' }}>{gan >= 0 ? '' : '−'}{fmtARS(Math.abs(gan))}</span>
                  </div>
                </div>
                {c.notas && <div style={{ fontSize: 12, color: '#8A8A8A', fontStyle: 'italic', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>📝 {c.notas}</div>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Dialog: imprimir etiqueta */}
      {printPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 36px', maxWidth: 360, width: '92%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🏷️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Compra registrada</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <strong>{printPending.modelo}</strong>{printPending.capacidad ? ` · ${printPending.capacidad}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#8A8A8A', marginBottom: 22 }}>¿Querés imprimir la etiqueta?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { printLabel(printPending, labelSize); setPrintPending(null) }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                🖨️ Sí, imprimir
              </button>
              <button onClick={() => setPrintPending(null)}
                style={{ padding: '12px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmEl}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Sub-vista: Proveedores de equipos
// ════════════════════════════════════════════════════════════════════════════
type ProvForm = Omit<ProveedorEquipo, 'id' | 'createdAt'>

function buildEmptyProv(): ProvForm {
  return { nombre: '', apellido: '', empresa: '', cuil: '', telefono: '', direccion: '' }
}

function ProveedoresEquiposTab({ onRefresh }: { onRefresh: () => void }) {
  const { data, loading, refresh } = useApi<ProveedorEquipo[]>('/api/sistema/proveedores-equipos')
  const proveedores: ProveedorEquipo[] = data ?? []
  const [modal, setModal]   = useState<false | 'new' | 'edit'>(false)
  const [form, setForm]     = useState<ProvForm>(buildEmptyProv())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof ProvForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  const openNew  = () => { setForm(buildEmptyProv()); setEditId(null); setModal('new') }
  const openEdit = (p: ProveedorEquipo) => {
    const { id, createdAt, ...rest } = p
    setForm(rest); setEditId(id); setModal('edit')
  }

  const save = async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    try {
      const body = editId ? { id: editId, ...form } : form
      await fetch('/api/sistema/proveedores-equipos', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setModal(false); refresh(); onRefresh()
    } finally { setSaving(false) }
  }

  const { confirm: confirmDialog, dialog: confirmEl } = useConfirm()

  const del = async (id: string, nombre: string) => {
    const ok = await confirmDialog({ title: 'Eliminar proveedor', message: `¿Eliminar a "${nombre}"?`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    await fetch('/api/sistema/proveedores-equipos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    refresh(); onRefresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Nuevo proveedor
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#676767', fontSize: 13, textAlign: 'center', padding: 40 }}>Cargando…</div>
      ) : proveedores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: '#676767', fontSize: 13 }}>
          No hay proveedores cargados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proveedores.map(p => (
            <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${COLOR}22`, border: `2px solid ${COLOR}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: COLOR, flexShrink: 0 }}>
                {p.nombre.charAt(0).toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.nombre} {p.apellido}
                  </span>
                  {p.empresa && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLOR, background: `${COLOR}18`, padding: '2px 8px', borderRadius: 5 }}>
                      🏢 {p.empresa}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#8A8A8A', marginTop: 3, flexWrap: 'wrap' }}>
                  {p.cuil      && <span>🪪 CUIL/CUIT: {p.cuil}</span>}
                  {p.telefono  && <span>📞 {p.telefono}</span>}
                  {p.direccion && <span>📍 {p.direccion}</span>}
                </div>
              </div>
              {/* Acciones */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>Editar</button>
                <button onClick={() => del(p.id, `${p.nombre} ${p.apellido}`)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: '#676767', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmEl}

      {modal && (
        <Modal
          title={modal === 'new' ? '👤 Nuevo proveedor' : '✏️ Editar proveedor'}
          onClose={() => setModal(false)}
          onSubmit={save}
          submitLabel={modal === 'new' ? 'Crear proveedor' : 'Guardar'}
          submitting={saving}
          submitColor={COLOR}
          width={500}
        >
          <FormGrid cols={2}>
            <Field label="Nombre" required>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan" style={inputSt} />
            </Field>
            <Field label="Apellido">
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="García" style={inputSt} />
            </Field>
            <Field label="Empresa / Razón social" col={2}>
              <input value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Ej: Cokocell S.A., Pineapple Mayorista…" style={inputSt} />
            </Field>
            <Field label="CUIL / CUIT">
              <input value={form.cuil} onChange={e => set('cuil', e.target.value)} placeholder="20-12345678-9" maxLength={14} style={inputSt} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11 1234-5678" style={inputSt} />
            </Field>
            <Field label="Dirección" col={2}>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Corrientes 1234, CABA" style={inputSt} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Vista principal con pestañas
// ════════════════════════════════════════════════════════════════════════════
export default function VentasEquiposView() {
  const [tab, setTab]           = useState<'stock' | 'compras' | 'reparacion' | 'vendidos' | 'proveedores'>('stock')
  const [settings, setSettings] = useState(false)
  const [config, setConfig]     = useState<EquiposConfig>(() => loadCfg())
  const [draft, setDraft]       = useState<EquiposConfig>(config)

  const { data: provData, refresh: refreshProv } = useApi<ProveedorEquipo[]>('/api/sistema/proveedores-equipos')
  const { data: equiposData }                    = useApi<EquipoUsado[]>('/api/sistema/equipos')
  const proveedores: ProveedorEquipo[] = provData ?? []
  const enReparacion = (equiposData ?? []).filter(e => e.estado === 'En reparación').length
  const vendidos     = (equiposData ?? []).filter(e => e.estado === 'Vendido').length

  const openSettings = () => { setDraft(config); setSettings(true) }
  const saveSettings = () => { setConfig(draft); saveCfg(draft); setSettings(false) }

  const TABS = [
    { id: 'stock'       as const, label: '📱 Stock',          badge: null },
    { id: 'compras'     as const, label: '💰 Compras',        badge: null },
    { id: 'reparacion'  as const, label: '🔧 Reparación',     badge: enReparacion > 0 ? enReparacion : null },
    { id: 'vendidos'    as const, label: '✅ Vendidos',        badge: vendidos > 0 ? vendidos : null },
    { id: 'proveedores' as const, label: '👤 Proveedores',    badge: null },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Tabs + botón configuración */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'none', display: 'flex', alignItems: 'center', gap: 6,
            color: tab === t.id ? COLOR : 'var(--text-secondary)',
            borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s',
          }}>
            {t.label}
            {t.badge !== null && (
              <span style={{ fontSize: 10, fontWeight: 800, background: '#ca8a04', color: '#fff', borderRadius: 10, padding: '1px 6px', lineHeight: 1.5 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={openSettings}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', marginBottom: 4, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}
        >
          ⚙️ Configuración
        </button>
      </div>

      {tab === 'stock'       && <StockEquiposTab proveedores={proveedores} onRefreshProveedores={refreshProv} config={config} />}
      {tab === 'compras'     && <ComprasClientesTab config={config} />}
      {tab === 'reparacion'  && <ReparacionTab proveedores={proveedores} />}
      {tab === 'vendidos'    && <VendidosTab proveedores={proveedores} />}
      {tab === 'proveedores' && <ProveedoresEquiposTab onRefresh={refreshProv} />}

      {/* Modal de configuración */}
      {settings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 460, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚙️</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Configuración</div>
                  <div style={{ fontSize: 11, color: '#8A8A8A' }}>Ventas de equipos</div>
                </div>
              </div>
              <button onClick={() => setSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Sección: Etiqueta */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>🏷️</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Etiqueta predeterminada</span>
                </div>
                <div style={{ fontSize: 12, color: '#8A8A8A', marginBottom: 12 }}>
                  Este tamaño se usará por defecto en cada impresión. Podés cambiarlo puntualmente en el diálogo de impresión.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {LABEL_SIZES.map(s => (
                    <label key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderRadius: 10,
                      cursor: 'pointer', border: `1.5px solid ${draft.labelSize === s.id ? COLOR : 'var(--border)'}`,
                      background: draft.labelSize === s.id ? `${COLOR}12` : 'var(--surface2)', transition: 'all 0.1s',
                    }}>
                      <input type="radio" name="cfgLabelSize" value={s.id}
                        checked={draft.labelSize === s.id}
                        onChange={() => setDraft(d => ({ ...d, labelSize: s.id as LabelSizeId }))}
                        style={{ accentColor: COLOR, width: 16, height: 16 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: draft.labelSize === s.id ? 700 : 400, color: draft.labelSize === s.id ? COLOR : 'var(--text-primary)' }}>
                        {s.label}
                      </span>
                      {draft.labelSize === s.id && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, background: `${COLOR}20`, padding: '2px 8px', borderRadius: 5 }}>
                          PREDETERMINADO
                        </span>
                      )}
                      {/* Mini preview */}
                      <div style={{
                        width: Math.round(parseInt(s.w) * 0.52), height: Math.round(parseInt(s.h) * 0.52),
                        border: `1.5px solid ${draft.labelSize === s.id ? COLOR : '#555'}`,
                        borderRadius: 3, background: '#fff', flexShrink: 0,
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 2,
                      }}>
                        <div style={{ height: 2, background: '#000', borderRadius: 1 }} />
                        <div style={{ height: 1, background: '#888', width: '80%' }} />
                        <div style={{ height: 1, background: '#888', width: '55%' }} />
                        <div style={{ height: 6, background: 'repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px)' }} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Placeholder para futuras opciones */}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 16, opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔧</span>
                  <span style={{ fontSize: 12, color: '#8A8A8A', fontStyle: 'italic' }}>Más opciones próximamente…</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={saveSettings} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: COLOR, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ✓ Guardar configuración
              </button>
              <button onClick={() => setSettings(false)} style={{ padding: '11px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
