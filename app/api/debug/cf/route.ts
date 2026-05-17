import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { CFItem } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getSupplierData<CFItem[]>('cf')
    const isArray = Array.isArray(data)
    return NextResponse.json({
      ok: true,
      isArray,
      length: isArray ? data.length : 'N/A',
      sample: isArray ? data.slice(0, 2) : data,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), stack: e instanceof Error ? e.stack : undefined })
  }
}
