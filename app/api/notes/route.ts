import { NextRequest, NextResponse } from 'next/server'
import { readNotes, addNote } from '@/lib/notes-server'
import { authorColor } from '@/lib/notes'
import type { NoteCategory, NotePriority } from '@/lib/notes'

export const dynamic = 'force-dynamic'

export async function GET() {
  const notes = readNotes()
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { author, content, category, priority, product } = body as {
    author: string
    content: string
    category: NoteCategory
    priority: NotePriority
    product?: string
  }

  if (!author?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Author and content required' }, { status: 400 })
  }

  const note = addNote({
    author: author.trim(),
    authorColor: authorColor(author.trim()),
    content: content.trim(),
    category: category ?? 'general',
    priority: priority ?? 'media',
    product: product?.trim() || undefined,
  })

  return NextResponse.json(note, { status: 201 })
}
