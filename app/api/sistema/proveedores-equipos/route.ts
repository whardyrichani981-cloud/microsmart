import { NextRequest, NextResponse } from 'next/server'
import {
  getProveedoresEquipos, addProveedorEquipo,
  updateProveedorEquipo, deleteProveedorEquipo,
} from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getProveedoresEquipos())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json(await addProveedorEquipo(body))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const item = await updateProveedorEquipo(id, data)
    if (!item) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await deleteProveedorEquipo(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
