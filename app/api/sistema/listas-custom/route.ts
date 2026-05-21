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

/** Converts any Google Sheets URL to a CSV export URL */
function normalizeGoogleSheetsUrl(url: string): string {
  // Match: /spreadsheets/d/{id}/...  (edit, view, pub, etc.)
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return url

  const id = match[1]
  // Preserve gid (sheet tab) if present
  const gidMatch = url.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
}

/** Parse raw rows using magic-byte detection + extension as hints */
function parseRows(buf: ArrayBuffer, ext: string): (string | number | null)[][] {
  const magic = new Uint8Array(buf.slice(0, 4))
  const isOOXML     = magic[0] === 0x50 && magic[1] === 0x4B    // PK (ZIP → xlsx/xlsm)
  const isBinaryXls = magic[0] === 0xD0 && magic[1] === 0xCF    // D0CF → xls/xlsb

  const isExcel   = isOOXML || isBinaryXls || ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)
  const isCsvLike = !isExcel && ['csv', 'txt', 'tsv', ''].includes(ext)

  if (isExcel) {
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' })
  }
  if (isCsvLike) {
    const text = new TextDecoder('utf-8').decode(buf)
    const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
    return data
  }
  // Last resort — try as text
  const text = new TextDecoder('utf-8').decode(buf)
  const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
  if (data.length < 2) throw new Error(`Formato no reconocido (.${ext || 'sin extensión'}). Guardá el archivo como CSV o Excel (.xlsx).`)
  return data
}

// GET — all custom lists (without items)
export async function GET() {
  return NextResponse.json(await getListasCustom())
}

// POST — create a new custom list
// Accepts either:
//   multipart/form-data  { nombre, file }
//   application/json     { nombre, url }
export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') ?? ''
    let nombre = ''
    let filename = ''
    let rows: (string | number | null)[][] = []

    if (ct.includes('application/json')) {
      // ── URL mode ───────────────────────────────────────────────────────────
      const body = await req.json()
      nombre = (body.nombre as string | null)?.trim() ?? ''
      const rawUrl: string = (body.url as string | null)?.trim() ?? ''

      if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
      if (!rawUrl)  return NextResponse.json({ error: 'url requerido'    }, { status: 400 })

      // Normalize Google Sheets URLs
      const fetchUrl = normalizeGoogleSheetsUrl(rawUrl)

      // Fetch the remote file
      let res: Response
      try {
        res = await fetch(fetchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        })
      } catch (fetchErr) {
        return NextResponse.json({ error: `No se pudo acceder al enlace: ${String(fetchErr)}` }, { status: 422 })
      }
      if (!res.ok) {
        return NextResponse.json({ error: `El enlace respondió con error ${res.status}. Verificá que el archivo sea público.` }, { status: 422 })
      }

      const contentType = res.headers.get('content-type') ?? ''
      const buf = await res.arrayBuffer()

      // Determine extension from Content-Type or URL
      let ext = 'csv'
      if (contentType.includes('spreadsheetml') || contentType.includes('excel') || fetchUrl.endsWith('.xlsx')) ext = 'xlsx'
      else if (fetchUrl.endsWith('.xls')) ext = 'xls'

      rows = parseRows(buf, ext)
      filename = fetchUrl.includes('google') ? 'Google Sheets' : new URL(fetchUrl).hostname

    } else {
      // ── File upload mode (existing behavior) ───────────────────────────────
      const formData = await req.formData()
      nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
      const file = formData.get('file') as File | null

      if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
      if (!file)   return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

      filename = file.name
      const ext = filename.split('.').pop()?.toLowerCase() ?? ''
      const buf = await file.arrayBuffer()
      rows = parseRows(buf, ext)
    }

    const items = parseGeneric(rows)

    // Pick a color based on existing count
    const existing = await getListasCustom()
    const color = COLORS[existing.length % COLORS.length]

    // Save items to disk
    const lista = await addListaCustom({ nombre, filename, items: items.length, color })
    const dataFile = path.join(DATA_DIR, `lista-custom-${lista.id}.json`)
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf-8')

    return NextResponse.json(lista, { status: 201 })
  } catch (e) {
    console.error('[listas-custom POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
