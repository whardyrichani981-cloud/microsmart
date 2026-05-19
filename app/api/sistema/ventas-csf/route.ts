import { NextRequest, NextResponse } from 'next/server'
import { getVentasCSF, addVentaCSF, updateVentaCSF, deleteVentaCSF, calcVentaCSF, getUltimoDolar, getNextOrdenCSF } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: getVentasCSF(), nextOrden: getNextOrdenCSF(), dolar: getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const dolar = getUltimoDolar()
  const calc = calcVentaCSF(body, dolar)
  return NextResponse.json(addVentaCSF({ ...body, ...calc }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const dolar = getUltimoDolar()
  const calc = calcVentaCSF(data, dolar)
  const item = updateVentaCSF(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteVentaCSF(id)
  return NextResponse.json({ ok: true })
}
