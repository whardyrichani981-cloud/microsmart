import { NextRequest, NextResponse } from 'next/server'
import { getEstadosOrden, setEstadosOrden } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

const PROTECTED = ['Entrada', 'Salida']

export async function GET() {
  return NextResponse.json(await getEstadosOrden())
}

export async function PUT(req: NextRequest) {
  const body: string[] = await req.json()
  // Ensure protected states are always present and in correct positions
  const middle = body.filter(e => !PROTECTED.includes(e))
  const final = ['Entrada', ...middle, 'Salida']
  await setEstadosOrden(final)
  return NextResponse.json(final)
}
