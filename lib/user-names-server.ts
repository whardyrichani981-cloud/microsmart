// Server-only — manages custom display names per username
import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'data', 'user_names.json')

const DEFAULTS: Record<string, string> = {
  microsmart:  'Ronald Diaz',
  microwhardy: 'Whardy Richani',
  microsaddi:  'Saddi Richani',
  microsharon: 'Sharon Quiroz',
}

function fileRead(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Record<string, string> }
  catch { return {} }
}

function fileWrite(data: Record<string, string>) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function dbRead(): Promise<Record<string, string>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg') as typeof import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    const { rows } = await pool.query<{ data: Record<string, string> }>(
      "SELECT data FROM supplier_sheets WHERE key = 'user_names'"
    )
    await pool.end()
    return rows[0]?.data ?? {}
  } catch { return {} }
}

async function dbWrite(data: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pool.query(
    `INSERT INTO supplier_sheets (key, data, filename, updated_at)
     VALUES ('user_names', $1, NULL, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
    [JSON.stringify(data)]
  )
  await pool.end()
}

export async function getUserName(username: string): Promise<string> {
  const saved = process.env.DATABASE_URL ? await dbRead() : fileRead()
  return saved[username] ?? DEFAULTS[username] ?? username
}

export async function getAllUserNames(): Promise<Record<string, string>> {
  const saved = process.env.DATABASE_URL ? await dbRead() : fileRead()
  return { ...DEFAULTS, ...saved }
}

export async function setUserName(username: string, name: string): Promise<void> {
  if (process.env.DATABASE_URL) {
    const current = await dbRead()
    current[username] = name
    await dbWrite(current)
  } else {
    const current = fileRead()
    current[username] = name
    fileWrite(current)
  }
}
