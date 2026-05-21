import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { getListasMeta } from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

// Minimal re-parse that shows EXACTLY what columns are detected
function debugParse(rows: (string | number | null)[][]) {
  function clean(v: unknown): string {
    return String(v ?? '').replace(/^"|"$/g, '').trim()
  }

  // Find header row
  const ALL_KW = ['producto','descripcion','nombre','item','articulo','modelo','model','equipo',
    'tipo producto','tipo de producto','tipo','type','componente','categoria','category','cat',
    'codigo','code','cod','sku','precio','price','usd','dolar','ars','pesos','transferencia']

  let headerIdx = 0, bestScore = -1
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const cells = rows[i].map(c => clean(c).toLowerCase())
    if (cells.filter(c => c.length > 0).length < 2) continue
    const score = cells.filter(c => ALL_KW.some(kw => c.includes(kw))).length
    if (score > bestScore) { bestScore = score; headerIdx = i }
  }

  const headers = rows[headerIdx].map(c => clean(c).toLowerCase())

  // Show first 20 data rows with all columns
  const dataRows = rows.slice(headerIdx + 1, headerIdx + 21).map(row => {
    const cells = row.map(c => clean(c))
    return headers.map((h, i) => ({ col: h || `col${i}`, val: cells[i] ?? '' }))
  })

  return { headerIdx, headers, bestScore, dataRows }
}

export async function GET() {
  try {
    // Find Cokocell lista ID
    const all = await getListasMeta()
    const id = Object.keys(all)[0]  // first (only) uploaded lista
    if (!id) return NextResponse.json({ error: 'No uploaded lista found' }, { status: 404 })

    // Read stored JSON
    const jsonFile = path.join(DATA_DIR, `lista-proveedor-${id}.json`)
    const storedItems = fs.existsSync(jsonFile)
      ? JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
      : []

    // We don't have the original file stored, so show what we have
    // Show first 10 stored items grouped by code range to understand structure
    return NextResponse.json({
      ok: true,
      meta: all[id],
      totalStored: storedItems.length,
      // Items from modulos with same model name (the problematic ones)
      modulosIphone13: storedItems
        .filter((i: {name:string; category:string}) => i.name === 'IPHONE 13' && i.category === 'modulos')
        .slice(0, 10),
      // First 5 unique names in modulos
      firstModulos: storedItems
        .filter((i: {category:string}) => i.category === 'modulos')
        .slice(0, 20)
        .map((i: {name:string; code:string; price:number}) => `${i.name} [${i.code}] $${i.price}`),
      // Check if any stored item has tipo-like info in the name
      sampleWithQualityInName: storedItems
        .filter((i: {name:string}) => /incell|oled|original|flex|bateria/i.test(i.name))
        .slice(0, 5),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
