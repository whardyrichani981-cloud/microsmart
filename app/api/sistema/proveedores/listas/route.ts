import { NextResponse } from 'next/server'
import { getListasMeta } from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getListasMeta())
}
