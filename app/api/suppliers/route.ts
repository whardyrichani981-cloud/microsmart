import { NextResponse } from 'next/server'
import { fetchBuiltinSuppliers } from '@/lib/suppliers'

// Force-dynamic: never cache this route. Each fetch call inside
// fetchBuiltinSuppliers uses its own per-URL cache via { next: { revalidate } }.
export const dynamic = 'force-dynamic'

export async function GET() {
  const suppliers = await fetchBuiltinSuppliers()
  return NextResponse.json(suppliers)
}
