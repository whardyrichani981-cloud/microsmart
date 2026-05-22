import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import { isSuperAdmin } from '@/lib/roles'
import { getAllPermissions, setUserPermissions, getUserPermissions } from '@/lib/permissions-server'
import { getUsers } from '@/lib/usuarios-db'

async function getCurrentUser(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value ?? ''
  return getUserFromToken(token)
}

/** Lista dinámica de empleados — incluye los agregados manualmente al sistema */
function getEmployeeUsernames(): string[] {
  return getUsers().filter(u => u.role === 'employee').map(u => u.username)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const saved = await getAllPermissions()
  const employees = getEmployeeUsernames()
  const allUsers = getUsers()

  // displayNames para el panel de permisos (Bug #4)
  const displayNames: Record<string, string> = {}
  for (const u of allUsers) displayNames[u.username] = u.displayName

  const resolved = Object.fromEntries(
    await Promise.all(employees.map(async emp => [emp, await getUserPermissions(emp)]))
  )
  return NextResponse.json({ saved, resolved, displayNames })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { username, permissions } = await req.json()
  if (!username || !permissions) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const employees = getEmployeeUsernames()
  if (!employees.includes(username)) return NextResponse.json({ error: 'Solo se pueden modificar empleados' }, { status: 400 })
  await setUserPermissions(username, permissions)
  return NextResponse.json({ ok: true })
}
