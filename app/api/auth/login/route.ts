import { NextRequest, NextResponse } from 'next/server'
import { makeToken, COOKIE_NAME } from '@/lib/session'
import { getUsers } from '@/lib/usuarios-db'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  // 1. Intentar con la base de usuarios (archivo local)
  const users = getUsers()
  const found = users.find(u => u.username === (user as string))

  // 2. Fallback: variables de entorno AUTH_USER / AUTH_PASS
  const envUser = process.env.AUTH_USER
  const envPass = process.env.AUTH_PASS
  const envMatch = envUser && envPass && user === envUser && pass === envPass

  console.log('[login] user:', user, '| found:', !!found, '| envUser:', envUser, '| envPass set:', !!envPass, '| passLen:', String(pass).length, '| envPassLen:', String(envPass ?? '').length, '| envMatch:', !!envMatch)
  console.log('[login2] pass:', String(pass), '| envPass:', String(envPass ?? ''))

  if (!envMatch && (!found || pass !== found.password)) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const username = found?.username ?? (user as string)
  const token = makeToken(username)
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
