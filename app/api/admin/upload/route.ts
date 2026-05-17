import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { setSupplierData } from '@/lib/supplier-db'
import { parseGremioFull, parseOriginales, parseAmpsentrix, parseCF } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

const PARSERS: Record<string, (rows: (string | number | null)[][]) => unknown> = {
  gremio:     (r) => parseGremioFull(r),
  originales: (r) => parseOriginales(r),
  ampsentrix: (r) => parseAmpsentrix(r),
  cf:         (r) => parseCF(r),
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const key = form.get('key') as string
    const file = form.get('file') as File | null

    if (!key || !PARSERS[key]) {
      return NextResponse.json({ error: 'key inválido' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })
    }

    const text = await file.text()
    const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
    const parsed = PARSERS[key](data)

    await setSupplierData(key, parsed, file.name)

    return NextResponse.json({ ok: true, key, rows: Array.isArray(parsed) ? (parsed as unknown[]).length : '(objeto)' })
  } catch (e) {
    console.error('[admin/upload]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
