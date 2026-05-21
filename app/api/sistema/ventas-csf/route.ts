import { NextRequest, NextResponse } from 'next/server'
import { getVentasCSF, addVentaCSF, updateVentaCSF, deleteVentaCSF, calcVentaCSF, getUltimoDolar, getNextOrdenCSF } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: await getVentasCSF(), nextOrden: await getNextOrdenCSF(), dolar: await getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const dolar = await getUltimoDolar()
  const calc = await calcVentaCSF(body, dolar)
  return NextResponse.json(await addVentaCSF({ ...body, ...calc }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const dolar = await getUltimoDolar()
  const calc = await calcVentaCSF(data, dolar)
  const item = await updateVentaCSF(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteVentaCSF(id)
  return NextResponse.json({ ok: true })
}
