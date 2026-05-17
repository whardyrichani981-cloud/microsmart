// Smart Apple-aware search expansion.
// Maps shorthand queries to all relevant aliases used in supplier price lists.

type Alias = { terms: string[]; expands: string[] }

const ALIASES: Alias[] = [
  // ─── iPhone numbers ───────────────────────────────────────────────────────
  ...(['6', '6s', '7', '8', 'x', 'xs', 'xr', '11', '12', '13', '14', '15', '16'] as const).map(n => ({
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
  { terms: ['modulo', 'mod', 'pantalla', 'display', 'lcd', 'incell', 'oled'], expands: ['modulo', 'mod', 'pantalla', 'display', 'lcd', 'incell', 'oled'] },
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

export function expandQuery(raw: string): string[] {
  const q = raw.trim().toLowerCase()
  if (!q) return []

  const result = new Set<string>([q])

  // Direct lookup
  const direct = LOOKUP.get(q)
  if (direct) direct.forEach(t => result.add(t))

  // Prefix match: "iphone 11" → strip "iphone " and look up "11"
  if (q.startsWith('iphone ')) {
    const model = q.slice(7)
    result.add(model)
    result.add(`iph ${model}`)
    result.add(`iph${model}`)
    const extra = LOOKUP.get(model)
    if (extra) extra.forEach(t => result.add(t))
  }
  if (q.startsWith('iph ') || (q.startsWith('iph') && q.length > 3)) {
    const model = q.replace(/^iph\s*/, '')
    result.add(model)
    result.add(`iphone ${model}`)
    const extra = LOOKUP.get(model)
    if (extra) extra.forEach(t => result.add(t))
  }

  // Bare number: "11" → "iphone 11", "iph 11"
  if (/^\d{1,2}$/.test(q)) {
    result.add(`iphone ${q}`)
    result.add(`iph ${q}`)
    result.add(`iph${q}`)
  }

  return [...result]
}

export function matchesQuery(text: string | undefined | null, terms: string[]): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return terms.some(t => lower.includes(t))
}
