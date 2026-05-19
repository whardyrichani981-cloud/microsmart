import { NextRequest, NextResponse } from 'next/server'
import { getServicios, addServicio } from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getServicios())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const item = addServicio(body)
  return NextResponse.json(item, { status: 201 })
}
