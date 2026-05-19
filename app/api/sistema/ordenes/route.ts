import { NextRequest, NextResponse } from 'next/server'
import { getOrdenes, addOrden, updateOrden, calcOrden, getNextOrdenNum, getUltimoDolar } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Auto-repair: assign nOrden to any order missing it
  const items = getOrdenes()
  const hasBad = items.some(o => !o.nOrden || !isFinite(Number(o.nOrden)))
  if (hasBad) {
    let counter = 1
    for (const o of items) {
      if (!o.nOrden || !isFinite(Number(o.nOrden))) {
        updateOrden(o.id, { nOrden: counter })
      } else {
        counter = Math.max(counter, o.nOrden)
      }
      counter++
    }
  }
  return NextResponse.json({ items: getOrdenes(), nextOrden: getNextOrdenNum(), dolar: getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const dolar = getUltimoDolar()
  const calc = calcOrden(body, dolar)
  const nOrden = getNextOrdenNum()
  return NextResponse.json(addOrden({ ...body, ...calc, nOrden }), { status: 201 })
}
