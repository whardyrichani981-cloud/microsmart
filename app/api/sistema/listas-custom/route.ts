import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { getListasCustom, addListaCustom } from '@/lib/sistema-db'
import { parseGeneric } from '@/lib/parsers'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

const COLORS = [
  '#60a5fa', '#34d399', '#a78bfa', '#fb923c',
  '#f43f5e', '#38bdf8', '#facc15', '#4ade80',
]

// GET — all custom lists (without items)
export async function GET() {
  return NextResponse.json(getListasCustom())
}

// POST — create a new custom list (multipart: nombre + file)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const nombre = (formData.get('nombre') as string | null)?.trim()
    const file   = formData.get('file') as File | null

    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
    if (!file)   return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''

    let rows: (string | number | null)[][] = []
    if (ext === 'csv') {
      const text = await file.text()
      const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
      rows = data
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' })
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usá CSV o Excel' }, { status: 400 })
    }

    const items = parseGeneric(rows)

    // Pick a color based on existing count
    const existing = getListasCustom()
    const color = COLORS[existing.length % COLORS.length]

    // Save items to disk
    const lista = addListaCustom({ nombre, filename, items: items.length, color })
    const dataFile = path.join(DATA_DIR, `lista-custom-${lista.id}.json`)
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf-8')

    return NextResponse.json(lista, { status: 201 })
  } catch (e) {
    console.error('[listas-custom POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
