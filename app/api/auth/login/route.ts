import { NextRequest, NextResponse } from 'next/server'
import { makeToken, COOKIE_NAME } from '@/lib/session'

const USERS: Record<string, string> = {
  microsmart:  'micro1278',
  microwhardy: 'micro1278',
  microsaddi:  'saddi',
  microsharon: 'sharon',
}

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  const validPass = USERS[user as string]
  if (!validPass || pass !== validPass) {
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
