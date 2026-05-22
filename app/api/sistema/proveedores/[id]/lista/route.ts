import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { getListasMeta, setListaMeta, deleteListaMeta, getListaData, setListaData, deleteListaData } from '@/lib/sistema-db'
import { parseGeneric } from '@/lib/parsers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const all = await getListasMeta()
  const meta = all[id]
  if (!meta) return NextResponse.json(null)
  const items = await getListaData(id)
  return NextResponse.json({ ...meta, itemsData: items })
}

/** Converts any Google Sheets URL to a CSV export URL */
function normalizeGoogleSheetsUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return url
  const id = match[1]
  const gidMatch = url.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
}

/** Parse raw bytes into rows using magic-byte detection + extension hints */
function parseBytes(buf: ArrayBuffer, ext: string): (string | number | null)[][] {
  const magic = new Uint8Array(buf.slice(0, 4))
  const isOOXML     = magic[0] === 0x50 && magic[1] === 0x4B
  const isBinaryXls = magic[0] === 0xD0 && magic[1] === 0xCF
  const isExcel = isOOXML || isBinaryXls || ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)

  if (isExcel) {
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' })
  }
  const text = new TextDecoder('utf-8').decode(buf)
  const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
  if (data.length < 2 && !['csv', 'txt', 'tsv', ''].includes(ext)) {
    throw new Error(`Formato no reconocido (.${ext || 'sin extensión'}). Guardá el archivo como CSV o Excel (.xlsx).`)
  }
  return data
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ct = req.headers.get('content-type') ?? ''

    let filename = ''
    let rows: (string | number | null)[][] = []

    if (ct.includes('application/json')) {
      // ── URL mode ─────────────────────────────────────────────────────────────
      const body = await req.json()
      const rawUrl: string = (body.url as string | null)?.trim() ?? ''
      if (!rawUrl) return NextResponse.json({ error: 'url requerido' }, { status: 400 })

      const fetchUrl = normalizeGoogleSheetsUrl(rawUrl)

      let fetchRes: Response
      try {
        fetchRes = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
      } catch (e) {
        return NextResponse.json({ error: `No se pudo acceder al enlace: ${String(e)}` }, { status: 422 })
      }
      if (!fetchRes.ok) {
        return NextResponse.json({ error: `El enlace respondió con error ${fetchRes.status}. Verificá que el archivo sea público.` }, { status: 422 })
      }

      const contentType = fetchRes.headers.get('content-type') ?? ''
      const buf = await fetchRes.arrayBuffer()
      const ext = contentType.includes('spreadsheetml') || contentType.includes('excel') ? 'xlsx' : 'csv'
      rows = parseBytes(buf, ext)
      filename = fetchUrl.includes('google') ? 'Google Sheets' : new URL(fetchUrl).hostname

    } else {
      // ── File upload mode ─────────────────────────────────────────────────────
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

      filename = file.name
      const ext = (filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '') ?? ''
      const buf = await file.arrayBuffer()
      rows = parseBytes(buf, ext)
    }

    const items = parseGeneric(rows)

    // Save parsed data to Redis (or filesystem locally)
    await setListaData(id, items)

    // Save metadata
    const meta = { filename, items: items.length, updatedAt: new Date().toISOString() }
    await setListaMeta(id, meta)

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
  await deleteListaMeta(id)
  await deleteListaData(id)
  return NextResponse.json({ ok: true })
}
