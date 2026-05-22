// Server-only — gestión de usuarios (credenciales + display name)
import fs from 'fs'
import path from 'path'
import type { UserRole } from './roles'
import { getRole } from './roles'   // roles.ts es la única fuente de verdad para roles

export interface UserRecord {
  username: string
  password: string
  role: UserRole
  displayName: string
}

const FILE = path.join(process.cwd(), 'data', 'sistema-usuarios.json')

const DEFAULTS: UserRecord[] = [
  { username: 'microsmart',  password: 'micro1278', role: 'superadmin', displayName: 'Ronald Diaz' },
  { username: 'microwhardy', password: 'micro1278', role: 'superadmin', displayName: 'Whardy Richani' },
  { username: 'microsaddi',  password: 'saddi',     role: 'employee',   displayName: 'Saddi Richani' },
  { username: 'microsharon', password: 'sharon',    role: 'employee',   displayName: 'Sharon Quiroz' },
]

export function getUsers(): UserRecord[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as UserRecord[] }
  catch { return [...DEFAULTS] }
}

function writeUsers(users: UserRecord[]): void {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf-8')
}

export function getUserByUsername(username: string): UserRecord | null {
  return getUsers().find(u => u.username === username) ?? null
}

// Siempre usa roles.ts como fuente de verdad para el rol (nunca el archivo DB)
export function getRoleFromDB(username: string): UserRole {
  return getRole(username)
}

export interface UpdateEmployeeInput {
  newUsername?: string
  password?: string
  displayName?: string
}

export type UpdateEmployeeResult =
  | { ok: true; user: UserRecord; usernameChanged: boolean; oldUsername: string }
  | { ok: false; error: string }

export function updateEmployeeUser(
  oldUsername: string,
  updates: UpdateEmployeeInput
): UpdateEmployeeResult {
  const users = getUsers()
  const idx = users.findIndex(u => u.username === oldUsername)
  if (idx === -1) return { ok: false, error: 'Usuario no encontrado' }
  if (users[idx].role === 'superadmin') return { ok: false, error: 'No se puede modificar un superadmin desde aquí' }

  const newUsername = (updates.newUsername ?? '').trim() || oldUsername
  const usernameChanged = newUsername !== oldUsername

  if (usernameChanged && users.some(u => u.username === newUsername)) {
    return { ok: false, error: 'El login ya está en uso' }
  }

  const updated: UserRecord = {
    ...users[idx],
    username: newUsername,
    ...(updates.password ? { password: updates.password } : {}),
    ...(updates.displayName?.trim() ? { displayName: updates.displayName.trim() } : {}),
  }
  users[idx] = updated
  writeUsers(users)
  return { ok: true, user: updated, usernameChanged, oldUsername }
}
