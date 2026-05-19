import { NextRequest, NextResponse } from 'next/server'
import { getClientesPersonas, addClientePersona } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() { return NextResponse.json(getClientesPersonas()) }
export async function POST(req: NextRequest) {
  return NextResponse.json(addClientePersona(await req.json()), { status: 201 })
}
