import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { OriginalItem } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getSupplierData<OriginalItem[]>('originales')
  return NextResponse.json(data)
}
