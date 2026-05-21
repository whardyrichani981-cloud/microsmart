import { NextRequest, NextResponse } from 'next/server'
import { getStockMovimientos } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo')     // 'entrada' | 'salida' | 'ajuste' | null
  const search = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? ''
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '200')

  let items = getStockMovimientos()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (tipo) items = items.filter(m => m.tipo === tipo)
  if (search) items = items.filter(m =>
    m.repuesto.toLowerCase().includes(search) ||
    m.modelo.toLowerCase().includes(search) ||
    m.motivo.toLowerCase().includes(search) ||
    (m.referencia ?? '').toLowerCase().includes(search)
  )

  return NextResponse.json({ items: items.slice(0, limit), total: items.length })
}
