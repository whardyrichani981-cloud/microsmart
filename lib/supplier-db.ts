// Server-only: supplier data from PostgreSQL with CSV fallback
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { parseGremioFull, parseOriginales, parseAmpsentrix, parseCF } from './gremio-parser'

const CSV_PARSERS: Record<string, { file: string; parse: (d: (string | number | null)[][]) => unknown }> = {
  gremio:     { file: 'gremio.csv',     parse: (d) => parseGremioFull(d) },
  originales: { file: 'originales.csv', parse: (d) => parseOriginales(d) },
  ampsentrix: { file: 'ampsentrix.csv', parse: (d) => parseAmpsentrix(d) },
  cf:         { file: 'cf.csv',         parse: (d) => parseCF(d) },
}

function readFromCSV<T>(key: string): T {
  const entry = CSV_PARSERS[key]
  if (!entry) throw new Error(`Unknown supplier key: ${key}`)
  const text = fs.readFileSync(path.join(process.cwd(), 'data', entry.file), 'utf-8')
  const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
  return entry.parse(data) as T
}

function hasDB(): boolean {
  return !!process.env.DATABASE_URL
}

async function getPool() {
  const { getPool: _getPool } = await import('./db')
  return _getPool()
}

async function ensureDB() {
  const { ensureDB: _ensure } = await import('./db-init')
  return _ensure()
}

export async function getSupplierData<T>(key: string): Promise<T> {
  if (!hasDB()) return readFromCSV<T>(key)
  await ensureDB()
  const pool = await getPool()
  const { rows } = await pool.query<{ data: T }>(
    'SELECT data FROM supplier_sheets WHERE key = $1',
    [key]
  )
  if (!rows.length) throw new Error(`Supplier "${key}" not found in database`)
  return rows[0].data
}

export async function setSupplierData(key: string, data: unknown, filename?: string): Promise<void> {
  if (!hasDB()) throw new Error('DATABASE_URL no configurado')
  await ensureDB()
  const pool = await getPool()
  await pool.query(
    `INSERT INTO supplier_sheets (key, data, filename, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $2, filename = $3, updated_at = NOW()`,
    [key, JSON.stringify(data), filename ?? null]
  )
}

export async function getSupplierMeta(): Promise<{ key: string; filename: string | null; updated_at: string }[]> {
  if (!hasDB()) {
    return Object.keys(CSV_PARSERS).map(key => ({
      key,
      filename: CSV_PARSERS[key].file,
      updated_at: new Date().toISOString(),
    }))
  }
  await ensureDB()
  const pool = await getPool()
  const { rows } = await pool.query('SELECT key, filename, updated_at FROM supplier_sheets ORDER BY key')
  return rows
}
