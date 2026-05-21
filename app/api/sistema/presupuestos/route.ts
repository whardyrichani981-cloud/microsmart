import { NextRequest, NextResponse } from 'next/server'
import { getPresupuestos, addPresupuesto, updatePresupuesto, deletePresupuesto, getNextPresupuestoNum } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let items = getPresupuestos()
  // Reparar registros sin nPresupuesto (migración)
  const sinNumero = items.filter(i => !i.nPresupuesto)
  if (sinNumero.length > 0) {
    const maxExistente = Math.max(0, ...items.filter(i => !!i.nPresupuesto).map(i => i.nPresupuesto!))
    let counter = maxExistente + 1
    for (const p of sinNumero) {
      await updatePresupuesto(p.id, { nPresupuesto: counter++ })
    }
    items = getPresupuestos()
  }
  const nextNum = getNextPresupuestoNum()
  return NextResponse.json({ items, nextNum })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const item = addPresupuesto(data)
  return NextResponse.json(item, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const item = updatePresupuesto(id, data)
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deletePresupuesto(id)
  return NextResponse.json({ ok: true })
}
