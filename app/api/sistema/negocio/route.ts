import { NextRequest, NextResponse } from 'next/server'
import { getNombreNegocio, setNombreNegocio } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ nombre: getNombreNegocio() })
}

export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  setNombreNegocio(typeof nombre === 'string' ? nombre.trim() : '')
  return NextResponse.json({ ok: true })
}
