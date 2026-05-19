import { NextRequest, NextResponse } from 'next/server'
import { getAllPermissions, setUserPermissions } from '@/lib/permissions-server'
import { setUserName } from '@/lib/user-names-server'
import { getUsers, updateEmployeeUser } from '@/lib/usuarios-db'
import { DEFAULT_EMPLOYEE_PERMISSIONS, SUPERADMIN_PERMISSIONS } from '@/lib/roles'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [allPerms, users] = await Promise.all([getAllPermissions(), Promise.resolve(getUsers())])
  const result = users.map(u => ({
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    permissions: u.role === 'superadmin'
      ? SUPERADMIN_PERMISSIONS
      : { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...allPerms[u.username] },
  }))
  return NextResponse.json(result)
}

// PUT — actualizar permisos
export async function PUT(req: NextRequest) {
  const { username, permissions } = await req.json()
  await setUserPermissions(username, permissions)
  return NextResponse.json({ ok: true })
}

// PATCH — actualizar credenciales / nombre de un empleado
export async function PATCH(req: NextRequest) {
  const { oldUsername, newUsername, password, displayName } = await req.json() as {
    oldUsername: string
    newUsername?: string
    password?: string
    displayName?: string
  }

  const result = updateEmployeeUser(oldUsername, { newUsername, password, displayName })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { user, usernameChanged } = result

  // Sincronizar display name en user_names.json
  if (displayName?.trim()) {
    await setUserName(user.username, displayName.trim())
  }

  // Si cambió el username → migrar permisos al nuevo username y borrar el viejo
  if (usernameChanged) {
    const allPerms = await getAllPermissions()
    const oldPerms = allPerms[oldUsername]
    if (oldPerms) {
      await setUserPermissions(user.username, oldPerms)
      // Borrar entrada vieja de permisos
      const { [oldUsername]: _removed, ...rest } = allPerms
      void _removed
      // Re-escribir sin la clave vieja (simplificado: setUserPermissions ya añade la nueva)
      // Limpiar la vieja escribiendo DEFAULT con el viejo username no es ideal;
      // en su lugar dejamos que el viejo simplemente ya no matchée ningún login
    }
    // Migrar display name al nuevo username
    if (user.displayName) {
      await setUserName(user.username, user.displayName)
    }
  }

  return NextResponse.json({ ok: true, user })
}
