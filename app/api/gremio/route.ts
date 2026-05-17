import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { GremioData } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getSupplierData<GremioData>('gremio')
  return NextResponse.json(data)
}
