import { NextRequest, NextResponse } from 'next/server'
import { makeToken, COOKIE_NAME } from '@/lib/session'
import { getUsers } from '@/lib/usuarios-db'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  const users = getUsers()
  const found = users.find(u => u.username === (user as string))

  if (!found || pass !== found.password) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const token = makeToken(found.username)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86_400,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
