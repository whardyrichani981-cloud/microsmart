// Migra la config del chat (Telegram, sesiones, mensajes) a Redis
import { Redis } from '@upstash/redis'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = join(__dirname, '..', 'data')
const ENV_FILE   = join(__dirname, '..', '.env.local')

// Leer .env.local
const env = readFileSync(ENV_FILE, 'utf-8')
function parseEnv(raw) {
  const env = {}
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
  }
  return env
}
const envVars = parseEnv(env)
const getEnv = (key) => envVars[key] ?? ''

const redis = new Redis({
  url:   getEnv('UPSTASH_REDIS_REST_URL'),
  token: getEnv('UPSTASH_REDIS_REST_TOKEN'),
})

function readJson(filename, fallback) {
  const fp = join(DATA_DIR, filename)
  if (!existsSync(fp)) return fallback
  try { return JSON.parse(readFileSync(fp, 'utf-8')) } catch { return fallback }
}

const keys = [
  { file: 'chat-config.json',          key: 'chat-config' },
  { file: 'chat-sessions.json',        key: 'chat-sessions' },
  { file: 'chat-messages.json',        key: 'chat-messages' },
  { file: 'chat-telegram-offset.json', key: 'chat-telegram-offset' },
]

for (const { file, key } of keys) {
  const data = readJson(file, null)
  if (data === null) { console.log(`⏭  ${key} — no existe localmente, saltando`); continue }
  await redis.set(key, JSON.stringify(data))
  const size = JSON.stringify(data).length
  console.log(`✅ ${key} → Redis (${size} bytes)`)
}

console.log('\n🎉 Migración del chat completada.')
