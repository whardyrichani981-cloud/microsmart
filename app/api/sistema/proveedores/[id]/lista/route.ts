import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { getListasMeta, setListaMeta, deleteListaMeta } from '@/lib/sistema-db'
import { parseGeneric } from '@/lib/parsers'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const all = getListasMeta()
  const meta = all[id]
  if (!meta) return NextResponse.json(null)
  // Include parsed items from disk
  const dataFile = path.join(DATA_DIR, `lista-proveedor-${id}.json`)
  let items: unknown[] = []
  try {
    if (fs.existsSync(dataFile))
      items = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
  } catch { /* ignore */ }
  return NextResponse.json({ ...meta, itemsData: items })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' })
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usá CSV o Excel (.xlsx/.xls)' }, { status: 400 })
    }

    const items = parseGeneric(rows)

    // Debug: log first rows so we can see the actual structure
    console.log('[lista/upload] filename:', filename)
    console.log('[lista/upload] total rows:', rows.length)
    console.log('[lista/upload] row[0]:', JSON.stringify(rows[0]))
    console.log('[lista/upload] row[1]:', JSON.stringify(rows[1]))
    console.log('[lista/upload] row[2]:', JSON.stringify(rows[2]))
    console.log('[lista/upload] row[3]:', JSON.stringify(rows[3]))
    console.log('[lista/upload] row[4]:', JSON.stringify(rows[4]))
    console.log('[lista/upload] items parsed:', items.length)
    if (items.length > 0) {
      console.log('[lista/upload] first item:', JSON.stringify(items[0]))
    }

    // Save parsed data
    const dataFile = path.join(DATA_DIR, `lista-proveedor-${id}.json`)
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf-8')

    // Save metadata
    const meta = { filename, items: items.length, updatedAt: new Date().toISOString() }
    setListaMeta(id, meta)

    // If 0 items parsed, return debug info so we can see what the file looks like
    if (items.length === 0) {
      const previewRows = rows.slice(0, 8).map(r => r.map(c => String(c ?? '').trim()))
      return NextResponse.json({
        ok: true, ...meta,
        warning: 'No se encontraron productos. Revisá la estructura del archivo.',
        preview: previewRows,
      })
    }

    return NextResponse.json({ ok: true, ...meta })
  } catch (e) {
    console.error('[lista/upload]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  deleteListaMeta(id)
  const dataFile = path.join(DATA_DIR, `lista-proveedor-${id}.json`)
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile)
  return NextResponse.json({ ok: true })
}
