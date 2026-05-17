import { NextResponse } from 'next/server'
import { fetchBuiltinSuppliers } from '@/lib/suppliers'

export const revalidate = 3600

export async function GET() {
  const suppliers = await fetchBuiltinSuppliers()
  return NextResponse.json(suppliers)
}
