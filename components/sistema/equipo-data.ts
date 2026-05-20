// Datos compartidos de dispositivos Apple — colores, capacidades, cámaras y checklist
// Usado tanto en VentasEquiposView como en OrdenesView
import type { ChecklistFunciones } from '@/lib/sistema-types'

// ── Colores oficiales Apple por modelo (apple.com/es-la) ────────────────────
export const COLOR_MAP: Record<string, string[]> = {
  'iPhone 17 Pro Max': ['Color plata', 'Naranja cósmico', 'Azul profundo'],
  'iPhone 17 Pro':     ['Color plata', 'Naranja cósmico', 'Azul profundo'],
  'iPhone 17 Air':     ['Negro espacial', 'Blanco nube', 'Color oro claro', 'Azul cielo'],
  'iPhone 17':         ['Negro', 'Blanco', 'Azul neblina', 'Color salvia', 'Color lavanda'],
  'iPhone 16 Pro Max': ['Titanio negro', 'Titanio blanco', 'Titanio natural', 'Titanio del desierto'],
  'iPhone 16 Pro':     ['Titanio negro', 'Titanio blanco', 'Titanio natural', 'Titanio del desierto'],
  'iPhone 16 Plus':    ['Negro', 'Blanco', 'Rosa', 'Verde azulado', 'Color ultramarino'],
  'iPhone 16':         ['Negro', 'Blanco', 'Rosa', 'Verde azulado', 'Color ultramarino'],
  'iPhone 15 Pro Max': ['Titanio negro', 'Titanio blanco', 'Titanio azul', 'Titanio natural'],
  'iPhone 15 Pro':     ['Titanio negro', 'Titanio blanco', 'Titanio azul', 'Titanio natural'],
  'iPhone 15 Plus':    ['Negro', 'Azul', 'Verde', 'Amarillo', 'Rosa'],
  'iPhone 15':         ['Negro', 'Azul', 'Verde', 'Amarillo', 'Rosa'],
  'iPhone 14 Pro Max': ['Negro espacial', 'Color plata', 'Color oro', 'Morado oscuro'],
  'iPhone 14 Pro':     ['Negro espacial', 'Color plata', 'Color oro', 'Morado oscuro'],
  'iPhone 14 Plus':    ['Color medianoche', 'Morado', 'Blanco estelar', '(PRODUCT)RED', 'Azul', 'Amarillo'],
  'iPhone 14':         ['Color medianoche', 'Morado', 'Blanco estelar', '(PRODUCT)RED', 'Azul', 'Amarillo'],
  'iPhone 13 Pro Max': ['Color grafito', 'Color oro', 'Color plata', 'Azul Sierra', 'Verde alpino'],
  'iPhone 13 Pro':     ['Color grafito', 'Color oro', 'Color plata', 'Azul Sierra', 'Verde alpino'],
  'iPhone 13':         ['(PRODUCT)RED', 'Blanco estelar', 'Color medianoche', 'Azul', 'Rosa', 'Verde'],
  'iPhone 13 Mini':    ['(PRODUCT)RED', 'Blanco estelar', 'Color medianoche', 'Azul', 'Rosa', 'Verde'],
  'iPhone 12 Pro Max': ['Color plata', 'Color grafito', 'Color oro', 'Azul pacífico'],
  'iPhone 12 Pro':     ['Color plata', 'Color grafito', 'Color oro', 'Azul pacífico'],
  'iPhone 12':         ['Negro', 'Blanco', '(PRODUCT)RED', 'Verde', 'Azul', 'Morado'],
  'iPhone 12 Mini':    ['Negro', 'Blanco', '(PRODUCT)RED', 'Verde', 'Azul', 'Morado'],
  'iPhone 11 Pro Max': ['Color oro', 'Gris espacial', 'Color plata', 'Verde medianoche'],
  'iPhone 11 Pro':     ['Color oro', 'Gris espacial', 'Color plata', 'Verde medianoche'],
  'iPhone 11':         ['Negro', 'Verde', 'Amarillo', 'Morado', '(PRODUCT)RED', 'Blanco'],
  'iPhone XS Max':     ['Color oro', 'Gris espacial', 'Color plata'],
  'iPhone XS':         ['Color oro', 'Gris espacial', 'Color plata'],
  'iPhone XR':         ['(PRODUCT)RED', 'Amarillo', 'Blanco', 'Coral', 'Negro', 'Azul'],
  'iPhone X':          ['Gris espacial', 'Color plata'],
  'iPhone SE (3ra gen)': ['(PRODUCT)RED', 'Blanco estelar', 'Color medianoche'],
  'iPhone SE (2da gen)': ['Negro', 'Blanco', '(PRODUCT)RED'],
  'iPhone 8 Plus': ['Color oro', 'Color plata', 'Gris espacial', '(PRODUCT)RED'],
  'iPhone 8':      ['Color oro', 'Color plata', 'Gris espacial', '(PRODUCT)RED'],
  'iPhone 7 Plus': ['Color oro rosa', 'Color oro', 'Color plata', 'Negro mate', 'Negro brillante', '(PRODUCT)RED'],
  'iPhone 7':      ['Color oro rosa', 'Color oro', 'Color plata', 'Negro mate', 'Negro brillante', '(PRODUCT)RED'],
}
export function getColores(modelo: string): string[] {
  return COLOR_MAP[modelo] ? [...COLOR_MAP[modelo], 'Otro'] : []
}

// ── Capacidades oficiales por modelo ────────────────────────────────────────
export const CAPACIDAD_MAP: Record<string, string[]> = {
  'iPhone 17 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 17 Pro':     ['256GB', '512GB', '1TB'],
  'iPhone 17 Air':     ['128GB', '256GB', '512GB'],
  'iPhone 17':         ['128GB', '256GB', '512GB'],
  'iPhone 16 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 16 Pro':     ['256GB', '512GB', '1TB'],
  'iPhone 16 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 16':         ['128GB', '256GB', '512GB'],
  'iPhone 15 Pro Max': ['256GB', '512GB', '1TB'],
  'iPhone 15 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 15 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 15':         ['128GB', '256GB', '512GB'],
  'iPhone 14 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 14 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 14 Plus':    ['128GB', '256GB', '512GB'],
  'iPhone 14':         ['128GB', '256GB', '512GB'],
  'iPhone 13 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 13 Pro':     ['128GB', '256GB', '512GB', '1TB'],
  'iPhone 13':         ['128GB', '256GB', '512GB'],
  'iPhone 13 Mini':    ['128GB', '256GB', '512GB'],
  'iPhone 12 Pro Max': ['128GB', '256GB', '512GB'],
  'iPhone 12 Pro':     ['128GB', '256GB', '512GB'],
  'iPhone 12':         ['64GB', '128GB', '256GB'],
  'iPhone 12 Mini':    ['64GB', '128GB', '256GB'],
  'iPhone 11 Pro Max': ['64GB', '256GB', '512GB'],
  'iPhone 11 Pro':     ['64GB', '256GB', '512GB'],
  'iPhone 11':         ['64GB', '128GB', '256GB'],
  'iPhone XS Max':     ['64GB', '256GB', '512GB'],
  'iPhone XS':         ['64GB', '256GB', '512GB'],
  'iPhone XR':         ['64GB', '128GB', '256GB'],
  'iPhone X':          ['64GB', '256GB'],
  'iPhone SE (3ra gen)': ['64GB', '128GB', '256GB'],
  'iPhone SE (2da gen)': ['64GB', '128GB', '256GB'],
  'iPhone 8 Plus': ['64GB', '256GB'],
  'iPhone 8':      ['64GB', '256GB'],
  'iPhone 7 Plus': ['32GB', '128GB', '256GB'],
  'iPhone 7':      ['32GB', '128GB', '256GB'],
}
export function getCapacidades(modelo: string): string[] {
  return CAPACIDAD_MAP[modelo] ?? []
}

// ── Cámaras por modelo ───────────────────────────────────────────────────────
export const CAMERA_MAP: Record<string, string[]> = {
  'iPhone 17 Pro Max': ['0.5x', '1x', '2x', '4x', '8x'],
  'iPhone 17 Pro':     ['0.5x', '1x', '2x', '4x', '8x'],
  'iPhone 17 Air':     ['0.5x', '1x', '2x'],
  'iPhone 17':         ['0.5x', '1x', '2x'],
  'iPhone 16 Pro Max': ['0.5x', '1x', '2x', '5x'],
  'iPhone 16 Pro':     ['0.5x', '1x', '2x', '5x'],
  'iPhone 16 Plus':    ['0.5x', '1x', '2x'],
  'iPhone 16':         ['0.5x', '1x', '2x'],
  'iPhone 15 Pro Max': ['0.5x', '1x', '2x', '5x'],
  'iPhone 15 Pro':     ['0.5x', '1x', '2x', '3x'],
  'iPhone 15 Plus':    ['0.5x', '1x', '2x'],
  'iPhone 15':         ['0.5x', '1x', '2x'],
  'iPhone 14 Pro Max': ['0.5x', '1x', '2x', '3x'],
  'iPhone 14 Pro':     ['0.5x', '1x', '2x', '3x'],
  'iPhone 14 Plus':    ['0.5x', '1x'],
  'iPhone 14':         ['0.5x', '1x'],
  'iPhone 13 Pro Max': ['0.5x', '1x', '3x'],
  'iPhone 13 Pro':     ['0.5x', '1x', '3x'],
  'iPhone 13':         ['0.5x', '1x'],
  'iPhone 13 Mini':    ['0.5x', '1x'],
  'iPhone 12 Pro Max': ['0.5x', '1x', '2.5x'],
  'iPhone 12 Pro':     ['0.5x', '1x', '2x'],
  'iPhone 12':         ['0.5x', '1x'],
  'iPhone 12 Mini':    ['0.5x', '1x'],
  'iPhone 11 Pro Max': ['0.5x', '1x', '2x'],
  'iPhone 11 Pro':     ['0.5x', '1x', '2x'],
  'iPhone 11':         ['0.5x', '1x'],
  'iPhone XS Max':     ['1x', '2x'],
  'iPhone XS':         ['1x', '2x'],
  'iPhone XR':         ['1x'],
  'iPhone X':          ['1x', '2x'],
  'iPhone SE (3ra gen)': ['1x'],
  'iPhone SE (2da gen)': ['1x'],
  'iPhone 8 Plus': ['1x', '2x'],
  'iPhone 8':      ['1x'],
  'iPhone 7 Plus': ['1x', '2x'],
  'iPhone 7':      ['1x'],
}
export function getCameras(modelo: string): string[] {
  return CAMERA_MAP[modelo] ?? ['1x']
}

// ── Checklist de funciones ───────────────────────────────────────────────────
export type FuncionFija = keyof Omit<ChecklistFunciones, 'camaras'>

export const FUNCION_META: Record<FuncionFija, { label: string; icon: string }> = {
  pantalla:               { label: 'Pantalla',          icon: '📱' },
  placa:                  { label: 'Placa',             icon: '🔩' },
  altavoz:                { label: 'Altavoz',           icon: '👂' },
  speaker:                { label: 'Speaker',           icon: '🔊' },
  microfonoNotas:         { label: 'Mic. notas',        icon: '🎤' },
  microfonoSelfie:        { label: 'Mic. selfie',       icon: '🎤' },
  microfonoCamaraZoom:    { label: 'Mic. zoom',         icon: '🎤' },
  botonesVolumen:         { label: 'Vol. +/−',          icon: '🔉' },
  botonPower:             { label: 'Encendido',         icon: '⚡' },
  faceId:                 { label: 'Face ID',           icon: '👤' },
  wifi:                   { label: 'WiFi',              icon: '📶' },
  senal:                  { label: 'Señal',             icon: '📡' },
  camaraSelfie:           { label: 'Cam. selfie',       icon: '🤳' },
  camaraRetratoSelfie:    { label: 'Retrato selfie',    icon: '🤳' },
  camaraRetratoPrincipal: { label: 'Retrato principal', icon: '📷' },
}

export const ALL_FUNCION_KEYS = Object.keys(FUNCION_META) as FuncionFija[]

export const GRUPOS_FUNCIONES: { label: string; icon: string; keys: FuncionFija[] }[] = [
  { label: 'Hardware',     icon: '🔩', keys: ['pantalla', 'placa'] },
  { label: 'Audio',        icon: '🔊', keys: ['altavoz', 'speaker', 'microfonoNotas', 'microfonoSelfie', 'microfonoCamaraZoom'] },
  { label: 'Botones',      icon: '🔘', keys: ['botonesVolumen', 'botonPower'] },
  { label: 'Conectividad', icon: '📡', keys: ['faceId', 'wifi', 'senal'] },
  { label: 'Cámaras',      icon: '📸', keys: ['camaraSelfie', 'camaraRetratoSelfie', 'camaraRetratoPrincipal'] },
]

export function emptyChecklist(): ChecklistFunciones {
  return {
    pantalla: false, placa: false,
    microfonoNotas: false, microfonoSelfie: false, microfonoCamaraZoom: false,
    altavoz: false, speaker: false,
    botonesVolumen: false, botonPower: false, faceId: false,
    wifi: false, senal: false, camaras: [],
    camaraSelfie: false, camaraRetratoSelfie: false, camaraRetratoPrincipal: false,
  }
}

export function listFaults(funciones: ChecklistFunciones, modelo: string): string[] {
  const faults: string[] = []
  ALL_FUNCION_KEYS.forEach(k => { if (!funciones[k]) faults.push(FUNCION_META[k].label) })
  getCameras(modelo).forEach(z => { if (!funciones.camaras.includes(z)) faults.push(`Cámara ${z}`) })
  return faults
}

export function funcionesOk(f: ChecklistFunciones, modelo: string) {
  const fixedOk = ALL_FUNCION_KEYS.filter(k => f[k] as boolean).length
  const cameras  = getCameras(modelo)
  const camOk    = cameras.filter(z => f.camaras?.includes(z)).length
  return { ok: fixedOk + camOk, total: ALL_FUNCION_KEYS.length + cameras.length }
}
