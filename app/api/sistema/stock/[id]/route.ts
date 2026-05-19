import { NextRequest, NextResponse } from 'next/server'
import { updateStockItem, deleteStockItem, calcStock, getUltimoDolar } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  const calc = calcStock(data, getUltimoDolar())
  const item = updateStockItem(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteStockItem(id)
  return NextResponse.json({ ok: true })
}
