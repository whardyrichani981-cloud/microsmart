import { NextRequest, NextResponse } from 'next/server'
import { getGarantiaRetiro, setGarantiaRetiro } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ garantia: getGarantiaRetiro() })
}

export async function POST(req: NextRequest) {
  const { garantia } = await req.json()
  setGarantiaRetiro(typeof garantia === 'string' ? garantia : '')
  return NextResponse.json({ ok: true })
}
