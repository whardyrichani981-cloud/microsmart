// Server-only: database operations with file fallback — never import from client components
import fs from 'fs'
import path from 'path'
import { authorColor } from './notes'
import type { Note, NoteCategory, NotePriority } from './notes'

const FILE = path.join(process.cwd(), 'data', 'notes.json')

function hasDB(): boolean { return !!process.env.DATABASE_URL }

// ── File-based fallback ───────────────────────────────────────────────────────
function fileRead(): Note[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Note[] }
  catch { return [] }
}
function fileWrite(notes: Note[]): void {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2), 'utf-8')
}

// ── DB helpers (loaded lazily so pg import doesn't break without DATABASE_URL) ─
async function dbPool() {
  const { getPool } = await import('./db')
  return getPool()
}
async function dbEnsure() {
  const { ensureDB } = await import('./db-init')
  return ensureDB()
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function readNotes(): Promise<Note[]> {
  if (!hasDB()) return fileRead()
  await dbEnsure()
  const pool = await dbPool()
  const { rows } = await pool.query<{ data: Note }>(
    "SELECT data FROM notes ORDER BY (data->>'createdAt') DESC"
  )
  return rows.map(r => r.data)
}

export async function addNote(data: Omit<Note, 'id' | 'createdAt' | 'resolved'>): Promise<Note> {
  const note: Note = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    resolved: false,
  }
  if (!hasDB()) {
    const notes = fileRead()
    notes.unshift(note)
    fileWrite(notes)
    return note
  }
  await dbEnsure()
  const pool = await dbPool()
  await pool.query('INSERT INTO notes (id, data) VALUES ($1, $2)', [note.id, JSON.stringify(note)])
  return note
}

export async function toggleResolved(id: string): Promise<Note | null> {
  if (!hasDB()) {
    const notes = fileRead()
    const note = notes.find(n => n.id === id)
    if (!note) return null
    note.resolved = !note.resolved
    note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
    fileWrite(notes)
    return note
  }
  await dbEnsure()
  const pool = await dbPool()
  const { rows } = await pool.query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.resolved = !note.resolved
  note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
  await pool.query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

export async function deleteNote(id: string): Promise<Note | null> {
  if (!hasDB()) {
    const notes = fileRead()
    const note = notes.find(n => n.id === id)
    if (!note) return null
    note.deleted = true
    note.deletedAt = new Date().toISOString()
    fileWrite(notes)
    return note
  }
  await dbEnsure()
  const pool = await dbPool()
  const { rows } = await pool.query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.deleted = true
  note.deletedAt = new Date().toISOString()
  await pool.query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

export { authorColor }
export type { Note, NoteCategory, NotePriority }
