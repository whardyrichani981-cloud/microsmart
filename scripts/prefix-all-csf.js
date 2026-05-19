const fs = require('fs')
const path = require('path')

const serviciosPath = path.join(__dirname, '../data/sistema-servicios.json')
const servicios = JSON.parse(fs.readFileSync(serviciosPath, 'utf8'))

let count = 0
const updated = servicios.map(s => {
  // Solo aplica a servicios Cliente final con ID svc-csf-010 en adelante
  // (svc-csf-001 a svc-csf-009 son Limpieza/Software/Mac — no necesitan prefijo)
  if (s.tipo !== 'Cliente final') return s
  const match = s.id.match(/^svc-csf-(\d+)$/)
  if (!match) return s
  const num = parseInt(match[1])
  if (num < 10) return s // conservar los 9 originales
  // Evitar doble prefijo
  if (s.nombre.toLowerCase().startsWith('reparacion de ')) return s
  count++
  return { ...s, nombre: 'Reparacion de ' + s.nombre }
})

fs.writeFileSync(serviciosPath, JSON.stringify(updated, null, 2), { encoding: 'utf8' })
console.log(`✅ ${count} servicios actualizados`)

// Mostrar primeros y últimos ejemplos
const affected = updated.filter(s => {
  const m = s.id.match(/^svc-csf-(\d+)$/)
  return s.tipo === 'Cliente final' && m && parseInt(m[1]) >= 10
})
console.log('\nPrimeros 5:')
affected.slice(0, 5).forEach(s => console.log(`  [${s.id}] ${s.nombre}`))
console.log('\nÚltimos 5:')
affected.slice(-5).forEach(s => console.log(`  [${s.id}] ${s.nombre}`))
