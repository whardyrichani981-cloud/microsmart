import { NextRequest, NextResponse } from 'next/server'
import { makeToken, COOKIE_NAME } from '@/lib/session'
import { getUsers } from '@/lib/usuarios-db'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  // Normalizar: quitar espacios y pasar a minúsculas el usuario
  const userClean = String(user).trim().toLowerCase()
  const passClean = String(pass).trim()

  // 1. Intentar con la base de usuarios (archivo local)
  const users = getUsers()
  const found = users.find(u => u.username.toLowerCase() === userClean)

  // 2. Fallback: variables de entorno AUTH_USER / AUTH_PASS
  const envUser = process.env.AUTH_USER?.trim().toLowerCase()
  const envPass = process.env.AUTH_PASS?.trim()
  const envMatch = envUser && envPass && userClean === envUser && passClean === envPass

  if (!envMatch && (!found || passClean !== found.password)) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const username = found?.username ?? userClean
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
