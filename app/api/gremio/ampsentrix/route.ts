import { NextResponse } from 'next/server'
import { getSupplierData } from '@/lib/supplier-db'
import type { AmpsentrixItem } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getSupplierData<AmpsentrixItem[]>('ampsentrix')
  return NextResponse.json(data)
}
