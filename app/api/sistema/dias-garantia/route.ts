import { NextRequest, NextResponse } from 'next/server'
import { getDiasGarantiaDefault, setDiasGarantiaDefault } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ dias: getDiasGarantiaDefault() })
}

export async function POST(req: NextRequest) {
  const { dias } = await req.json()
  const n = parseInt(String(dias)) || 90
  setDiasGarantiaDefault(Math.max(1, Math.min(n, 3650)))
  return NextResponse.json({ ok: true, dias: n })
}
