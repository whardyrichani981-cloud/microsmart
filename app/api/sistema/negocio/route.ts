import { NextRequest, NextResponse } from 'next/server'
import { getNombreNegocio, setNombreNegocio } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ nombre: await getNombreNegocio() })
  } catch (e) {
    console.error('[GET /api/sistema/negocio]', e)
    return NextResponse.json({ nombre: '', error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre } = body
    await setNombreNegocio(typeof nombre === 'string' ? nombre.trim() : '')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[POST /api/sistema/negocio]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
