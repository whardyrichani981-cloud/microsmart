import { NextRequest, NextResponse } from 'next/server'
import { getTurnos, addTurno, updateTurno, deleteTurno } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getTurnos())
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  return NextResponse.json(await addTurno(body), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const item = await updateTurno(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteTurno(id)
  return NextResponse.json({ ok: true })
}
