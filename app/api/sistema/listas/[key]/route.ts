import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { parseGremioFull, parseCF } from '@/lib/gremio-parser'
import { setSupplierData } from '@/lib/supplier-db'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

const VALID_KEYS: Record<string, { file: string; parse: (d: (string | number | null)[][]) => unknown }> = {
  gremio: { file: 'gremio.csv', parse: (d) => parseGremioFull(d) },
  cf:     { file: 'cf.csv',     parse: (d) => parseCF(d) },
}

// GET  →  download the raw CSV
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const entry = VALID_KEYS[key]
  if (!entry) return NextResponse.json({ error: 'key inválido' }, { status: 400 })

  const csvPath = path.join(DATA_DIR, entry.file)
  if (!fs.existsSync(csvPath))
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const content = fs.readFileSync(csvPath, 'utf-8')
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${key}.csv"`,
    },
  })
}

// POST  →  import file (CSV or Excel), save to data/ and optionally DB
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const entry = VALID_KEYS[key]
    if (!entry) return NextResponse.json({ error: 'key inválido' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''

    let csvContent: string

    if (ext === 'csv') {
      csvContent = await file.text()
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      csvContent = XLSX.utils.sheet_to_csv(ws)
    } else {
      return NextResponse.json(
        { error: 'Formato no soportado. Usá CSV o Excel (.xlsx / .xls)' },
        { status: 400 }
      )
    }

    // Validate by parsing
    const { data: rows } = Papa.parse<(string | number | null)[]>(csvContent, { skipEmptyLines: false })
    const parsed = entry.parse(rows)

    // Count items for feedback
    let itemCount = 0
    if (key === 'gremio') {
      const d = parsed as { left: { items: unknown[] }[]; right: { items: unknown[] }[] }
      itemCount = [...d.left, ...d.right].reduce((a, s) => a + s.items.length, 0)
    } else if (key === 'cf') {
      itemCount = (parsed as unknown[]).length
    }

    // Save raw CSV to disk (used when no DATABASE_URL)
    const csvPath = path.join(DATA_DIR, entry.file)
    fs.writeFileSync(csvPath, csvContent, 'utf-8')

    // Also update DB if available
    if (process.env.DATABASE_URL) {
      try { await setSupplierData(key, parsed, filename) } catch { /* ignore */ }
    }

    return NextResponse.json({ ok: true, key, filename, items: itemCount })
  } catch (e) {
    console.error('[listas/import]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
