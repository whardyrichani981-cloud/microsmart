import { NextRequest, NextResponse } from 'next/server'
import { getVentasGremio, addVentaGremio, updateVentaGremio, deleteVentaGremio, calcVentaGremio, getUltimoDolar, getNextOrdenGremio } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: getVentasGremio(), nextOrden: getNextOrdenGremio(), dolar: getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const calc = calcVentaGremio(body, getUltimoDolar())
  return NextResponse.json(addVentaGremio({ ...body, ...calc }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const calc = calcVentaGremio(data, getUltimoDolar())
  const item = updateVentaGremio(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteVentaGremio(id)
  return NextResponse.json({ ok: true })
}
