import { NextRequest, NextResponse } from 'next/server'
import { getOrdenes, addOrden, updateOrden, calcOrden, getNextOrdenNum, getUltimoDolar } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Auto-repair: assign nOrden to any order missing it
  const items = await getOrdenes()
  const hasBad = items.some(o => !o.nOrden || !isFinite(Number(o.nOrden)))
  if (hasBad) {
    let counter = 1
    for (const o of items) {
      if (!o.nOrden || !isFinite(Number(o.nOrden))) {
        await updateOrden(o.id, { nOrden: counter })
      } else {
        counter = Math.max(counter, o.nOrden)
      }
      counter++
    }
  }
  return NextResponse.json({ items: await getOrdenes(), nextOrden: await getNextOrdenNum(), dolar: await getUltimoDolar() })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const dolar = await getUltimoDolar()
  const calc = calcOrden(body, dolar)
  const nOrden = await getNextOrdenNum()
  return NextResponse.json(await addOrden({ ...body, ...calc, nOrden }), { status: 201 })
}
