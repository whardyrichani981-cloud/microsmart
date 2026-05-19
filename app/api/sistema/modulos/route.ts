import { NextRequest, NextResponse } from 'next/server'
import { getModulos, setModulos } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getModulos())
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  setModulos(body)
  return NextResponse.json({ ok: true })
}