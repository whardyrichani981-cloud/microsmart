import { NextRequest, NextResponse } from 'next/server'
import { getVentasCaja, addVentaCaja, updateVentaCaja, deleteVentaCaja, getNextVentaCajaNum } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: getVentasCaja(), nextVenta: getNextVentaCajaNum() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const nVenta = getNextVentaCajaNum()
  return NextResponse.json(addVentaCaja({ ...body, nVenta }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const item = updateVentaCaja(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteVentaCaja(id)
  return NextResponse.json({ ok: true })
}
