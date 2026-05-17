import { NextRequest, NextResponse } from 'next/server'
import { toggleResolved, deleteNote, readNotes } from '@/lib/notes-server'

export const dynamic = 'force-dynamic'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = toggleResolved(id)
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(note)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteNote(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const note = readNotes().find(n => n.id === id)
  return NextResponse.json(note)
}
