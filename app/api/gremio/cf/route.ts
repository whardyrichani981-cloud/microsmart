import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { CFItem } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getSupplierData<CFItem[]>('cf')
  return NextResponse.json(data)
}
