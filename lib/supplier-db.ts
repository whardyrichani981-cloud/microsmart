// Server-only: supplier data from PostgreSQL
import { getPool } from './db'
import { ensureDB } from './db-init'

export async function getSupplierData<T>(key: string): Promise<T> {
  await ensureDB()
  const { rows } = await getPool().query<{ data: T; updated_at: string }>(
    'SELECT data, updated_at FROM supplier_sheets WHERE key = $1',
    [key]
  )
  if (!rows.length) throw new Error(`Supplier "${key}" not found in database`)
  return rows[0].data
}

export async function setSupplierData(key: string, data: unknown, filename?: string): Promise<void> {
  await ensureDB()
  await getPool().query(
    `INSERT INTO supplier_sheets (key, data, filename, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $2, filename = $3, updated_at = NOW()`,
    [key, JSON.stringify(data), filename ?? null]
  )
}

export async function getSupplierMeta(): Promise<{ key: string; filename: string | null; updated_at: string }[]> {
  await ensureDB()
  const { rows } = await getPool().query(
    'SELECT key, filename, updated_at FROM supplier_sheets ORDER BY key'
  )
  return rows
}
