import type { SupplierItem } from './types'
import { normalizeCategory, CATEGORY_ORDER, type AppleCategory } from './categories'

// ── Device detection ─────────────────────────────────────────────────────────
// Determines the Apple device a product belongs to, for sorting purposes.
type DeviceGroup = 'iphone' | 'ipad' | 'apple-watch' | 'mac' | 'otros'

const DEVICE_ORDER: DeviceGroup[] = ['iphone', 'ipad', 'apple-watch', 'mac', 'otros']

export function detectDevice(name: string): DeviceGroup {
  const n = name.toLowerCase()
  if (/iphone/.test(n)) return 'iphone'
  if (/ipad/.test(n)) return 'ipad'
  if (/apple.?watch|watch\s+s\d|watch\s+ultra|watch\s+se/.test(n)) return 'apple-watch'
  if (/macbook|imac|mac\s*mini|mac\s*pro|mac\s*studio|\bmac\b/.test(n)) return 'mac'
  return 'otros'
}

/**
 * Sort items by:
 *   1. Category order (modulos → baterias → camaras → …)
 *   2. Device group within each category (iPhone → iPad → Apple Watch → Mac → otros)
 *   3. Alphabetically within each device group
 * Applied after every parse so all lists are consistently ordered.
 */
export function sortByCategory(items: SupplierItem[]): SupplierItem[] {
  return [...items].sort((a, b) => {
    // 1. Category
    const ai = CATEGORY_ORDER.indexOf((a.category ?? 'otros') as AppleCategory)
    const bi = CATEGORY_ORDER.indexOf((b.category ?? 'otros') as AppleCategory)
    if (ai !== bi) return ai - bi
    // 2. Device
    const ad = DEVICE_ORDER.indexOf(detectDevice(a.name))
    const bd = DEVICE_ORDER.indexOf(detectDevice(b.name))
    if (ad !== bd) return ad - bd
    // 3. Alphabetical
    return a.name.localeCompare(b.name, 'es')
  })
}

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

// ─── Pineapple ───────────────────────────────────────────────────────────────
// Structure: single sheet "LISTA", NO header row.
//   Col A (0): product name OR category header (all-caps text, no price)
//   Col B (1): optional status flag (⬇ NEW etc.)
//   Col C (2): unit price in USD (numeric) — empty on category header rows
//   Col D (3): optional bulk promo text
// Category context is tracked by reading header rows (col C empty, col A non-empty).
export function parsePineapple(rows: Row[]): SupplierItem[] {
  const items: SupplierItem[] = []
  let currentCategory = 'otros'

  for (const row of rows) {
    const cells = row.map(clean)
    const nameRaw  = cells[0]?.trim() ?? ''
    const priceRaw = cells[2]?.trim() ?? ''

    if (!nameRaw) continue

    const price = parsePrice(priceRaw)

    // Category header row: has a name but no valid price
    if (isNaN(price) || price <= 0) {
      // Update category from the header text
      const cat = normalizeCategory(nameRaw)
      if (cat !== 'otros') currentCategory = cat
      else {
        // Use full text to map well-known Pineapple sections
        const n = nameRaw.toLowerCase()
        if (/pantalla|lcd|oled|incell|modulo|screen/i.test(n)) currentCategory = 'modulos'
        else if (/bater/i.test(n))                              currentCategory = 'baterias'
        else if (/camara|camera/i.test(n))                     currentCategory = 'camaras'
        else if (/flex|cable/i.test(n))                        currentCategory = 'flex'
        else if (/chasis|carcasa|housing/i.test(n))            currentCategory = 'chasis'
        else if (/vidrio|glass|cristal|tapa/i.test(n))         currentCategory = 'vidrios'
        else if (/herramienta|tool/i.test(n))                  currentCategory = 'herramientas'
        else if (/accesorio|accessory|baseus/i.test(n))        currentCategory = 'accesorios'
        else if (/integrado|conector|placa|ic\b/i.test(n))     currentCategory = 'circuitos'
        else if (/macbook|teclado|keyboard/i.test(n))          currentCategory = 'otros'
        // Keep currentCategory unchanged for unrecognised headers
      }
      continue
    }

    // Product row — determine category (try name first, fall back to section)
    const catFromName = normalizeCategory(nameRaw)
    const category = catFromName !== 'otros' ? catFromName : currentCategory

    items.push({ name: nameRaw, code: '', price, category })
  }

  return sortByCategory(items)
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
// Auto-detects product name, price, code and category columns by header keywords,
// with a fallback score-based detection.
// Supports dual-currency lists (USD + ARS): detects explicit currency columns.
// Output is always sorted by CATEGORY_ORDER, then alphabetically within each category.
const PROD_KW  = ['producto', 'descripcion', 'description', 'nombre', 'item', 'articulo', 'detalle', 'name', 'detail', 'concepto']
const PRICE_KW = ['precio', 'price', 'importe', 'valor', 'monto', 'costo', 'tarifa', 'pvp', 'unit price', 'precio unitario', 'p. unitario']
const CODE_KW  = ['codigo', 'code', 'cod', 'sku', 'referencia', 'ref', 'part']
const CAT_KW   = ['categoria', 'category', 'cat', 'seccion', 'section', 'grupo', 'group', 'rubro', 'family', 'familia']
// "modelo" = the actual product model/name (e.g. "iPhone 13 Pro Max")
const MODEL_KW = ['modelo', 'model', 'equipo', 'device']
// "tipo" = product sub-type to be combined with modelo (e.g. "Pantalla Incell AM")
const TIPO_KW  = ['tipo producto', 'tipo de producto', 'tipo', 'type', 'componente', 'component', 'pieza', 'parte']
// Currency-specific column keywords (checked before generic PRICE_KW)
const USD_KW   = ['precio usd', 'precio dolar', 'precio dólar', 'usd', 'dolar', 'dólar', 'dolares', 'dólares', 'u$s', 'us$', 'divisa']
const ARS_KW   = ['precio ars', 'precio pesos', 'ars', 'pesos', 'transferencia', 'efectivo', 'contado', 'nacional', '$ ars']
// New extended fields (template-provided columns)
const QUALITY_KW = ['calidad', 'quality', 'tipo calidad', 'especificacion', 'especificación', 'spec']
const BRAND_KW   = ['marca', 'brand', 'fabricante', 'manufacturer', 'proveedor marca']
const DESC_KW    = ['descripcion adicional', 'descripción adicional', 'notas', 'notes', 'detalle adicional', 'obs', 'observaciones', 'comentario']

export function parseGeneric(rows: Row[]): SupplierItem[] {
  if (rows.length < 2) return []

  // Find the header row: scan the first 30 rows and pick the one whose cells
  // best match known column keywords (handles files with info rows at the top).
  const ALL_KW_FLAT = [
    ...PROD_KW, ...PRICE_KW, ...CODE_KW, ...CAT_KW,
    ...MODEL_KW, ...TIPO_KW, ...USD_KW, ...ARS_KW,
  ]
  let headerIdx = 0
  let bestScore = -1
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const cells = rows[i].map(c => clean(c).toLowerCase())
    if (cells.filter(c => c.length > 0).length < 2) continue
    const score = cells.filter(c => ALL_KW_FLAT.some(kw => c.includes(kw))).length
    if (score > bestScore) { bestScore = score; headerIdx = i }
  }
  // Fallback: first row with ≥ 2 non-empty cells (if no keyword matched at all)
  if (bestScore === 0) {
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      if (rows[i].filter(c => clean(c).length > 0).length >= 2) { headerIdx = i; break }
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

  const codeIdx    = findCol(CODE_KW)
  const catIdx     = findCol(CAT_KW)
  const modeloIdx  = findCol(MODEL_KW)
  const prodIdx    = findCol(PROD_KW)
  const tipoIdx    = findCol(TIPO_KW)
  const qualityIdx = findCol(QUALITY_KW)
  const brandIdx   = findCol(BRAND_KW)
  const descIdx    = findCol(DESC_KW)

  // Primary name column: modelo takes priority, then generic PROD_KW
  let nameIdx = modeloIdx >= 0 ? modeloIdx : prodIdx

  // When BOTH producto and modelo columns exist, producto holds the quality/description
  // (e.g. "Pantalla Incell AM") and modelo holds the device (e.g. "IPHONE 13").
  // We combine them → "Pantalla Incell AM IPHONE 13".
  const prodDescIdx = (modeloIdx >= 0 && prodIdx >= 0) ? prodIdx : -1

  // Explicit currency detection takes priority over generic price column
  const usdIdx = findCol(USD_KW)
  const arsIdx = findCol(ARS_KW)
  // Generic price column — used only when no explicit currency column is found
  let genericPriceIdx = (usdIdx < 0 && arsIdx < 0) ? findCol(PRICE_KW) : -1

  // Score-based fallback for name / generic price
  const dominated = new Set([modeloIdx, prodIdx, tipoIdx, catIdx, codeIdx, usdIdx, arsIdx, genericPriceIdx].filter(i => i >= 0))
  if (genericPriceIdx < 0 || nameIdx < 0) {
    const sample = rows.slice(headerIdx + 1, headerIdx + 30)
    const priceScore = new Array(headers.length).fill(0)
    const textScore  = new Array(headers.length).fill(0)
    for (const r of sample) {
      for (let j = 0; j < r.length; j++) {
        const v = clean(r[j])
        const p = parsePrice(v)
        if (!isNaN(p) && p > 0) priceScore[j]++
        if (v.length > 8 && isNaN(Number(v))) textScore[j] += v.length
      }
    }
    if (genericPriceIdx < 0 && usdIdx < 0 && arsIdx < 0)
      genericPriceIdx = priceScore.indexOf(Math.max(...priceScore))
    if (nameIdx < 0) {
      // Exclude all already-assigned columns so the score-based fallback
      // doesn't accidentally pick a notes/conditions column
      const dominated2 = new Set([...dominated, genericPriceIdx].filter(i => i >= 0))
      const scores = textScore.map((s, i) => (dominated2.has(i) ? -1 : s))
      const best = Math.max(...scores)
      nameIdx = best > 0 ? scores.indexOf(best) : -1
    }
  }

  // Debug: log detected columns so issues are visible in server logs
  console.log('[parseGeneric] headerIdx:', headerIdx, 'headers:', headers)
  console.log('[parseGeneric] columns → name:', nameIdx, 'modelo:', modeloIdx, 'prod:', prodIdx, 'prodDesc:', prodDescIdx, 'tipo:', tipoIdx, 'cat:', catIdx, 'code:', codeIdx, 'usd:', usdIdx, 'ars:', arsIdx, 'price:', genericPriceIdx, 'quality:', qualityIdx, 'brand:', brandIdx, 'desc:', descIdx)

  const items: SupplierItem[] = []
  // Forward-fill state: many Excel lists use merged/grouped cells where the
  // "tipo" (or "categoria") value only appears in the first row of a group.
  // We carry it forward so every product row gets the correct type descriptor.
  let lastTipo = ''
  let lastCat  = ''

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells  = rows[i].map(clean)

    // ── Forward-fill tipo ────────────────────────────────────────────────────
    // If this row has a tipo value, update the running value.
    // Also handle "section header" rows: a row where tipo is present but
    // modelo/price are empty → just update lastTipo and skip.
    if (tipoIdx >= 0) {
      const tipoVal = cells[tipoIdx]?.trim() ?? ''
      if (tipoVal) lastTipo = tipoVal
    }
    // Forward-fill cat too (handles merged categoria cells)
    if (catIdx >= 0) {
      const catVal = cells[catIdx]?.trim() ?? ''
      if (catVal) lastCat = catVal
    }

    // ── Name resolution ───────────────────────────────────────────────────────
    // Priority (highest to lowest):
    //   1. tipo (forward-filled) + prodDesc (quality col) + modelo
    //   2. prodDesc (quality col) + modelo   ← Cokocell case
    //   3. tipo (forward-filled) + modelo
    //   4. modelo (or PROD_KW when no modelo col)
    let name: string
    const modelVal = nameIdx    >= 0 ? cells[nameIdx]?.trim()    ?? '' : ''
    const descVal  = prodDescIdx >= 0 ? cells[prodDescIdx]?.trim() ?? '' : ''
    const tipoVal  = tipoIdx >= 0 ? lastTipo : ''

    if (tipoVal && descVal && modelVal) {
      name = `${tipoVal} ${descVal} ${modelVal}`
    } else if (tipoVal && modelVal) {
      name = `${tipoVal} ${modelVal}`
    } else if (descVal && modelVal) {
      // producto + modelo (e.g. "Pantalla Incell AM IPHONE 13")
      name = `${descVal} ${modelVal}`
    } else {
      name = modelVal || descVal || tipoVal
    }

    const code = codeIdx >= 0 ? cells[codeIdx] : ''
    // Use forward-filled category (handles merged cells in categoria column)
    const rawCat = catIdx >= 0 ? (cells[catIdx]?.trim() || lastCat) : lastCat
    if (!name) continue

    // ── Price resolution ────────────────────────────────────────────────────
    let price: number
    let priceARS: number | undefined

    if (usdIdx >= 0 && arsIdx >= 0) {
      price = parsePrice(cells[usdIdx])
      const ars = parsePrice(cells[arsIdx])
      priceARS = !isNaN(ars) && ars > 0 ? ars : undefined
    } else if (usdIdx >= 0) {
      price = parsePrice(cells[usdIdx])
    } else if (arsIdx >= 0) {
      price = parsePrice(cells[arsIdx])
    } else {
      price = genericPriceIdx >= 0 ? parsePrice(cells[genericPriceIdx]) : NaN
    }

    if (isNaN(price) || price <= 0) continue

    // ── Category resolution ─────────────────────────────────────────────────
    // Try category column first, then forward-filled tipo, finally the name
    let category = rawCat ? normalizeCategory(rawCat) : 'otros'
    if (category === 'otros' && lastTipo) {
      category = normalizeCategory(lastTipo)
    }
    if (category === 'otros') category = normalizeCategory(name)

    const quality     = qualityIdx >= 0 ? (cells[qualityIdx]?.trim() || undefined) : undefined
    const brand       = brandIdx   >= 0 ? (cells[brandIdx]?.trim()   || undefined) : undefined
    const description = descIdx    >= 0 ? (cells[descIdx]?.trim()    || undefined) : undefined

    items.push({
      name, code, price,
      ...(priceARS     ? { priceARS }     : {}),
      ...(quality      ? { quality }      : {}),
      ...(brand        ? { brand }        : {}),
      ...(description  ? { description }  : {}),
      category,
    })
  }

  // Always return sorted by category order, then A-Z within each category
  return sortByCategory(items)
}
