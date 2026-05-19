import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import { isSuperAdmin } from '@/lib/roles'
import { permanentlyDeleteNote } from '@/lib/notes-server'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value ?? ''
  const user = getUserFromToken(token)

  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const ok = await permanentlyDeleteNote(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
