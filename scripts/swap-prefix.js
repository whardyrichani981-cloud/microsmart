const fs = require('fs')
const path = require('path')

const serviciosPath = path.join(__dirname, '../data/sistema-servicios.json')
const servicios = JSON.parse(fs.readFileSync(serviciosPath, 'utf8'))

// IDs que CONSERVAN "Reparacion de " (placa/face id/huella) = svc-csf-133 a svc-csf-163
const keepReparacion = new Set()
for (let i = 133; i <= 163; i++) {
  keepReparacion.add(`svc-csf-${String(i).padStart(3, '0')}`)
}

let changed = 0, kept = 0, skipped = 0

const updated = servicios.map(s => {
  if (s.tipo !== 'Cliente final') return s
  const match = s.id.match(/^svc-csf-(\d+)$/)
  if (!match || parseInt(match[1]) < 10) return s // no tocar los 9 originales

  if (keepReparacion.has(s.id)) {
    kept++
    return s // conservar "Reparacion de "
  }

  // Reemplazar "Reparacion de " por "Cambio de " (o agregar "Cambio de " si por alguna razón no tiene el prefijo)
  if (s.nombre.toLowerCase().startsWith('reparacion de ')) {
    changed++
    return { ...s, nombre: 'Cambio de ' + s.nombre.slice('reparacion de '.length) }
  }

  skipped++
  return s
})

fs.writeFileSync(serviciosPath, JSON.stringify(updated, null, 2), { encoding: 'utf8' })
console.log(`✅ ${changed} servicios: "Reparacion de" → "Cambio de"`)
console.log(`✅ ${kept} servicios conservan "Reparacion de" (placa/face id)`)
console.log(`ℹ  ${skipped} sin prefijo (sin cambios)`)

console.log('\nEjemplos cambiados (primeros 5):')
updated.filter(s => {
  const m = s.id.match(/^svc-csf-(\d+)$/)
  return s.tipo === 'Cliente final' && m && parseInt(m[1]) >= 10 && !keepReparacion.has(s.id) && s.nombre.startsWith('Cambio de ')
}).slice(0, 5).forEach(s => console.log(`  [${s.id}] ${s.nombre}`))

console.log('\nEjemplos conservados (primeros 3):')
updated.filter(s => keepReparacion.has(s.id)).slice(0, 3).forEach(s => console.log(`  [${s.id}] ${s.nombre}`))
