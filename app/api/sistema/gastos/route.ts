import { NextRequest, NextResponse } from 'next/server'
import { getGastos, addGasto, updateGasto, deleteGasto, getUltimoDolar } from '@/lib/sistema-db'
import type { TipoGasto } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') as TipoGasto | null
  return NextResponse.json({ items: await getGastos(tipo ?? undefined), dolar: await getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const dolar = await getUltimoDolar()
  const montoARS = body.moneda === 'USD $' ? Math.round(body.monto * dolar) : Math.round(body.monto)
  return NextResponse.json(await addGasto({ ...body, montoARS }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const dolar = await getUltimoDolar()
  const montoARS = data.moneda === 'USD $' ? Math.round(data.monto * dolar) : Math.round(data.monto)
  const item = await updateGasto(id, { ...data, montoARS })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteGasto(id)
  return NextResponse.json({ ok: true })
}
