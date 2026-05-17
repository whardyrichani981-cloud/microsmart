// Server-only: database operations — never import this from client components
import { getPool } from './db'
import { ensureDB } from './db-init'
import { authorColor } from './notes'
import type { Note, NoteCategory, NotePriority } from './notes'

export async function readNotes(): Promise<Note[]> {
  await ensureDB()
  const { rows } = await getPool().query<{ data: Note }>(
    "SELECT data FROM notes ORDER BY (data->>'createdAt') DESC"
  )
  return rows.map(r => r.data)
}

export async function addNote(data: Omit<Note, 'id' | 'createdAt' | 'resolved'>): Promise<Note> {
  await ensureDB()
  const note: Note = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    resolved: false,
  }
  await getPool().query('INSERT INTO notes (id, data) VALUES ($1, $2)', [note.id, JSON.stringify(note)])
  return note
}

export async function toggleResolved(id: string): Promise<Note | null> {
  await ensureDB()
  const { rows } = await getPool().query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.resolved = !note.resolved
  note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
  await getPool().query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

export async function deleteNote(id: string): Promise<Note | null> {
  await ensureDB()
  const { rows } = await getPool().query<{ data: Note }>('SELECT data FROM notes WHERE id = $1', [id])
  if (!rows.length) return null
  const note = rows[0].data
  note.deleted = true
  note.deletedAt = new Date().toISOString()
  await getPool().query('UPDATE notes SET data = $1 WHERE id = $2', [JSON.stringify(note), id])
  return note
}

// Re-export authorColor so callers that used to get it from notes-server still work
export { authorColor }

// Types re-export for convenience
export type { Note, NoteCategory, NotePriority }
