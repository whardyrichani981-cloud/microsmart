import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export const dynamic = 'force-dynamic'

// Debug endpoint: upload a file and get back the first 20 raw rows
// so we can see exactly what columns the Excel/CSV has.
// Usage: POST /api/debug/raw-upload with form field "file"
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''

    let rows: (string | number | null)[][] = []
    let sheetNames: string[] = []

    if (ext === 'csv') {
      const text = await file.text()
      const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
      rows = data
      sheetNames = ['CSV']
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      sheetNames = wb.SheetNames
      // Read first sheet
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' })
    } else {
      return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
    }

    // Return first 25 rows with column indices
    const preview = rows.slice(0, 25).map((row, i) => ({
      rowIdx: i,
      cells: row.map((cell, j) => ({ col: j, val: String(cell ?? '') }))
    }))

    // Also find which rows have the most non-empty cells (likely the header)
    const nonEmptyCounts = rows.slice(0, 25).map((row, i) => ({
      rowIdx: i,
      nonEmpty: row.filter(c => String(c ?? '').trim().length > 0).length,
      preview: row.slice(0, 8).map(c => String(c ?? '').trim()).join(' | ')
    }))

    return NextResponse.json({
      ok: true,
      filename,
      totalRows: rows.length,
      sheets: sheetNames,
      nonEmptyCounts,
      preview,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
