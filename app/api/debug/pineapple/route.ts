import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseGeneric } from '@/lib/parsers'

export const dynamic = 'force-dynamic'

const PINEAPPLE_URL =
  'https://www.dropbox.com/scl/fi/zvykb4j6y5um068isb3ao/LISTA-DE-PRECIOS.xlsx?rlkey=ki9owi0uxzg1jscednolefunu&dl=1'

export async function GET() {
  try {
    const res = await fetch(PINEAPPLE_URL, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 500 })

    const buf = await res.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetNames = wb.SheetNames

    // Parse ALL sheets
    const sheetResults: Record<string, { rows: number; items: number; preview: string[][] }> = {}
    const allItems: ReturnType<typeof parseGeneric> = []

    for (const name of sheetNames) {
      const ws = wb.Sheets[name]
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })
      const items = parseGeneric(rows)
      sheetResults[name] = {
        rows: rows.length,
        items: items.length,
        preview: rows.slice(0, 5).map(r => r.map(c => String(c ?? '').trim()).filter(c => c.length > 0)),
      }
      allItems.push(...items)
    }

    const seen = new Set<string>()
    const deduped = allItems.filter(item => {
      const key = `${item.name.toLowerCase()}|${item.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({
      ok: true,
      sheets: sheetNames,
      sheetResults,
      totalBeforeDedup: allItems.length,
      totalAfterDedup: deduped.length,
      firstItems: deduped.slice(0, 20),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
