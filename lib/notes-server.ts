// Server-only: file system operations — never import this from client components
import fs from 'fs'
import path from 'path'
import type { Note } from './notes'

const FILE = path.join(process.cwd(), 'data', 'notes.json')

export function readNotes(): Note[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Note[]
  } catch {
    return []
  }
}

export function writeNotes(notes: Note[]): void {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2), 'utf-8')
}

export function addNote(data: Omit<Note, 'id' | 'createdAt' | 'resolved'>): Note {
  const notes = readNotes()
  const note: Note = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    resolved: false,
  }
  notes.unshift(note)
  writeNotes(notes)
  return note
}

export function toggleResolved(id: string): Note | null {
  const notes = readNotes()
  const note = notes.find(n => n.id === id)
  if (!note) return null
  note.resolved = !note.resolved
  note.resolvedAt = note.resolved ? new Date().toISOString() : undefined
  writeNotes(notes)
  return note
}

export function deleteNote(id: string): boolean {
  const notes = readNotes()
  const note = notes.find(n => n.id === id)
  if (!note) return false
  note.deleted = true
  note.deletedAt = new Date().toISOString()
  writeNotes(notes)
  return true
}
