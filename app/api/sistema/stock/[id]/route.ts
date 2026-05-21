import { NextRequest, NextResponse } from 'next/server'
import { getStock, updateStockItem, deleteStockItem, calcStock, getUltimoDolar, addStockMovimiento } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { motivo: motivoRaw, referencia, ...data } = body
  // Capture before-state
  const before = (await getStock()).find(i => i.id === id)
  const calc = calcStock(data, await getUltimoDolar())
  const item = await updateStockItem(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Log if stock quantity changed
  if (before && data.stock !== undefined && data.stock !== before.stock) {
    const delta = (data.stock as number) - before.stock
    await addStockMovimiento({
      stockItemId: id,
      tipo: delta > 0 ? 'entrada' : 'salida',
      delta,
      stockAntes: before.stock,
      stockDespues: item.stock,
      motivo: motivoRaw ?? (delta > 0 ? 'Entrada de stock' : 'Salida de stock'),
      referencia,
      repuesto: item.repuesto,
      modelo: item.modelo,
      tipoStock: item.tipo,
      fecha: new Date().toISOString(),
    })
  }
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteStockItem(id)
  return NextResponse.json({ ok: true })
}
