import { NextRequest, NextResponse } from 'next/server'
import { getLogoLocal, setLogoLocal } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ logo: getLogoLocal() })
}

export async function POST(req: NextRequest) {
  const { logo } = await req.json()
  setLogoLocal(typeof logo === 'string' ? logo : '')
  return NextResponse.json({ ok: true })
}
