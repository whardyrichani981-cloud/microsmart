import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { parseCF } from '@/lib/gremio-parser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const text = fs.readFileSync(path.join(process.cwd(), 'data', 'cf.csv'), 'utf-8')
  const { data } = Papa.parse<(string | number | null)[]>(text, { skipEmptyLines: false })
  return NextResponse.json(parseCF(data))
}
