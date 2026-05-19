const fs = require('fs')
const path = require('path')

const stockPath = path.join(__dirname, '../data/sistema-stock.json')
const serviciosPath = path.join(__dirname, '../data/sistema-servicios.json')

const stock = JSON.parse(fs.readFileSync(stockPath, 'utf8'))
const servicios = JSON.parse(fs.readFileSync(serviciosPath, 'utf8'))

// Remove "Cambio de " and "Reparacion/Reparación de " (case-insensitive) from a string
function cleanName(name) {
  return name
    .replace(/^cambio\s+de\s+/i, '')
    .replace(/^reparaci[oó]n\s+de\s+/i, '')
    .replace(/^reparacion\s+de\s+/i, '')
    .trim()
}

// --- 1. Create "Cliente final" services from stock items ---
// Existing CSF IDs: svc-csf-001 to svc-csf-009 → next starts at 010
let csfCounter = 10

const newServices = stock.map(item => {
  const id = `svc-csf-${String(csfCounter++).padStart(3, '0')}`
  return {
    id,
    tipo: 'Cliente final',
    nombre: cleanName(item.repuesto),
    descripcion: '',
    precio: item.costoUnitario,
    categoria: item.categoria,
    activo: true,
    createdAt: '2026-05-18T12:00:00.000Z',
  }
})

const updatedServicios = [...servicios, ...newServices]

// --- 2. Clean repuesto names in stock ---
const updatedStock = stock.map(item => ({
  ...item,
  repuesto: cleanName(item.repuesto),
}))

// --- Write files (no BOM) ---
fs.writeFileSync(serviciosPath, JSON.stringify(updatedServicios, null, 2), { encoding: 'utf8' })
fs.writeFileSync(stockPath, JSON.stringify(updatedStock, null, 2), { encoding: 'utf8' })

console.log(`✅ Creados ${newServices.length} servicios Cliente final (svc-csf-010 a svc-csf-${String(csfCounter - 1).padStart(3, '0')})`)
console.log(`✅ Stock: ${updatedStock.length} items con nombres limpios`)

// Show a few examples
console.log('\nEjemplos de nombres limpios en stock:')
updatedStock.slice(0, 5).forEach(s => console.log(`  "${s.repuesto}"`))

console.log('\nEjemplos de nuevos servicios CSF:')
newServices.slice(0, 5).forEach(s => console.log(`  [${s.id}] "${s.nombre}" (${s.categoria}) - ${s.precio}`))
