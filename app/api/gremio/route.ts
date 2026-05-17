import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { parseGremioFull } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const text = fs.readFileSync(path.join(process.cwd(), 'data', 'gremio.csv'), 'utf-8')
  const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
  const gremioData = parseGremioFull(data)
  return NextResponse.json(gremioData)
}
