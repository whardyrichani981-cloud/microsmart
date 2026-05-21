import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Permissions } from '@/lib/roles'
import { SUPERADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS } from '@/lib/roles'

export const dynamic = 'force-dynamic'

interface SistemaUser {
  username: string
  displayName: string
  role: 'superadmin' | 'employee'
  password?: string
  permissions?: Permissions
}

const FILE = path.join(process.cwd(), 'data', 'sistema-usuarios.json')

function readUsers(): SistemaUser[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch { return [] }
}

function writeUsers(users: SistemaUser[]) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf-8')
}

// GET — list all users (no passwords, permissions merged with defaults)
export async function GET() {
  const users = readUsers()
  const safe = users.map(u => ({
    username:    u.username,
    displayName: u.displayName,
    role:        u.role,
    permissions: u.role === 'superadmin'
      ? SUPERADMIN_PERMISSIONS
      : { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...(u.permissions ?? {}) },
  }))
  return NextResponse.json(safe)
}

// PUT — update permissions for an employee
export async function PUT(req: NextRequest) {
  const { username, permissions } = await req.json()
  if (!username) return NextResponse.json({ error: 'username requerido' }, { status: 400 })

  const users = readUsers()
  const idx = users.findIndex(u => u.username === username)
  if (idx === -1) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (users[idx].role === 'superadmin') return NextResponse.json({ error: 'No se pueden modificar permisos de superadmin' }, { status: 403 })

  users[idx].permissions = { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...(users[idx].permissions ?? {}), ...permissions }
  writeUsers(users)
  return NextResponse.json({ ok: true })
}

// PATCH — update credentials (displayName, username, password)
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { oldUsername, newUsername, password, displayName } = await req.json()
  if (!oldUsername) return NextResponse.json({ error: 'oldUsername requerido' }, { status: 400 })

  const users = readUsers()
  const idx = users.findIndex(u => u.username === oldUsername)
  if (idx === -1) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Check new username isn't taken
  if (newUsername && newUsername !== oldUsername) {
    if (users.some(u => u.username === newUsername)) {
      return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 409 })
    }
    users[idx].username = newUsername
  }

  if (displayName?.trim()) users[idx].displayName = displayName.trim()

  if (password) {
    users[idx].password = password
  }

  writeUsers(users)
  return NextResponse.json({ ok: true })
}
