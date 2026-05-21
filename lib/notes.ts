// Client-safe: types, constants, and pure utilities only — no Node.js imports

export type NoteCategory = 'repuesto' | 'reparacion-cf' | 'reparacion-gremio' | 'general'
export type NotePriority = 'alta' | 'media' | 'baja'

export interface Note {
  id: string
  author: string          // quien creó la nota (solicitadoPor)
  authorColor: string
  responsable?: string    // a quien está asignada la tarea
  solicitadoPor?: string  // alias explícito del creador (mismo que author)
  content: string
  category: NoteCategory
  priority: NotePriority
  product?: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string     // quién la marcó como completada
  deleted?: boolean
  deletedAt?: string
  createdAt: string
  reminderAt?: string
}

export function authorColor(name: string): string {
  const palette = ['#818cf8', '#4ade80', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#f87171', '#c084fc']
  let hash = 0
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  repuesto:          'Pedido de repuesto',
  'reparacion-cf':   'Reparación CF',
  'reparacion-gremio': 'Reparación gremio',
  general:           'General',
}

export const CATEGORY_COLORS: Record<NoteCategory, { bg: string; text: string; border: string }> = {
  repuesto:            { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8', border: '#6366f1' },
  'reparacion-cf':     { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', border: '#f97316' },
  'reparacion-gremio': { bg: 'rgba(52,211,153,0.15)',  text: '#34d399', border: '#10b981' },
  general:             { bg: 'rgba(100,116,139,0.2)',   text: '#94a3b8', border: '#475569' },
}

export const PRIORITY_COLORS: Record<NotePriority, { text: string; label: string }> = {
  alta:  { text: '#f87171', label: '🔴 Alta' },
  media: { text: '#facc15', label: '🟡 Media' },
  baja:  { text: '#4ade80', label: '🟢 Baja' },
}
