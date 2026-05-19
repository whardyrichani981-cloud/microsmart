import { NextRequest, NextResponse } from 'next/server'
import { getComisiones, addComision, updateComision, deleteComision, calcComision } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const emp = req.nextUrl.searchParams.get('empleado')
  return NextResponse.json(getComisiones(emp ?? undefined))
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const calc = calcComision(body)
  return NextResponse.json(addComision({ ...body, ...calc }), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const calc = calcComision(data)
  const item = updateComision(id, { ...data, ...calc })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteComision(id)
  return NextResponse.json({ ok: true })
}
