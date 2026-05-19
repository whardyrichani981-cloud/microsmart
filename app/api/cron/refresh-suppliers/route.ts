import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { parseBhTech, parseCparts, parseGeneric } from '@/lib/parsers'

const BHTECH_URL =
  'https://docs.google.com/spreadsheets/d/1tNpvPU5mTcwPFP4fuKS-JR-dB4-38rerBbBfvAxrUhk/export?format=csv&gid=0'
const CPARTS_URL =
  'https://docs.google.com/spreadsheets/d/1kmBJEat-wFBD1Byxfow7G6JIeEKDv_Ct/export?format=csv&gid=1822284056'
const PINEAPPLE_URL =
  'https://www.dropbox.com/scl/fi/zvykb4j6y5um068isb3ao/LISTA-DE-PRECIOS.xlsx?rlkey=ki9owi0uxzg1jscednolefunu&dl=1'

// Simple checksum: total items + sum of first price of each item
function checksum(items: { price?: number | null }[]): string {
  const count = items.length
  const priceSum = items.reduce((s, i) => s + (i.price ?? 0), 0)
  return `${count}:${Math.round(priceSum)}`
}

interface SupplierResult {
  id: string
  count: number
  checksum: string
  changed: boolean
  error?: string
}

// Stored checksums in memory (resets on server restart; good enough for daily cron)
const lastChecksums: Record<string, string> = {}

async function refreshBhTech(): Promise<SupplierResult> {
  try {
    const res = await fetch(BHTECH_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
    const items = parseBhTech(data)
    const cs = checksum(items)
    const changed = lastChecksums['bhtech'] !== undefined && lastChecksums['bhtech'] !== cs
    lastChecksums['bhtech'] = cs
    return { id: 'bhtech', count: items.length, checksum: cs, changed }
  } catch (e) {
    return { id: 'bhtech', count: 0, checksum: '', changed: false, error: String(e) }
  }
}

async function refreshCparts(): Promise<SupplierResult> {
  try {
    const res = await fetch(CPARTS_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
    const items = parseCparts(data)
    const cs = checksum(items)
    const changed = lastChecksums['cparts'] !== undefined && lastChecksums['cparts'] !== cs
    lastChecksums['cparts'] = cs
    return { id: 'cparts', count: items.length, checksum: cs, changed }
  } catch (e) {
    return { id: 'cparts', count: 0, checksum: '', changed: false, error: String(e) }
  }
}

async function refreshPineapple(): Promise<SupplierResult> {
  try {
    const res = await fetch(PINEAPPLE_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })
    const items = parseGeneric(rows)
    const cs = checksum(items)
    const changed = lastChecksums['pineapple'] !== undefined && lastChecksums['pineapple'] !== cs
    lastChecksums['pineapple'] = cs
    return { id: 'pineapple', count: items.length, checksum: cs, changed }
  } catch (e) {
    return { id: 'pineapple', count: 0, checksum: '', changed: false, error: String(e) }
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically; external callers must include it)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const started = new Date().toISOString()
  console.log(`[cron] refresh-suppliers started at ${started}`)

  const results = await Promise.all([
    refreshBhTech(),
    refreshCparts(),
    refreshPineapple(),
  ])

  const anyChanged = results.some(r => r.changed)
  const anyError   = results.some(r => r.error)

  if (anyChanged) {
    // Invalidate the ISR cache so the next visitor gets fresh data
    revalidatePath('/api/suppliers')
    console.log('[cron] Changes detected — ISR cache invalidated')
  }

  results.forEach(r => {
    if (r.error) {
      console.error(`[cron] ${r.id}: ERROR — ${r.error}`)
    } else {
      console.log(`[cron] ${r.id}: ${r.count} items | checksum ${r.checksum} | changed=${r.changed}`)
    }
  })

  return NextResponse.json({
    ok: true,
    timestamp: started,
    anyChanged,
    anyError,
    suppliers: results,
  })
}
