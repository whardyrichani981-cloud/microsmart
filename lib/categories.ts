export type AppleCategory =
  | 'modulos'
  | 'baterias'
  | 'camaras'
  | 'flex'
  | 'parlantes'
  | 'sensores'
  | 'cristales'
  | 'chasis'
  | 'circuitos'
  | 'apple-watch'
  | 'ipad'
  | 'herramientas'
  | 'accesorios'
  | 'otros'

export interface CategoryMeta {
  label: string
  icon: string
  color: string
  bg: string
}

export const CATEGORY_META: Record<AppleCategory, CategoryMeta> = {
  modulos:       { label: 'Módulos / Pantallas',  icon: '📱', color: '#818cf8', bg: 'rgba(99,102,241,0.08)'  },
  baterias:      { label: 'Baterías',             icon: '🔋', color: '#4ade80', bg: 'rgba(34,197,94,0.08)'   },
  camaras:       { label: 'Cámaras',              icon: '📷', color: '#fb923c', bg: 'rgba(249,115,22,0.08)'  },
  flex:          { label: 'Flex / Botones',        icon: '⚡', color: '#facc15', bg: 'rgba(234,179,8,0.08)'   },
  parlantes:     { label: 'Parlantes / Audio',     icon: '🔊', color: '#f472b6', bg: 'rgba(236,72,153,0.08)' },
  sensores:      { label: 'Sensores / Face ID',    icon: '👁', color: '#2dd4bf', bg: 'rgba(20,184,166,0.08)' },
  cristales:     { label: 'Cristales / Vidrios',   icon: '🔲', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)'},
  chasis:        { label: 'Chasis / Tapa Trasera', icon: '🏗', color: '#c084fc', bg: 'rgba(192,132,252,0.08)'},
  circuitos:     { label: 'Circuitos / ICs',       icon: '🔌', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  'apple-watch': { label: 'Apple Watch',           icon: '⌚', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)'},
  ipad:          { label: 'iPad',                  icon: '🖥', color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  herramientas:  { label: 'Herramientas',          icon: '🔧', color: '#f87171', bg: 'rgba(248,113,113,0.08)'},
  accesorios:    { label: 'Accesorios',            icon: '📦', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
  otros:         { label: 'Otros',                 icon: '📋', color: '#6b7280', bg: 'rgba(107,114,128,0.08)'},
}

export const CATEGORY_ORDER: AppleCategory[] = [
  'modulos', 'baterias', 'camaras', 'flex', 'parlantes',
  'sensores', 'cristales', 'chasis', 'circuitos',
  'apple-watch', 'ipad', 'herramientas', 'accesorios', 'otros',
]

// Keyword rules — first match wins
const RULES: [AppleCategory, RegExp][] = [
  ['apple-watch', /apple.?watch|watch/i],
  ['ipad',        /ipad|tactil.?ipad/i],
  ['modulos',     /modulo|\bmod\b|pantalla|incell|oled|lcd|display/i],
  ['baterias',    /bater[ií]|battery|tag.?on.?bat/i],
  ['camaras',     /camara|camera|lente|tag.?on.?cam/i],
  ['cristales',   /vidrio|cristal|glass|lente.?trasero/i],
  ['flex',        /flex|bot[oó]n|button|carga.?inal[aá]mbrica|wireless|charging/i],
  ['parlantes',   /parlante|speaker|audio|buzzer|aud[ií]fono/i],
  ['sensores',    /sensor|proximidad|face.?id|touch.?id|huella/i],
  ['chasis',      /chasis|chassis|tapa.?trasera|back.?cover|marco|frame|carcasa/i],
  ['circuitos',   /circuito|\bic\b|bluetooth|wifi|chip|integrado/i],
  ['herramientas',/herramienta|tool|utensilio|pinza|destornillador/i],
  ['accesorios',  /accesorio|accessory|cable|funda|case|protector/i],
]

export function normalizeCategory(raw: string | undefined): AppleCategory {
  if (!raw) return 'otros'
  for (const [cat, re] of RULES) {
    if (re.test(raw)) return cat
  }
  return 'otros'
}
