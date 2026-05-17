import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import { getUserName, setUserName } from '@/lib/user-names-server'

async function getCurrentUser(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value ?? ''
  return getUserFromToken(token)
}

export async function GET() {
  const username = await getCurrentUser()
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const name = await getUserName(username)
  return NextResponse.json({ username, name })
}

export async function POST(req: NextRequest) {
  const username = await getCurrentUser()
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  await setUserName(username, name.trim())
  return NextResponse.json({ ok: true, name: name.trim() })
}
