import { NextResponse } from 'next/server'
import { getSupplierMeta } from '@/lib/supplier-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const meta = await getSupplierMeta()
  return NextResponse.json(meta)
}
