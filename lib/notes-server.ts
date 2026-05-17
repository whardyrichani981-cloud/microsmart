// Server-only — never import from client components
import fs from 'fs'
import path from 'path'
import { authorColor } from './notes'
import type { Note, NoteCategory, NotePriority } from './notes'

const FILE = path.join(process.cwd(), 'data', 'notes.json')

// ── File fallback ─────────────────────────────────────────────────────────────
function fileRead(): Note[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Note[] }
  catch { return [] }
}
function fileWrite(notes: Note[]): void {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2), 'utf-8')
}

// ── DB helpers ────────────────────────────────────────────────────────────────
let _pool: import('pg').Pool | null = null
let _schemaReady = false

async function getPool(): Promise<import('pg').Pool> {
  if (_pool) return _pool
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg')
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  return _pool
}

async function ensureDB() {
  if (_schemaReady) return
  const pool = await getPool()
  await pool.query(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, data JSONB NOT NULL)`)
  // Seed from notes.json if table is empty
  const { rows } = await pool.query('SELECT COUNT(*) FROM notes')
  if (rows[0].count === '0') {
    for (const note of fileRead()) {
      await pool.query('INSERT INTO notes (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [note.id, JSON.stringify(note)])
    }
  }
  _schemaReady = true
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function readNotes(): Promise<Note[]> {
  if (!process.env.DATABASE_URL) return fileRead()
  await ensureDB()
  const pool = await getPool()
  const { rows } = await pool.query<{ data: Note }>("SELECT data FROM notes ORDER BY (data->>'createdAt') DESC")
  return rows.map(r => r.data)
}

export async function addNote(data: Omit<Note, 'id' | 'createdAt' | 'resolved'>): Promise<Note> {
  const note: Note = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    resolved: false,
  }
  if (!process.env.DATABASE_URL) {
    const notes = fileRead(); notes.unshift(note); fileWrite(notes); return note
  }
  await ensureDB()
  await (await getPool()).query('INSERT INTO notes (id, data) VALUES ($1, $2)', [note.id, JSON.stringify(note)])
  return note
}

export async function toggleResolved(id: string): Promise<Note | null> {
  if (!process.env.DATABASE_URL) {
    const notes = fileRead()
    const note = notes.find(n => n.id === id)
    if (!note) return null
    note.resolved = !note.resolved
    note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
    fileWrite(notes); return note
  }
  await ensureDB()
  const pool = await getPool()
  const { rows } = await pool.query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.resolved = !note.resolved
  note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
  await pool.query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

export async function deleteNote(id: string): Promise<Note | null> {
  if (!process.env.DATABASE_URL) {
    const notes = fileRead()
    const note = notes.find(n => n.id === id)
    if (!note) return null
    note.deleted = true; note.deletedAt = new Date().toISOString()
    fileWrite(notes); return note
  }
  await ensureDB()
  const pool = await getPool()
  const { rows } = await pool.query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.deleted = true; note.deletedAt = new Date().toISOString()
  await pool.query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

export { authorColor }
export type { Note, NoteCategory, NotePriority }
