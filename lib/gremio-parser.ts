// ── Repuestos Originales ──────────────────────────────────────────────────────
export interface OriginalItem {
  name: string
  efectivo: number | null      // EFECTIVO/USDT col — ARS or USD depending on product
  transferencia: number | null // TRANSFERENCIA col — same currency as efectivo
  currency: 'ARS' | 'USD'
  estado: string
  notas: string
}

// ── Repuestos Ampsentrix ──────────────────────────────────────────────────────
export interface AmpsentrixItem {
  name: string
  usd: number | null
  efectivoARS: number | null
  transferenciaARS: number | null
  estado: string
}

export interface GremioItem {
  name: string
  transferencia: number | null  // null = consultar
  efectivo: number | null
}

export interface GremioSection {
  title: string
  items: GremioItem[]
}

export interface GremioData {
  left: GremioSection[]
  right: GremioSection[]
}

type Row = (string | number | boolean | null | undefined)[]

function clean(v: unknown): string {
  return String(v ?? '').replace(/^"|"$/g, '').trim()
}

function parseARS(v: string): number | null {
  if (!v || /consultar/i.test(v)) return null
  // CSV uses US format: $22,000.00 — comma is thousands separator, dot is decimal
  const s = v.replace(/\$/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) || n <= 0 ? null : n
}

function parseUSD(v: string): number | null {
  if (!v || /consultar/i.test(v)) return null
  const s = v.replace(/\$/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) || n <= 0 ? null : n
}

const LEFT_NAMES = ['Mano de obra y reparaciones', 'Reparación de placa y componentes']

export function parseGremioFull(rows: Row[]): GremioData {
  const left: GremioSection[] = []
  const right: GremioSection[] = []

  let curLeft: GremioSection | null = null
  let curRight: GremioSection | null = null
  let leftCount = 0
  let rightIsUSD = false

  for (const row of rows) {
    const c = row.map(clean)
    const [c0, c1, c2, , c4, c5, c6] = c

    // ── Left section header: col0 = "REPARACION", col1 = "TRANSFERENCIA..."
    if (/^reparacion$/i.test(c0) && /transfer/i.test(c1)) {
      curLeft = { title: LEFT_NAMES[leftCount] ?? 'Reparaciones', items: [] }
      left.push(curLeft)
      leftCount++
    }

    // ── Right section header detection
    if (c4 && /tapa incluida/i.test(c4)) {
      rightIsUSD = false
      curRight = { title: 'Cambio de vidrio trasero', items: [] }
      right.push(curRight)
      continue
    }
    if (/^reparacion$/i.test(c4) && c5) {
      rightIsUSD = /usdt|usd/i.test(c5) || (!(/transfer/i.test(c5)) && /efectivo/i.test(c5))
      curRight = { title: rightIsUSD ? 'Cambio de glass (USD)' : 'Trasplantes', items: [] }
      right.push(curRight)
      continue
    }

    // ── Left data row
    if (curLeft && c0 && !/^reparacion$/i.test(c0) && !/transfer/i.test(c0) && !/efectivo/i.test(c0)) {
      const consultar = /consultar/i.test(c1)
      const transferencia = consultar ? null : parseARS(c1)
      const efectivo = consultar ? null : parseARS(c2)
      if (consultar || transferencia !== null || efectivo !== null) {
        curLeft.items.push({ name: c0, transferencia, efectivo })
      }
    }

    // ── Right data row
    if (curRight && c4 && !/^reparacion$/i.test(c4) && !/tapa incluida/i.test(c4) && !/transfer/i.test(c4) && !/efectivo/i.test(c4)) {
      const parser = rightIsUSD ? parseUSD : parseARS
      // USD header order is EFECTIVO/USDT | TRANSFERENCIA (swapped vs ARS sections)
      const transferencia = rightIsUSD ? parser(c6) : parser(c5)
      const efectivo      = rightIsUSD ? parser(c5) : parser(c6)
      if (transferencia !== null || efectivo !== null) {
        curRight.items.push({ name: c4, transferencia, efectivo })
      }
    }
  }

  return { left, right }
}

// ── Parser: REPUESTOS ORIGINALES ─────────────────────────────────────────────
export function parseOriginales(rows: Row[]): OriginalItem[] {
  const items: OriginalItem[] = []
  let headerFound = false

  for (const row of rows) {
    const c = row.map(clean)
    if (!headerFound) {
      if (/^producto$/i.test(c[0])) { headerFound = true }
      continue
    }
    const name = c[0]?.trim()
    if (!name) continue
    const raw1 = c[1]
    const raw2 = c[2]
    const estado = c[3]?.trim() || ''
    const notas = c[4]?.trim() || ''
    const n1 = parseFloat(raw1.replace(/\$/g, '').replace(/,/g, ''))
    const n2 = parseFloat(raw2.replace(/\$/g, '').replace(/,/g, ''))
    // Values > 500 are ARS (e.g. 160000), ≤ 500 are USD (e.g. 15)
    const currency: 'ARS' | 'USD' = (!isNaN(n1) && n1 > 500) ? 'ARS' : 'USD'
    items.push({
      name,
      efectivo: isNaN(n1) || n1 <= 0 ? null : n1,
      transferencia: isNaN(n2) || n2 <= 0 ? null : n2,
      currency,
      estado,
      notas,
    })
  }
  return items
}

// ── Parser: REPUESTOS AMPSENTRIX ──────────────────────────────────────────────
export function parseAmpsentrix(rows: Row[]): AmpsentrixItem[] {
  const items: AmpsentrixItem[] = []
  let headerFound = false

  for (const row of rows) {
    const c = row.map(clean)
    if (!headerFound) {
      if (/^producto$/i.test(c[0])) { headerFound = true }
      continue
    }
    const name = c[0]?.trim()
    if (!name) continue
    const parseN = (v: string) => {
      const n = parseFloat(v.replace(/\$/g, '').replace(/,/g, ''))
      return isNaN(n) || n <= 0 ? null : n
    }
    items.push({
      name,
      usd: parseN(c[1]),
      efectivoARS: parseN(c[2]),
      transferenciaARS: parseN(c[3]),
      estado: c[4]?.trim() || '',
    })
  }
  return items
}
