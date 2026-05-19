import { NextRequest, NextResponse } from 'next/server'
import { getTipoCambio, addTipoCambio, deleteTipoCambio, getUltimoDolar } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: getTipoCambio(), actual: getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  return NextResponse.json(addTipoCambio(await req.json()), { status: 201 })
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteTipoCambio(id)
  return NextResponse.json({ ok: true })
}
