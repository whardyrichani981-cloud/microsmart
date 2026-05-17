import { NextRequest, NextResponse } from 'next/server'
import { makeToken, COOKIE_NAME } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  const validUser = process.env.AUTH_USER ?? 'microsmart'
  const validPass = process.env.AUTH_PASS ?? 'microsmart2025'

  if (user !== validUser || pass !== validPass) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const token = makeToken(user)
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
