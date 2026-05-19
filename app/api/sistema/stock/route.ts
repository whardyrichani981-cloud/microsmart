import { NextRequest, NextResponse } from 'next/server'
import { getStock, addStockItem, updateStockItem, deleteStockItem, calcStock, getUltimoDolar } from '@/lib/sistema-db'
import type { TipoStock } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') as TipoStock | null
  return NextResponse.json({ items: getStock(tipo ?? undefined), dolar: getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const calc = calcStock(body, getUltimoDolar())
  return NextResponse.json(addStockItem({ ...body, ...calc }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const calc = calcStock(data, getUltimoDolar())
  const item = updateStockItem(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteStockItem(id)
  return NextResponse.json({ ok: true })
}
