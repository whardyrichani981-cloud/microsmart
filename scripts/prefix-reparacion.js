const fs = require('fs')
const path = require('path')

const serviciosPath = path.join(__dirname, '../data/sistema-servicios.json')
const servicios = JSON.parse(fs.readFileSync(serviciosPath, 'utf8'))

// IDs svc-csf-133 a svc-csf-163 (todos empiezan con "placa")
const idsToUpdate = new Set()
for (let i = 133; i <= 163; i++) {
  idsToUpdate.add(`svc-csf-${String(i).padStart(3, '0')}`)
}

let count = 0
const updated = servicios.map(s => {
  if (idsToUpdate.has(s.id)) {
    count++
    return { ...s, nombre: 'Reparacion de ' + s.nombre }
  }
  return s
})

fs.writeFileSync(serviciosPath, JSON.stringify(updated, null, 2), { encoding: 'utf8' })
console.log(`✅ ${count} servicios actualizados con prefijo "Reparacion de "`)
updated.filter(s => idsToUpdate.has(s.id)).forEach(s => console.log(`  [${s.id}] ${s.nombre}`))
