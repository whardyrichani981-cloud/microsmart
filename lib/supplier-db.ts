// Server-only: supplier data with PostgreSQL + CSV fallback
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { parseGremioFull, parseOriginales, parseAmpsentrix, parseCF } from './gremio-parser'

// ── CSV fallback ──────────────────────────────────────────────────────────────
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

// ── DB (only used when DATABASE_URL is set) ───────────────────────────────────
let _pool: import('pg').Pool | null = null

async function getDBPool(): Promise<import('pg').Pool> {
  if (_pool) return _pool
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg')
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  })
  return _pool
}

async function ensureSchema(pool: import('pg').Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_sheets (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      filename TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `)
}

let schemaReady = false
async function ensureDB() {
  if (schemaReady) return
  const pool = await getDBPool()
  await ensureSchema(pool)
  // Seed from CSV if empty
  for (const key of Object.keys(CSV_PARSERS)) {
    const { rows } = await pool.query('SELECT 1 FROM supplier_sheets WHERE key = $1', [key])
    if (!rows.length) {
      try {
        const data = readFromCSV(key)
        await pool.query(
          'INSERT INTO supplier_sheets (key, data, filename) VALUES ($1, $2, $3)',
          [key, JSON.stringify(data), CSV_PARSERS[key].file]
        )
      } catch (e) { console.error(`[db] seed ${key} failed:`, e) }
    }
  }
  schemaReady = true
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function getSupplierData<T>(key: string): Promise<T> {
  if (!process.env.DATABASE_URL) return readFromCSV<T>(key)
  await ensureDB()
  const pool = await getDBPool()
  const { rows } = await pool.query<{ data: T }>('SELECT data FROM supplier_sheets WHERE key = $1', [key])
  if (!rows.length) throw new Error(`Supplier "${key}" not found in DB`)
  return rows[0].data
}

export async function setSupplierData(key: string, data: unknown, filename?: string): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurado')
  await ensureDB()
  const pool = await getDBPool()
  await pool.query(
    `INSERT INTO supplier_sheets (key, data, filename, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $2, filename = $3, updated_at = NOW()`,
    [key, JSON.stringify(data), filename ?? null]
  )
}

export async function getSupplierMeta(): Promise<{ key: string; filename: string | null; updated_at: string }[]> {
  if (!process.env.DATABASE_URL) {
    return Object.keys(CSV_PARSERS).map(key => ({
      key,
      filename: CSV_PARSERS[key].file,
      updated_at: new Date().toISOString(),
    }))
  }
  await ensureDB()
  const pool = await getDBPool()
  const { rows } = await pool.query('SELECT key, filename, updated_at FROM supplier_sheets ORDER BY key')
  return rows
}
