// Script para cargar lista gremio.csv a Redis con ambos precios (transferencia + efectivo)
import { Redis } from '@upstash/redis'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const __dir = dirname(fileURLToPath(import.meta.url))
const csvPath = join(__dir, '..', 'data', 'gremio.csv')

function stripCell(s) {
  return s.replace(/\\"/g, '').replace(/"/g, '').trim()
}

// Parsea precio y detecta moneda
// ARS: "$22,000.00" → { amount: 22000, currency: 'ARS' }
// USD: "$60" o "$66.00" → { amount: 60, currency: 'USD' }
function parsePrice(raw) {
  const s = raw.replace(/\\"/g, '').replace(/"/g, '').trim()
  if (!s || /consultar/i.test(s)) return null

  // Quitar símbolo $ y espacios
  const clean = s.replace(/\$/g, '').replace(/\s/g, '')
  if (!clean) return null

  // Si tiene coma como separador de miles (ej: 22,000.00 o 8,800.00)
  // → formato ARS: quitar comas, parsear
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(clean)) {
    const amount = parseFloat(clean.replace(/,/g, ''))
    return { amount, currency: amount >= 1000 ? 'ARS' : 'USD' }
  }

  // Número simple sin comas (ej: 60 o 66.00) → USD
  const amount = parseFloat(clean)
  if (!isNaN(amount) && amount > 0) {
    return { amount, currency: amount < 500 ? 'USD' : 'ARS' }
  }

  return null
}

function parseLine(line) {
  // Parser CSV respetando campos entre comillas (que pueden contener comas)
  const rawCells = line.split(',')
  const cells = []
  let i = 0
  while (i < rawCells.length) {
    let cell = rawCells[i]
    const startsQ = cell.startsWith('\\"') || cell.startsWith('"')
    const endsQ   = cell.endsWith('\\"')   || cell.endsWith('"')
    if (startsQ && !endsQ) {
      while (i + 1 < rawCells.length) {
        i++
        cell += ',' + rawCells[i]
        if (rawCells[i].endsWith('\\"') || rawCells[i].endsWith('"')) break
      }
    }
    cells.push(stripCell(cell))
    i++
  }
  return cells
}

const SKIP = /^(reparacion|transferencia|efectivo|efectivo\/usdt|garantias|forma de pago|consultas|microsmart|repuestos originales|repuestos ampsentrix|cambio de vidrio trasero \(tapa incluida\))$/i

function parseGremioCSV(csvText) {
  const items = []
  const lines = csvText.split('\n')

  for (const line of lines) {
    const cells = parseLine(line)

    const addItem = (name, priceCell1, priceCell2) => {
      const cleaned = name.replace(/[\r\n\t]/g, ' ').trim()
      if (!cleaned || cleaned.length < 5) return
      if (SKIP.test(cleaned)) return
      if (/^[@👉✅\s]/.test(cleaned)) return

      const p1 = parsePrice(priceCell1 ?? '')
      const p2 = parsePrice(priceCell2 ?? '')
      if (!p1) return

      const currency = p1.currency
      // p1 = primera columna de precio, p2 = segunda columna
      // En la lista izquierda: col1=transferencia, col2=efectivo
      // En la lista derecha USD: col1=efectivo/usdt, col2=transferencia (10% más)
      // Normalizamos: siempre guardamos precioTransferencia y precioEfectivo
      let precioTransferencia, precioEfectivo
      if (currency === 'USD') {
        // Columna 5 = efectivo/usdt, columna 6 = transferencia (mayor)
        const amounts = [p1.amount, p2?.amount].filter(Boolean).sort((a, b) => a - b)
        precioEfectivo     = amounts[0]
        precioTransferencia = amounts[1] ?? amounts[0]
      } else {
        precioTransferencia = p1.amount
        precioEfectivo     = p2?.amount ?? p1.amount
      }

      items.push({
        name: cleaned,
        price: precioTransferencia,
        precioTransferencia,
        precioEfectivo,
        currency,
      })
    }

    // Lado izquierdo: nombre=0, transferencia=1, efectivo=2
    if (cells[0]) addItem(cells[0], cells[1], cells[2])
    // Lado derecho: nombre=4, col5, col6
    if (cells[4]) addItem(cells[4], cells[5], cells[6])
  }

  return items
}

async function main() {
  const csv = readFileSync(csvPath, 'utf-8')
  const items = parseGremioCSV(csv)
  console.log('Items parseados:', items.length)

  if (items.length < 5) {
    console.log('ERROR: muy pocos items. Muestra:', JSON.stringify(items.slice(0, 5), null, 2))
    return
  }

  // Muestra por moneda
  const ars = items.filter(i => i.currency === 'ARS')
  const usd = items.filter(i => i.currency === 'USD')
  console.log(`ARS: ${ars.length} items, USD: ${usd.length} items`)
  console.log('Ejemplo ARS:', JSON.stringify(ars[0], null, 2))
  console.log('Ejemplo USD:', JSON.stringify(usd[0], null, 2))

  const listId  = 'gremio-microsmart'
  const listKey = 'lista-proveedor-' + listId
  await redis.set(listKey, JSON.stringify(items))
  console.log('✅ Lista guardada:', listKey)

  // Actualizar listas-meta
  const metaRaw = await redis.get('listas-meta')
  const meta    = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : (metaRaw ?? {})
  meta[listId]  = { filename: 'Lista Gremio Microsmart', items: items.length, updatedAt: new Date().toISOString() }
  await redis.set('listas-meta', JSON.stringify(meta))

  // Actualizar chat-config
  const configRaw   = await redis.get('chat-config')
  const chatConfig  = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw
  chatConfig.gremioListaId = listId
  await redis.set('chat-config', JSON.stringify(chatConfig))
  console.log('✅ chat-config actualizado: gremioListaId =', listId)
}

main().catch(console.error)
