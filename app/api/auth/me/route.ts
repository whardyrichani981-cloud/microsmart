import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, getUserFromToken } from '@/lib/session'

const ADMIN_USERS = new Set(['microsmart', 'microwhardy'])

const USER_EMPLEADO: Record<string, string> = {
  microsmart:  'Ronald',
  microwhardy: 'Ronald',
  microsaddi:  'Saddi',
  microsharon: 'Sharon',
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? ''
  const username = getUserFromToken(token)
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  return NextResponse.json({
    username,
    empleado: USER_EMPLEADO[username] ?? username,
    isAdmin: ADMIN_USERS.has(username),
  })
}
