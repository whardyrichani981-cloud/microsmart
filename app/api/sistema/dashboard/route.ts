import { NextResponse } from 'next/server'
import { getDashboard } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getDashboard())
}
