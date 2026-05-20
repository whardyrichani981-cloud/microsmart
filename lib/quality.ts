// Quality/variant detection for Apple repair parts
// Detects quality descriptors from product names and returns colored badges

export interface QualityBadge {
  label: string
  color: string
  bg: string
  border: string
}

// Rules checked in order — first match wins for overlapping patterns (e.g. "Soft OLED" before "OLED")
const RULES: Array<{ pattern: RegExp } & QualityBadge> = [
  // ── Screen technologies ──────────────────────────────────────────────────
  { pattern: /soft[\s\-]*oled/i,
    label: 'Soft OLED',  color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.35)' },
  { pattern: /hard[\s\-]*oled/i,
    label: 'Hard OLED',  color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.35)' },
  { pattern: /\boled\b/i,
    label: 'OLED',       color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.35)' },
  { pattern: /incell[\s\-]*(am|x07|x09|[a-z]\d{2})?/i,
    label: '',           color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',  border: 'rgba(56,189,248,0.35)'  },
    // label resolved dynamically below

  // ── Part origin ──────────────────────────────────────────────────────────
  { pattern: /\boriginal\b/i,
    label: 'Original',   color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.35)'  },
  { pattern: /gen[eé]rico|generic/i,
    label: 'Genérico',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)' },
  { pattern: /refabricad|remanufactur|refurbish/i,
    label: 'Refab',      color: '#fb923c', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.35)'  },

  // ── Service type ─────────────────────────────────────────────────────────
  { pattern: /diagn[oó]stic/i,
    label: 'Diagnóstico',color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)'  },

  // ── Flex cable ───────────────────────────────────────────────────────────
  { pattern: /con[\s\-]*flex/i,
    label: 'Con Flex',   color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  border: 'rgba(45,212,191,0.35)'  },
  { pattern: /sin[\s\-]*flex/i,
    label: 'Sin Flex',   color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)' },

  // ── Backlight ────────────────────────────────────────────────────────────
  { pattern: /backlight|retroiluminac/i,
    label: 'Backlight',  color: '#facc15', bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.35)'   },
]

export function detectQualities(name: string | undefined | null): QualityBadge[] {
  if (!name) return []
  const badges: QualityBadge[] = []
  const lower = name.toLowerCase()

  for (const rule of RULES) {
    const m = rule.pattern.exec(lower)
    if (!m) continue

    // Dynamic label for incell (capture the grade suffix if present)
    let label = rule.label
    if (!label) {
      // Incell rule — extract grade like "AM", "X07", "X09" if present
      const grade = m[1]?.toUpperCase().trim() ?? ''
      label = grade ? `Incell ${grade}` : 'Incell'
    }

    badges.push({ label, color: rule.color, bg: rule.bg, border: rule.border })
  }

  return badges
}
