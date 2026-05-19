import type { SupplierItem } from './types'
import { normalizeCategory } from './categories'

type Row = (string | number | boolean | null | undefined)[]

function clean(v: unknown): string {
  return String(v ?? '').replace(/^"|"$/g, '').trim()
}

function parsePrice(v: unknown): number {
  const s = clean(v)
    .replace(/u\$s?/gi, '')
    .replace(/\$/g, '')
    .replace(/[^\d.,-]/g, '')
    .trim()
  if (!s) return NaN
  // Handle Argentine/European number format (1.234,56 or 1,234.56)
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'))
    }
    return parseFloat(s.replace(/,/g, ''))
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'))
  return parseFloat(s)
}

// ─── BH Tech ────────────────────────────────────────────────────────────────
// All sections share the same column layout, with two variants:
//
// Layout A (row has "Ver Producto" link or empty col0):
//   col0: link | col1: SKU | col2: model | col3: description | col4: quality/brand | [col5: brand] | [col6: empty] | colN: price | colN+1: stock
//
// Layout B (row has SKU directly in col0, no link):
//   col0: SKU | col1: model | col2: description | col3: quality/brand | [col4: brand] | [col5: empty] | colN: price | colN+1: stock
//
// Module sections (Incell/OLED) have price at col7 (A) or col6 (B) → quality in col4/col3 is useful to append.
// Other sections (cameras, flex, batteries) have price at col5–col6 → description alone is the name.
export function parseBhTech(rows: Row[]): SupplierItem[] {
  const items: SupplierItem[] = []
  let category = ''

  for (const row of rows) {
    const cells = row.map(clean)
    const nonEmpty = cells.filter(c => c.length > 0)
    if (nonEmpty.length === 0) continue

    // Category header: all-caps text, no price, few non-empty cells
    if (nonEmpty.length <= 3 && !nonEmpty.some(c => /\$\s*\d/.test(c))) {
      const candidate = nonEmpty[0]
      if (candidate.length > 4 && candidate === candidate.toUpperCase() && /[A-Z]/.test(candidate)) {
        category = candidate
        continue
      }
    }

    // Find price searching RIGHT-TO-LEFT — avoids false positives like "$ 11"
    // that appear when a model number (11) is exported as "$ 11" by Google Sheets
    let priceIdx = -1
    let price = NaN
    for (let i = cells.length - 1; i >= 0; i--) {
      if (/\$\s*\d/.test(cells[i])) {
        const p = parsePrice(cells[i])
        if (!isNaN(p) && p > 0) {
          price = p
          priceIdx = i
          break
        }
      }
    }
    if (priceIdx === -1) continue

    // Detect layout by checking col0
    const hasLink = /^ver\s*producto$/i.test(cells[0]) || cells[0] === ''
    const skuCol  = hasLink ? 1 : 0
    const descCol = hasLink ? 3 : 2
    const qualCol = hasLink ? 4 : 3

    // SKU/code — accept numeric codes and codes with a single letter prefix (e.g. C107...)
    const skuVal = cells[skuCol] ?? ''
    const code = /^[A-Za-z]?\d{6,}$/.test(skuVal) ? skuVal : ''

    // Primary name: description column
    let desc = (cells[descCol] ?? '').trim()
    // If description looks like a bare price (e.g. "$ 11" for model 11), fall back to model col
    if (/^\$\s*[\d.]+$/.test(desc)) {
      desc = (cells[hasLink ? 2 : 1] ?? '').trim()
    }
    if (!desc) continue

    // Module rows have more columns → append quality type (Incell-AM, Soft Oled-X07, etc.)
    // to distinguish products of the same model. Other sections (cameras, flex, batteries) don't need it.
    const isModuleRow = (hasLink && priceIdx >= 7) || (!hasLink && priceIdx >= 6)
    let name = desc
    if (isModuleRow) {
      const quality = (cells[qualCol] ?? '').trim()
      // Only append if quality adds new information not already in the description
      if (quality && !desc.toLowerCase().includes(quality.toLowerCase().split(' ')[0])) {
        name = `${desc} - ${quality}`
      }
    }

    // Prepend the model/category header (e.g. "IPHONE 13") to the name so that
    // searching "iphone" or "iphone 13" finds parts in BH Tech whose descriptions
    // are just component names ("PANTALLA INCELL") without the model in them.
    if (category) {
      name = `${category} ${name}`
    }

    // Stock status
    const stockCell = (cells[priceIdx + 1] ?? '').toLowerCase()
    const stock = /sin\s*stock/.test(stockCell) ? 'Sin stock'
      : /ingresando/.test(stockCell) ? 'Ingresando'
      : 'En stock'

    const cat = normalizeCategory(category)
    items.push({ name, code, price, stock, category: cat === 'otros' ? normalizeCategory(name) : cat })
  }

  return items
}

// ─── Cparts ─────────────────────────────────────────────────────────────────
// Structure: multiple sections, each starting with a header row where
// col 0 = "CODIGO", col 1 = category name, col 2 = "STOCK", col 3 = "PRECIO"
// Product rows: col 0 = numeric code, col 1 = name, col 2 = stock qty, col 3 = "u$s X.XX"
export function parseCparts(rows: Row[]): SupplierItem[] {
  const items: SupplierItem[] = []
  let category = ''
  let codeIdx = -1, nameIdx = 1, stockIdx = 2, priceIdx = 3

  for (const row of rows) {
    const cells = row.map(clean)
    if (cells.every(c => !c)) continue

    const first = cells[0].toLowerCase()

    // Section header detection: first cell is "CODIGO" or "COD"
    if (first === 'codigo' || first === 'cod' || first === 'code') {
      category = cells[1] || category
      // Re-detect column positions from this header row
      const lower = cells.map(c => c.toLowerCase())
      const pi = lower.findIndex(c => c.includes('precio') || c.includes('price'))
      const si = lower.findIndex(c => c.includes('stock'))
      if (pi >= 0) priceIdx = pi
      if (si >= 0) stockIdx = si
      nameIdx = 1
      continue
    }

    // Skip rows without a price value
    const priceCell = cells[priceIdx] ?? ''
    if (!priceCell || !/\d/.test(priceCell)) continue

    const price = parsePrice(priceCell)
    if (isNaN(price) || price <= 0) continue

    const name = cells[nameIdx] ?? ''
    const code = cells[codeIdx] ?? ''
    const stockRaw = cells[stockIdx] ?? ''
    const stock = /sin\s*stock/i.test(stockRaw) ? 'Sin stock'
      : stockRaw && stockRaw !== '0' ? `Stock: ${stockRaw}`
      : 'En stock'

    if (!name) continue

    const cat = normalizeCategory(category)
    items.push({ name, code, price, stock, category: cat === 'otros' ? normalizeCategory(name) : cat })
  }

  return items
}

// ─── Gremio (local CSV, two-column layout) ───────────────────────────────────
// Structure: left side (col 0=name, col 1=transferencia, col 2=efectivo)
//            right side (col 4=name, col 5=transferencia, col 6=efectivo)
// Section headers: rows where col 0 or col 4 equals "REPARACION"
// Prices are in ARS. Skips rows with "consultar" as price.
export function parseGremio(rows: Row[]): SupplierItem[] {
  const items: SupplierItem[] = []

  const addItem = (name: string, priceCell: string) => {
    const cleaned = name.trim()
    if (!cleaned || /^reparacion$/i.test(cleaned)) return
    if (/transferencia|efectivo|efectivo\/usdt/i.test(cleaned)) return
    const priceStr = priceCell?.trim() ?? ''
    if (!priceStr || /consultar/i.test(priceStr)) return
    const price = parsePrice(priceStr)
    if (isNaN(price) || price <= 0) return
    items.push({ name: cleaned, code: '', price, category: normalizeCategory(cleaned) })
  }

  for (const row of rows) {
    const cells = row.map(clean)
    // Left side
    if (cells[0]) addItem(cells[0], cells[1])
    // Right side
    if (cells[4]) addItem(cells[4], cells[5])
  }

  return items
}

// ─── Generic Excel/CSV ───────────────────────────────────────────────────────
// Auto-detects product name and price columns by header keywords,
// with a fallback score-based detection.
const PROD_KW = ['producto', 'descripcion', 'description', 'nombre', 'item', 'articulo', 'detalle', 'name', 'detail', 'concepto']
const PRICE_KW = ['precio', 'price', 'importe', 'valor', 'monto', 'costo', 'tarifa', 'pvp', 'unit price', 'precio unitario', 'p. unitario']
const CODE_KW = ['codigo', 'code', 'cod', 'sku', 'referencia', 'ref', 'part']

export function parseGeneric(rows: Row[]): SupplierItem[] {
  if (rows.length < 2) return []

  // Find the first row with at least 2 non-empty cells (header row)
  let headerIdx = 0
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (rows[i].filter(c => clean(c).length > 0).length >= 2) {
      headerIdx = i
      break
    }
  }

  const headers = rows[headerIdx].map(c => clean(c).toLowerCase())
  const findCol = (kws: string[]) => {
    for (const kw of kws) {
      const idx = headers.findIndex(h => h.includes(kw))
      if (idx >= 0) return idx
    }
    return -1
  }

  let nameIdx = findCol(PROD_KW)
  let priceIdx = findCol(PRICE_KW)
  const codeIdx = findCol(CODE_KW)

  // Score-based fallback
  if (priceIdx < 0 || nameIdx < 0) {
    const sample = rows.slice(headerIdx + 1, headerIdx + 30)
    const priceScore = new Array(headers.length).fill(0)
    const textScore = new Array(headers.length).fill(0)
    for (const r of sample) {
      for (let j = 0; j < r.length; j++) {
        const v = clean(r[j])
        const p = parsePrice(v)
        if (!isNaN(p) && p > 0) priceScore[j]++
        if (v.length > 8 && isNaN(Number(v))) textScore[j] += v.length
      }
    }
    if (priceIdx < 0) priceIdx = priceScore.indexOf(Math.max(...priceScore))
    if (nameIdx < 0) {
      const scores = textScore.map((s, i) => (i === priceIdx ? -1 : s))
      nameIdx = scores.indexOf(Math.max(...scores))
    }
  }

  const items: SupplierItem[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i].map(clean)
    const name = nameIdx >= 0 ? cells[nameIdx] : ''
    const priceStr = priceIdx >= 0 ? cells[priceIdx] : ''
    const code = codeIdx >= 0 ? cells[codeIdx] : ''
    if (!name || !priceStr) continue
    const price = parsePrice(priceStr)
    if (isNaN(price) || price <= 0) continue
    items.push({ name, code, price, category: normalizeCategory(name) })
  }

  return items
}
