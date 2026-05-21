import { NextRequest, NextResponse } from 'next/server'
import { getTerminos, setTerminos } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ terminos: await getTerminos() })
}

export async function POST(req: NextRequest) {
  const { terminos } = await req.json()
  await setTerminos(typeof terminos === 'string' ? terminos : '')
  return NextResponse.json({ ok: true })
}
