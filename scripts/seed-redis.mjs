/**
 * Migración de datos locales → Upstash Redis
 * Ejecutar: node scripts/seed-redis.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.join(__dirname, '..', 'data')

// ── Credenciales Upstash (leer del .env.local) ─────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const raw = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const UPSTASH_URL   = env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Faltan UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN en .env.local')
  process.exit(1)
}

// ── Helper: SET en Redis ────────────────────────────────────────────────────
async function redisSet(key, value) {
  const body = JSON.stringify(value) // guardar como string (igual que el SDK)
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body), // el SDK serializa dos veces
  })
  if (!res.ok) throw new Error(`Redis SET ${key} → ${res.status}`)
  return res.json()
}

// ── Helper: leer JSON local ────────────────────────────────────────────────
function readLocal(filename, fallback = null) {
  const p = path.join(DATA_DIR, filename)
  if (!fs.existsSync(p)) return fallback
  try {
    let raw = fs.readFileSync(p, 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw)
  } catch {
    console.warn(`  ⚠️  No se pudo parsear ${filename}`)
    return fallback
  }
}

// ── Mapeo archivo → clave Redis ────────────────────────────────────────────
const ARRAY_KEYS = [
  ['sistema-tipo-cambio.json',       'tipo-cambio'],
  ['sistema-turnos.json',            'turnos'],
  ['sistema-ventas-csf.json',        'ventas-csf'],
  ['sistema-ventas-gremio.json',     'ventas-gremio'],
  ['sistema-gastos.json',            'gastos'],
  ['sistema-comisiones.json',        'comisiones'],
  ['sistema-stock.json',             'stock'],
  ['sistema-ordenes.json',           'ordenes'],
  ['sistema-servicios.json',         'servicios'],
  ['sistema-clientes-personas.json', 'clientes-personas'],
  ['sistema-clientes.json',          'clientes'],
  ['sistema-proveedores.json',       'proveedores'],
  ['sistema-equipos.json',           'equipos'],
  ['sistema-proveedores-equipos.json','proveedores-equipos'],
  ['sistema-compras-clientes.json',  'compras-clientes'],
  ['sistema-ventas-caja.json',       'ventas-caja'],
  ['sistema-caja-diaria.json',       'caja-diaria'],
  ['sistema-presupuestos.json',      'presupuestos'],
  ['sistema-cuenta-corriente.json',  'cuenta-corriente'],
  ['sistema-stock-movimientos.json', 'stock-movimientos'],
  ['sistema-sesiones-caja.json',     'sesiones-caja'],
  ['sistema-mp-cuentas.json',        'mp-cuentas'],
]

const SINGLE_KEYS = [
  ['sistema-listas-meta.json',       'listas-meta',              {}],
  ['sistema-modulos.json',           'modulos',                  {}],
  ['sistema-terminos.json',          'terminos',                 ''],
  ['sistema-garantia-retiro.json',   'garantia-retiro',          ''],
]

// ── Migrar ─────────────────────────────────────────────────────────────────
async function migrate() {
  console.log(`\n🚀 Migrando datos locales → Upstash Redis`)
  console.log(`   URL: ${UPSTASH_URL}\n`)

  let ok = 0
  let skip = 0

  // Arrays
  for (const [file, key] of ARRAY_KEYS) {
    const data = readLocal(file, [])
    if (!Array.isArray(data)) { console.log(`  ⚠️  ${file} no es un array, omitido`); skip++; continue }
    process.stdout.write(`  ✓ ${key} (${data.length} items)... `)
    await redisSet(key, data)
    console.log('OK')
    ok++
  }

  // Singles (objects / strings)
  for (const [file, key, fallback] of SINGLE_KEYS) {
    const data = readLocal(file, fallback)
    process.stdout.write(`  ✓ ${key}... `)
    await redisSet(key, data)
    console.log('OK')
    ok++
  }

  // Listas de precios individuales (lista-proveedor-*.json → Redis key "lista-proveedor-{id}")
  const listaFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('lista-proveedor-') && f.endsWith('.json'))
  for (const file of listaFiles) {
    const id = file.replace('lista-proveedor-', '').replace('.json', '')
    const key = `lista-proveedor-${id}`
    const data = readLocal(file, [])
    process.stdout.write(`  ✓ ${key} (${Array.isArray(data) ? data.length : '?'} items)... `)
    await redisSet(key, data)
    console.log('OK')
    ok++
  }

  // Sistema usuarios (leído por usuarios-db.ts desde filesystem, pero también conviene tenerlo)
  const usuarios = readLocal('sistema-usuarios.json', [])
  if (usuarios.length > 0) {
    process.stdout.write(`  ✓ usuarios (${usuarios.length} users)... `)
    await redisSet('usuarios', usuarios)
    console.log('OK')
    ok++
  }

  console.log(`\n✅ Migración completada: ${ok} claves subidas, ${skip} omitidas.\n`)
}

migrate().catch(e => { console.error('❌ Error:', e); process.exit(1) })
