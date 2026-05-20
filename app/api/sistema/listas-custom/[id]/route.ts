import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { getListasCustom, updateListaCustom, deleteListaCustom } from '@/lib/sistema-db'
import { parseGeneric } from '@/lib/parsers'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

// GET — single list with items
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const all  = getListasCustom()
  const meta = all.find(l => l.id === id)
  if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dataFile = path.join(DATA_DIR, `lista-custom-${id}.json`)
  let items: unknown[] = []
  try {
    if (fs.existsSync(dataFile))
      items = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
  } catch { /* ignore */ }

  return NextResponse.json({ ...meta, itemsData: items })
}

// PUT — re-upload / replace file for existing list
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const all  = getListasCustom()
    const meta = all.find(l => l.id === id)
    if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

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
    const dataFile = path.join(DATA_DIR, `lista-custom-${id}.json`)
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf-8')

    const updated = updateListaCustom(id, { filename, items: items.length })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[listas-custom PUT]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE — remove list + data file
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  deleteListaCustom(id)
  const dataFile = path.join(DATA_DIR, `lista-custom-${id}.json`)
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile)
  return NextResponse.json({ ok: true })
}
