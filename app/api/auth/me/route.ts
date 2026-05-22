import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, getUserFromToken } from '@/lib/session'
import { isSuperAdmin } from '@/lib/roles'
import { getUserName } from '@/lib/user-names-server'

// Nombre corto del empleado para comisiones/órdenes (primer nombre)
const USER_EMPLEADO: Record<string, string> = {
  microsmart:  'Ronald',
  microwhardy: 'Whardy',   // ← fix: era 'Ronald' por error
  microsaddi:  'Saddi',
  microsharon: 'Sharon',
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? ''
  const username = getUserFromToken(token)
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // displayName completo desde la fuente de verdad (user-names-server)
  const displayName = await getUserName(username)

  return NextResponse.json({
    username,
    empleado: USER_EMPLEADO[username] ?? displayName.split(' ')[0],
    displayName,
    isAdmin: isSuperAdmin(username),   // ← fix: usa roles.ts en vez de Set hardcodeado
  })
}
