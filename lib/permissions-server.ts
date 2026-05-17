// Server-only
import fs from 'fs'
import path from 'path'
import type { Permissions } from './roles'
import { DEFAULT_EMPLOYEE_PERMISSIONS, SUPERADMIN_PERMISSIONS, isSuperAdmin } from './roles'

const FILE = path.join(process.cwd(), 'data', 'permissions.json')

function fileRead(): Record<string, Permissions> {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Record<string, Permissions> }
  catch { return {} }
}
function fileWrite(data: Record<string, Permissions>) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function dbRead(): Promise<Record<string, Permissions>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg') as typeof import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    const { rows } = await pool.query<{ data: Record<string, Permissions> }>(
      "SELECT data FROM supplier_sheets WHERE key = 'user_permissions'"
    )
    await pool.end()
    return rows[0]?.data ?? {}
  } catch { return {} }
}

async function dbWrite(data: Record<string, Permissions>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pool.query(
    `INSERT INTO supplier_sheets (key, data, filename, updated_at)
     VALUES ('user_permissions', $1, NULL, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
    [JSON.stringify(data)]
  )
  await pool.end()
}

export async function getUserPermissions(username: string): Promise<Permissions> {
  if (isSuperAdmin(username)) return SUPERADMIN_PERMISSIONS
  const saved = process.env.DATABASE_URL ? await dbRead() : fileRead()
  return { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...saved[username] }
}

export async function setUserPermissions(username: string, permissions: Permissions): Promise<void> {
  if (process.env.DATABASE_URL) {
    const current = await dbRead()
    current[username] = permissions
    await dbWrite(current)
  } else {
    const current = fileRead()
    current[username] = permissions
    fileWrite(current)
  }
}

export async function getAllPermissions(): Promise<Record<string, Permissions>> {
  return process.env.DATABASE_URL ? await dbRead() : fileRead()
}
