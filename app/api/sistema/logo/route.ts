import { NextRequest, NextResponse } from 'next/server'
import { getLogoLocal, setLogoLocal } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ logo: await getLogoLocal() })
}

export async function POST(req: NextRequest) {
  const { logo } = await req.json()
  await setLogoLocal(typeof logo === 'string' ? logo : '')
  return NextResponse.json({ ok: true })
}
