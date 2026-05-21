import { NextRequest, NextResponse } from 'next/server'
import { getReglasComision, setReglasComision } from '@/lib/sistema-db'
import type { ReglaComision } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

export async function GET() {
  return NextResponse.json(await getReglasComision())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const reglas = await getReglasComision()
  const nueva: ReglaComision = {
    id: uid(),
    tipo: body.tipo,
    empleado: body.empleado,
    porcentaje: Number(body.porcentaje) || 0,
    comisionFija: Number(body.comisionFija) || 0,
    activa: body.activa !== false,
    createdAt: new Date().toISOString(),
  }
  await setReglasComision([...reglas, nueva])
  return NextResponse.json(nueva, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const reglas = await getReglasComision()
  const idx = reglas.findIndex(r => r.id === body.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  reglas[idx] = { ...reglas[idx], ...body }
  await setReglasComision(reglas)
  return NextResponse.json(reglas[idx])
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await setReglasComision((await getReglasComision()).filter(r => r.id !== id))
  return NextResponse.json({ ok: true })
}
