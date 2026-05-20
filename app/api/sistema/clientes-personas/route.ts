import { NextRequest, NextResponse } from 'next/server'
import { getClientesPersonas, addClientePersona, updateClientePersona, deleteClientePersona } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() { return NextResponse.json(getClientesPersonas()) }
export async function POST(req: NextRequest) {
  return NextResponse.json(addClientePersona(await req.json()), { status: 201 })
}
export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const item = updateClientePersona(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteClientePersona(id)
  return NextResponse.json({ ok: true })
}
