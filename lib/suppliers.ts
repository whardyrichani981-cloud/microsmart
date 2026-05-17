import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import type { Supplier } from './types'
import { COLORS } from './colors'
import { parseBhTech, parseCparts, parseGeneric, parseGremio } from './parsers'

const BHTECH_URL =
  'https://docs.google.com/spreadsheets/d/1tNpvPU5mTcwPFP4fuKS-JR-dB4-38rerBbBfvAxrUhk/export?format=csv&gid=0'
const CPARTS_URL =
  'https://docs.google.com/spreadsheets/d/1kmBJEat-wFBD1Byxfow7G6JIeEKDv_Ct/export?format=csv&gid=1822284056'
const PINEAPPLE_URL =
  'https://www.dropbox.com/scl/fi/zvykb4j6y5um068isb3ao/LISTA-DE-PRECIOS.xlsx?rlkey=ki9owi0uxzg1jscednolefunu&dl=1'
const GREMIO_CSV = path.join(process.cwd(), 'data', 'gremio.csv')

const SUPPLIER_META = [
  { id: 'bhtech',   name: 'BH Tech',  colorIdx: 0 },
  { id: 'cparts',   name: 'Cparts',   colorIdx: 1 },
  { id: 'pineapple',name: 'Pineapple',colorIdx: 2 },
  { id: 'gremio',   name: 'Gremio',   colorIdx: 3 },
]

export async function fetchBuiltinSuppliers(): Promise<Supplier[]> {
  const results = await Promise.allSettled([
    loadBhTech(),
    loadCparts(),
    loadPineapple(),
    loadGremio(),
  ])

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const { id, name, colorIdx } = SUPPLIER_META[i]
    console.error(`Supplier ${name} failed:`, r.reason)
    return {
      id, name, items: [],
      color: COLORS[colorIdx],
      source: 'builtin' as const,
      error: String(r.reason),
    }
  })
}

async function loadBhTech(): Promise<Supplier> {
  const res = await fetch(BHTECH_URL, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const items = parseBhTech(data)
  return { id: 'bhtech', name: 'BH Tech', items, color: COLORS[0], source: 'builtin' }
}

async function loadCparts(): Promise<Supplier> {
  const res = await fetch(CPARTS_URL, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const items = parseCparts(data)
  return { id: 'cparts', name: 'Cparts', items, color: COLORS[1], source: 'builtin' }
}

async function loadPineapple(): Promise<Supplier> {
  const res = await fetch(PINEAPPLE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })
  const items = parseGeneric(rows)
  return { id: 'pineapple', name: 'Pineapple', items, color: COLORS[2], source: 'builtin' }
}

async function loadGremio(): Promise<Supplier> {
  const text = fs.readFileSync(GREMIO_CSV, 'utf-8')
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const items = parseGremio(data)
  return { id: 'gremio', name: 'Gremio', items, color: COLORS[3], source: 'builtin' }
}
