import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { getPool } from './db'
import { parseGremioFull, parseOriginales, parseAmpsentrix, parseCF } from './gremio-parser'

let initialized = false
let initPromise: Promise<void> | null = null

export async function ensureDB(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise
  initPromise = _init().then(() => { initialized = true })
  return initPromise
}

async function _init() {
  const pool = getPool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_sheets (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      filename TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // Seed notes from notes.json if DB is empty
  const { rows: noteCount } = await pool.query('SELECT COUNT(*) FROM notes')
  if (noteCount[0].count === '0') {
    try {
      const notesPath = path.join(process.cwd(), 'data', 'notes.json')
      const notesArr = JSON.parse(fs.readFileSync(notesPath, 'utf-8')) as { id: string }[]
      for (const note of notesArr) {
        await pool.query('INSERT INTO notes (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [note.id, JSON.stringify(note)])
      }
    } catch { /* no notes.json — fine */ }
  }

  // Seed supplier data from CSV files if DB is empty
  const suppliers: { key: string; file: string; parse: (rows: unknown[][]) => unknown }[] = [
    { key: 'gremio',      file: 'gremio.csv',      parse: (r) => parseGremioFull(r as never) },
    { key: 'originales',  file: 'originales.csv',   parse: (r) => parseOriginales(r as never) },
    { key: 'ampsentrix',  file: 'ampsentrix.csv',   parse: (r) => parseAmpsentrix(r as never) },
    { key: 'cf',          file: 'cf.csv',            parse: (r) => parseCF(r as never) },
  ]

  for (const s of suppliers) {
    const { rows } = await pool.query('SELECT 1 FROM supplier_sheets WHERE key = $1', [s.key])
    if (rows.length) continue
    try {
      const text = fs.readFileSync(path.join(process.cwd(), 'data', s.file), 'utf-8')
      const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
      const parsed = s.parse(data)
      await pool.query(
        'INSERT INTO supplier_sheets (key, data, filename) VALUES ($1, $2, $3)',
        [s.key, JSON.stringify(parsed), s.file]
      )
      console.log(`[db-init] seeded ${s.key}`)
    } catch (e) {
      console.error(`[db-init] failed to seed ${s.key}:`, e)
    }
  }
}
