import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import { isSuperAdmin, EMPLOYEE_USERNAMES } from '@/lib/roles'
import { getAllPermissions, setUserPermissions, getUserPermissions } from '@/lib/permissions-server'

async function getCurrentUser(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value ?? ''
  return getUserFromToken(token)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const saved = await getAllPermissions()
  // Return full permissions for each employee (merging defaults)
  const result: Record<string, ReturnType<typeof getUserPermissions>> = {}
  for (const emp of EMPLOYEE_USERNAMES) {
    result[emp] = getUserPermissions(emp)
  }
  const resolved = Object.fromEntries(
    await Promise.all(EMPLOYEE_USERNAMES.map(async emp => [emp, await getUserPermissions(emp)]))
  )
  return NextResponse.json({ saved, resolved })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { username, permissions } = await req.json()
  if (!username || !permissions) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  if (!EMPLOYEE_USERNAMES.includes(username)) return NextResponse.json({ error: 'Solo se pueden modificar empleados' }, { status: 400 })
  await setUserPermissions(username, permissions)
  return NextResponse.json({ ok: true })
}
