import { NextRequest, NextResponse } from 'next/server'
import { getSessions, updateSession, getMessages } from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessions = getSessions().sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
  // Attach unread count (messages from user with no owner reply after them)
  const allMessages = getMessages()
  const enriched = sessions.map(s => {
    const msgs = allMessages.filter(m => m.sessionId === s.id)
    const lastOwner = msgs.filter(m => m.role === 'owner' || m.role === 'bot').at(-1)
    const unread = lastOwner
      ? msgs.filter(m => m.role === 'user' && m.createdAt > lastOwner.createdAt).length
      : msgs.filter(m => m.role === 'user').length
    return { ...s, unread, messageCount: msgs.length }
  })
  return NextResponse.json(enriched)
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    updateSession(id, updates)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
