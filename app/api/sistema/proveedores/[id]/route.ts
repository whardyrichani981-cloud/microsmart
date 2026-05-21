import { NextRequest, NextResponse } from 'next/server'
import { updateProveedor, deleteProveedor } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  const item = await updateProveedor(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteProveedor(id)
  return NextResponse.json({ ok: true })
}