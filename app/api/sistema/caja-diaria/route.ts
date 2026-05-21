import { NextRequest, NextResponse } from 'next/server'
import { getCierresCaja, addCierreCaja, deleteCierreCaja } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getCierresCaja())
}
export async function POST(req: NextRequest) {
  const data = await req.json()
  const item = await addCierreCaja(data)
  return NextResponse.json(item, { status: 201 })
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteCierreCaja(id)
  return NextResponse.json({ ok: true })
}
