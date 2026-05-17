import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { CFItem } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getSupplierData<CFItem[]>('cf')
    return NextResponse.json(data)
  } catch (e) {
    console.error('[/api/gremio/cf]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
