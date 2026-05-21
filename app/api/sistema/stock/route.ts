import { NextRequest, NextResponse } from 'next/server'
import { getStock, addStockItem, updateStockItem, deleteStockItem, calcStock, getUltimoDolar, addStockMovimiento } from '@/lib/sistema-db'
import type { TipoStock } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') as TipoStock | null
  return NextResponse.json({ items: getStock(tipo ?? undefined), dolar: getUltimoDolar() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { motivo: motivoRaw, referencia, ...itemData } = body
  const calc = calcStock(itemData, getUltimoDolar())
  const item = addStockItem({ ...itemData, ...calc })
  // Log entrada inicial
  if ((item.stock ?? 0) > 0) {
    addStockMovimiento({
      stockItemId: item.id,
      tipo: 'entrada',
      delta: item.stock ?? 0,
      stockAntes: 0,
      stockDespues: item.stock ?? 0,
      motivo: motivoRaw ?? 'Ingreso de stock',
      referencia,
      repuesto: item.repuesto,
      modelo: item.modelo,
      tipoStock: item.tipo,
      fecha: new Date().toISOString(),
    })
  }
  return NextResponse.json(item, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, motivo: motivoRaw, referencia, ...data } = body
  // Capture before-state
  const allItems = getStock()
  const before = allItems.find(i => i.id === id)
  const calc = calcStock(data, getUltimoDolar())
  const item = updateStockItem(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Log if stock quantity changed
  if (before && data.stock !== undefined && data.stock !== before.stock) {
    const delta = (data.stock as number) - before.stock
    addStockMovimiento({
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

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteStockItem(id)
  return NextResponse.json({ ok: true })
}
