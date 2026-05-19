// Smart Apple-aware search expansion.
// Maps shorthand queries to all relevant aliases used in supplier price lists.

type Alias = { terms: string[]; expands: string[] }

const ALIASES: Alias[] = [
  // ─── iPhone (generic) ─────────────────────────────────────────────────────
  { terms: ['iphone', 'iph', 'ip iphone'], expands: ['iphone', 'iph'] },

  // ─── iPhone numbers ───────────────────────────────────────────────────────
  ...(['6', '6s', '7', '8', 'x', 'xs', 'xr', '11', '12', '13', '14', '15', '16', '17'] as const).map(n => ({
    terms: [n, `iphone ${n}`, `iph ${n}`, `iph${n}`],
    expands: [n, `iphone ${n}`, `iph ${n}`, `iph${n}`],
  })),

  // ─── iPhone SE ────────────────────────────────────────────────────────────
  { terms: ['se', 'iphone se', 'iphse'], expands: ['se', 'iphone se', 'iph se', 'iphse'] },
  { terms: ['se2', 'se 2', 'se2020'], expands: ['se 2', 'se2020', 'iph se 2', 'se2'] },
  { terms: ['se3', 'se 3', 'se2022'], expands: ['se 3', 'se2022', 'iph se 3', 'se3'] },

  // ─── iPhone Plus / Pro / Mini / Max variants ──────────────────────────────
  { terms: ['plus', 'pro', 'mini', 'max', 'pro max', 'ultra'], expands: ['plus', 'pro', 'mini', 'max', 'pro max', 'ultra'] },
  { terms: ['6 plus', '6s plus', '7 plus', '8 plus'], expands: ['6 plus', '6s plus', '7 plus', '8 plus', 'plus'] },
  { terms: ['xs max', 'xsmax'], expands: ['xs max', 'xsmax', 'iphone xs max', 'iph xs max'] },

  // ─── Apple Watch ──────────────────────────────────────────────────────────
  { terms: ['watch', 'apple watch', 'aw'], expands: ['watch', 'apple watch'] },
  { terms: ['s6', 'series 6', 'watch 6'], expands: ['series 6', 'watch series 6', 's6'] },
  { terms: ['s7', 'series 7', 'watch 7'], expands: ['series 7', 'watch series 7', 's7'] },
  { terms: ['s8', 'series 8', 'watch 8'], expands: ['series 8', 'watch series 8', 's8'] },
  { terms: ['s9', 'series 9', 'watch 9'], expands: ['series 9', 'watch series 9', 's9'] },
  { terms: ['ultra', 'watch ultra'], expands: ['ultra', 'watch ultra', 'apple watch ultra'] },
  { terms: ['watch se', 'aw se'], expands: ['watch se', 'apple watch se'] },

  // ─── iPad ─────────────────────────────────────────────────────────────────
  { terms: ['ipad'], expands: ['ipad'] },
  { terms: ['ipad pro', 'ipad pro 11', 'ipad pro 13', 'ipad pro 12'], expands: ['ipad pro'] },
  { terms: ['ipad air', 'air 4', 'air 5', 'air4', 'air5'], expands: ['ipad air', 'air 4', 'air 5'] },
  { terms: ['ipad mini', 'mini 6', 'mini6'], expands: ['ipad mini', 'mini 6', 'mini6'] },
  { terms: ['ipad 9', 'ipad 10', 'ipad9', 'ipad10'], expands: ['ipad 9', 'ipad 10'] },

  // ─── AirPods ──────────────────────────────────────────────────────────────
  { terms: ['airpods', 'pods', 'air pods'], expands: ['airpods', 'air pods'] },
  { terms: ['airpods pro', 'pods pro'], expands: ['airpods pro'] },
  { terms: ['airpods 2', 'airpods 3', 'pods 2', 'pods 3'], expands: ['airpods 2', 'airpods 3'] },

  // ─── MacBook ──────────────────────────────────────────────────────────────
  { terms: ['macbook', 'mac book', 'mbp', 'mba'], expands: ['macbook', 'mac book', 'mbp', 'mba'] },
  { terms: ['macbook pro', 'mbp'], expands: ['macbook pro', 'mbp'] },
  { terms: ['macbook air', 'mba'], expands: ['macbook air', 'mba'] },
  { terms: ['m1', 'chip m1'], expands: ['m1'] },
  { terms: ['m2', 'chip m2'], expands: ['m2'] },
  { terms: ['m3', 'chip m3'], expands: ['m3'] },

  // ─── Common part types ────────────────────────────────────────────────────
  { terms: ['bateria', 'bat', 'battery'], expands: ['bateria', 'bat', 'battery'] },
  { terms: ['modulo', 'módulo', 'mod', 'pantalla', 'display', 'lcd', 'incell', 'oled', 'screen'], expands: ['modulo', 'módulo', 'mod', 'pantalla', 'display', 'lcd', 'incell', 'oled', 'screen'] },
  { terms: ['camara', 'cam', 'camera'], expands: ['camara', 'cam', 'camera'] },
  { terms: ['flex', 'flex carga', 'charging'], expands: ['flex', 'carga'] },
  { terms: ['tactil', 'touch', 'vidrio'], expands: ['tactil', 'touch', 'vidrio'] },
  { terms: ['parlante', 'speaker', 'audio'], expands: ['parlante', 'speaker'] },
  { terms: ['chasis', 'marco', 'frame', 'carcasa'], expands: ['chasis', 'marco', 'frame', 'carcasa'] },
]

// Build lookup map: each raw term → set of expanded terms to search
const LOOKUP = new Map<string, Set<string>>()
for (const alias of ALIASES) {
  for (const term of alias.terms) {
    if (!LOOKUP.has(term)) LOOKUP.set(term, new Set())
    for (const exp of alias.expands) LOOKUP.get(term)!.add(exp)
  }
}

// Expand a single token into all its aliases (OR-group)
function expandToken(token: string): string[] {
  const result = new Set<string>([token])

  const direct = LOOKUP.get(token)
  if (direct) direct.forEach(t => result.add(t))

  if (token.startsWith('iphone ')) {
    const model = token.slice(7)
    result.add(model)
    result.add(`iph ${model}`)
    result.add(`iph${model}`)
    LOOKUP.get(model)?.forEach(t => result.add(t))
  }
  if (token.startsWith('iph ') || (token.startsWith('iph') && token.length > 3 && token !== 'iphone')) {
    const model = token.replace(/^iph\s*/, '')
    result.add(model)
    result.add(`iphone ${model}`)
    LOOKUP.get(model)?.forEach(t => result.add(t))
  }
  if (/^\d{1,2}$/.test(token)) {
    result.add(`iphone ${token}`)
    result.add(`iph ${token}`)
    result.add(`iph${token}`)
  }

  return [...result]
}

// Returns one group per word — item must match ALL groups (AND), each group via OR of aliases
export function expandQuery(raw: string): string[][] {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return words.map(expandToken)
}

// Matches when every word-group has at least one alias present in the text
export function matchesQuery(text: string | undefined | null, groups: string[][]): boolean {
  if (!text || !groups.length) return false
  const lower = text.toLowerCase()
  return groups.every(group => group.some(t => lower.includes(t)))
}
