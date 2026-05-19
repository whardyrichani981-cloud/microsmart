import { NextRequest, NextResponse } from 'next/server'
import { getReglasComisionGremio, setReglasComisionGremio } from '@/lib/sistema-db'
import type { ReglaComisionGremio } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

export async function GET() {
  return NextResponse.json(getReglasComisionGremio())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const reglas = getReglasComisionGremio()
  const nueva: ReglaComisionGremio = {
    id: uid(),
    modelo: (body.modelo ?? '').trim(),
    tipoReparacion: (body.tipoReparacion ?? '').trim(),
    comisionFija: Number(body.comisionFija) || 0,
    activa: body.activa !== false,
    createdAt: new Date().toISOString(),
  }
  setReglasComisionGremio([...reglas, nueva])
  return NextResponse.json(nueva, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const reglas = getReglasComisionGremio()
  const idx = reglas.findIndex(r => r.id === body.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  reglas[idx] = {
    ...reglas[idx],
    modelo: (body.modelo ?? reglas[idx].modelo).trim(),
    tipoReparacion: (body.tipoReparacion ?? reglas[idx].tipoReparacion).trim(),
    comisionFija: body.comisionFija !== undefined ? Number(body.comisionFija) : reglas[idx].comisionFija,
    activa: body.activa !== undefined ? Boolean(body.activa) : reglas[idx].activa,
  }
  setReglasComisionGremio(reglas)
  return NextResponse.json(reglas[idx])
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  setReglasComisionGremio(getReglasComisionGremio().filter(r => r.id !== id))
  return NextResponse.json({ ok: true })
}
