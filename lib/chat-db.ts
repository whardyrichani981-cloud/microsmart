// Server-only — never import from client components
import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'

const DATA_DIR = path.join(process.cwd(), 'data')

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function readArr<T>(key: string): Promise<T[]> {
  if (redis) {
    const data = await redis.get<string>(key)
    if (!data) return []
    return typeof data === 'string' ? JSON.parse(data) : (data as T[])
  }
  try {
    const filePath = path.join(DATA_DIR, `${key}.json`)
    if (!fs.existsSync(filePath)) return []
    let raw = fs.readFileSync(filePath, 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw) as T[]
  } catch { return [] }
}

async function writeArr<T>(key: string, data: T[]): Promise<void> {
  if (redis) { await redis.set(key, JSON.stringify(data)); return }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(data, null, 2))
}

async function readObj<T>(key: string, fallback: T): Promise<T> {
  if (redis) {
    const data = await redis.get<string>(key)
    if (!data) return fallback
    return typeof data === 'string' ? JSON.parse(data) : (data as T)
  }
  try {
    const filePath = path.join(DATA_DIR, `${key}.json`)
    if (!fs.existsSync(filePath)) return fallback
    let raw = fs.readFileSync(filePath, 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw) as T
  } catch { return fallback }
}

async function writeObj<T>(key: string, data: T): Promise<void> {
  if (redis) { await redis.set(key, JSON.stringify(data)); return }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(data, null, 2))
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChatSession {
  id: string
  visitorName: string
  createdAt: string
  lastMessageAt: string
  open: boolean
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'owner' | 'bot'
  text: string
  createdAt: string
  telegramMsgId?: number
  source?: 'ai' | 'autoresponder'
}

export interface AIKnowledgeSections {
  negocio: string
  precios: string
  tecnico: string
  faq: string
  estilo: string
}

export interface TelegramConfig {
  botToken: string
  chatId: string
  welcomeMessage: string
  offlineMessage: string
  autoResponder: AutoResponderRule[]
  // AI
  aiProvider: 'gemini' | 'claude'
  geminiApiKey: string
  anthropicApiKey: string
  aiEnabled: boolean
  aiKnowledge: string
  aiSections: AIKnowledgeSections
  // Listas de precios conectadas
  gremioListaId: string    // servicios/mano de obra (gremio.csv)
  clientesListaId: string  // repuestos/módulos (CLIENTES.xlsx)
  tipoCambio: number       // ARS por USD para convertir precios
}

export interface AutoResponderRule {
  id: string
  keywords: string   // comma-separated keywords
  response: string
  active: boolean
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: '',
  chatId: '',
  welcomeMessage: '¡Hola! 👋 ¿En qué podemos ayudarte?',
  offlineMessage: 'Gracias por tu mensaje. Te respondemos a la brevedad.',
  autoResponder: [],
  aiProvider: 'gemini',
  geminiApiKey: '',
  anthropicApiKey: '',
  aiEnabled: false,
  aiKnowledge: '',
  aiSections: { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' },
  gremioListaId: '',
  clientesListaId: '',
  tipoCambio: 0,
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export async function getSessions(): Promise<ChatSession[]> {
  return readArr<ChatSession>('chat-sessions')
}

export async function getOrCreateSession(id: string, visitorName?: string): Promise<ChatSession> {
  const sessions = await getSessions()
  const existing = sessions.find(s => s.id === id)
  if (existing) {
    if (visitorName && visitorName !== existing.visitorName) {
      existing.visitorName = visitorName
      await writeArr('chat-sessions', sessions)
    }
    return existing
  }
  const session: ChatSession = {
    id,
    visitorName: visitorName || 'Visitante',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    open: true,
  }
  sessions.push(session)
  await writeArr('chat-sessions', sessions)
  return session
}

export async function updateSession(id: string, updates: Partial<ChatSession>): Promise<void> {
  const sessions = await getSessions()
  const idx = sessions.findIndex(s => s.id === id)
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...updates }
    await writeArr('chat-sessions', sessions)
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function getMessages(sessionId?: string): Promise<ChatMessage[]> {
  const all = await readArr<ChatMessage>('chat-messages')
  if (!sessionId) return all
  return all.filter(m => m.sessionId === sessionId)
}

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
  const messages = await readArr<ChatMessage>('chat-messages')
  const newMsg: ChatMessage = { ...msg, id: uid(), createdAt: new Date().toISOString() }
  messages.push(newMsg)
  await writeArr('chat-messages', messages)
  await updateSession(msg.sessionId, { lastMessageAt: new Date().toISOString() })
  return newMsg
}

export async function updateMessageTelegramId(msgId: string, telegramMsgId: number): Promise<void> {
  const messages = await readArr<ChatMessage>('chat-messages')
  const idx = messages.findIndex(m => m.id === msgId)
  if (idx !== -1) {
    messages[idx].telegramMsgId = telegramMsgId
    await writeArr('chat-messages', messages)
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
export async function getTelegramConfig(): Promise<TelegramConfig> {
  return readObj<TelegramConfig>('chat-config', DEFAULT_CONFIG)
}

export async function saveTelegramConfig(config: TelegramConfig): Promise<void> {
  await writeObj('chat-config', config)
}

// ─── Telegram API ─────────────────────────────────────────────────────────────
export async function sendToTelegram(
  token: string, chatId: string, text: string
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json() as { ok: boolean; result?: { message_id: number } }
    return data.ok ? (data.result?.message_id ?? null) : null
  } catch { return null }
}

// ─── Telegram Polling ─────────────────────────────────────────────────────────
interface TgUpdate {
  update_id: number
  message?: { message_id: number; text?: string; reply_to_message?: { message_id: number } }
}

// Cooldown en memoria para no hacer polling más de 1 vez por segundo
let lastPollTime = 0

export async function pollTelegramUpdates(token: string): Promise<void> {
  const now = Date.now()
  if (now - lastPollTime < 1000) return
  lastPollTime = now

  const offsetData = await readObj<{ offset: number }>('chat-telegram-offset', { offset: 0 })
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offsetData.offset}&timeout=0&limit=100`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json() as { ok: boolean; result?: TgUpdate[] }
    if (!data.ok || !data.result?.length) return

    const updates = data.result
    const allMessages = await readArr<ChatMessage>('chat-messages')

    for (const update of updates) {
      if (!update.message?.text) continue
      const text = update.message.text
      if (text.startsWith('/')) continue

      const replyToId = update.message.reply_to_message?.message_id
      let sessionId: string | null = null

      if (replyToId) {
        const original = allMessages.find(m => m.telegramMsgId === replyToId)
        if (original) sessionId = original.sessionId
      }

      if (!sessionId) {
        const sessions = (await getSessions())
          .filter(s => s.open)
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        if (sessions.length > 0) sessionId = sessions[0].id
      }

      if (sessionId) {
        const alreadyStored = allMessages.some(
          m => m.telegramMsgId === update.message!.message_id && m.role === 'owner'
        )
        if (!alreadyStored) {
          await addMessage({ sessionId, role: 'owner', text, telegramMsgId: update.message.message_id })
        }
      }
    }

    await writeObj('chat-telegram-offset', { offset: updates[updates.length - 1].update_id + 1 })
  } catch { /* ignore network errors */ }
}

// ─── Búsqueda en lista de precios ────────────────────────────────────────────
interface PriceItem {
  name: string
  code?: string
  price: number
  category?: string
  // Campos extendidos para lista gremio
  precioTransferencia?: number
  precioEfectivo?: number
  currency?: 'ARS' | 'USD'
}

// Sinónimos: cada palabra se expande a sus equivalentes
const SYNONYMS: Record<string, string[]> = {
  'chasis':    ['carcasa', 'housing', 'chasis'],
  'chassis':   ['carcasa', 'housing', 'chasis'],
  'housing':   ['carcasa', 'housing', 'chasis'],
  'carcasa':   ['carcasa', 'housing', 'chasis'],
  'pantalla':  ['pantalla', 'modulo', 'módulo', 'lcd', 'display', 'oled', 'incell'],
  'modulo':    ['pantalla', 'modulo', 'módulo', 'lcd', 'display', 'oled', 'incell'],
  'módulo':    ['pantalla', 'modulo', 'módulo', 'lcd', 'display', 'oled', 'incell'],
  'lcd':       ['pantalla', 'modulo', 'módulo', 'lcd', 'display', 'oled', 'incell'],
  'display':   ['pantalla', 'modulo', 'módulo', 'lcd', 'display', 'oled', 'incell'],
  'bateria':   ['bateria', 'batería', 'battery'],
  'batería':   ['bateria', 'batería', 'battery'],
  'camara':    ['camara', 'cámara', 'camera'],
  'cámara':    ['camara', 'cámara', 'camera'],
  'conector':  ['conector', 'connector', 'puerto', 'carga'],
  'carga':     ['conector', 'connector', 'puerto', 'carga'],
  'tactil':    ['tactil', 'táctil', 'touch'],
  'touch':     ['tactil', 'táctil', 'touch'],
}

export async function searchPriceList(listId: string, query: string): Promise<PriceItem[]> {
  if (!listId || !query) return []
  try {
    const data = await readObj<PriceItem[]>(`lista-proveedor-${listId}`, [])
    const items = Array.isArray(data) ? data : []
    if (!items.length) return []

    const normalize = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')

    // Expandir palabras con sinónimos
    // Incluir palabras de ≥2 chars para capturar modelos como "13", "14", "xs", "se"
    const rawWords = normalize(query).split(/\s+/).filter(w => w.length >= 2)
    const expandedWords = rawWords.flatMap(w => SYNONYMS[w] ?? [w])
    const words = [...new Set(expandedWords)]
    if (!words.length) return []

    // Puntuar items
    const scored = items.map(item => {
      const haystack = normalize(item.name + ' ' + (item.category ?? ''))
      const score = words.filter(w => haystack.includes(w)).length
      return { item, score }
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)

    // Deduplicar por nombre+precio
    const seen = new Set<string>()
    const unique: PriceItem[] = []
    for (const { item } of scored) {
      const key = `${item.name}|${item.price}`
      if (!seen.has(key)) { seen.add(key); unique.push(item) }
      if (unique.length >= 12) break
    }
    return unique
  } catch { return [] }
}

function formatPriceResults(items: PriceItem[], tipoCambio?: number): string {
  if (!items.length) return ''
  return items.map(i => {
    // Si no tiene currency explícita, detectar por magnitud:
    // Repuestos Apple en USD son $5–$500; servicios ARS son $1.000–$200.000
    const currency = i.currency ?? (i.price < 1000 ? 'USD' : 'ARS')

    if (currency === 'USD') {
      const ef = i.precioEfectivo      ?? i.price
      const tr = i.precioTransferencia ?? i.price
      if (ef !== tr) {
        return `- ${i.name}: U$D ${ef} efectivo / U$D ${tr} transferencia`
      }
      // Precio único (no hay split efectivo/transferencia en la lista)
      return `- ${i.name}: U$D ${ef}`
    }
    // ARS con ambos precios
    if (i.precioTransferencia && i.precioEfectivo) {
      return `- ${i.name}: transferencia $${i.precioTransferencia.toLocaleString('es-AR')} / efectivo $${i.precioEfectivo.toLocaleString('es-AR')} ARS`
    }
    return `- ${i.name}: $${i.price.toLocaleString('es-AR')} ARS`
  }).join('\n')
}

// ─── System prompt compartido ─────────────────────────────────────────────────
function buildSystemPrompt(config: TelegramConfig, priceResults?: PriceItem[]): string {
  const s = config.aiSections ?? { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' }

  const sections: string[] = []
  if (s.negocio?.trim())  sections.push(`## INFORMACIÓN DEL NEGOCIO\n${s.negocio.trim()}`)
  if (s.precios?.trim())  sections.push(`## PRECIOS Y SERVICIOS\n${s.precios.trim()}`)
  if (s.tecnico?.trim())  sections.push(`## CONOCIMIENTO TÉCNICO\n${s.tecnico.trim()}`)
  if (s.faq?.trim())      sections.push(`## PREGUNTAS FRECUENTES\n${s.faq.trim()}`)
  if (s.estilo?.trim())   sections.push(`## ESTILO DE COMUNICACIÓN\n${s.estilo.trim()}`)
  if (config.aiKnowledge?.trim()) sections.push(`## INFO ADICIONAL\n${config.aiKnowledge.trim()}`)

  // Precios encontrados en las listas en tiempo real
  if (priceResults?.length) {
    const tc = config.tipoCambio ?? 0
    sections.push(
      `## PRECIOS DE LA LISTA (resultados para esta consulta)\n` +
      `${formatPriceResults(priceResults, tc)}\n` +
      `IMPORTANTE: Estos son los precios reales de la lista. USÁ EXACTAMENTE estos precios para responder.\n` +
      `- Precios en U$D: se cobran en dólares o en pesos al tipo de cambio del día\n` +
      `- Si ves "U$D X" sin split efectivo/transferencia, informá el precio y aclará que el pago en pesos se calcula al tipo de cambio vigente`
    )
  }

  const knowledge = sections.join('\n\n')

  return `Sos el asistente de atención al cliente de Microsmart, servicio técnico especializado en productos Apple ubicado en Argentina.
Respondés consultas de clientes de manera amable, directa y profesional, siempre en español con modismos argentinos (vos, te, acá, etc.).

${knowledge ? `${knowledge}\n` : ''}
REGLAS OBLIGATORIAS (seguí estas al pie de la letra):
1. PRECIOS: cuando la sección "PRECIOS DE LA LISTA" tiene datos, USÁ EXACTAMENTE esos precios. Nunca digas "consultanos" si ya tenés el precio en la lista.
   - Si el precio tiene split: "Efectivo: $X / Transferencia: $Y"
   - Si el precio es en USD sin split: "U$D X (en pesos al cambio del día)"
2. PANTALLAS/MÓDULOS: cuando pregunten por pantalla/lcd/módulo/display, mostrá TODAS las calidades que aparezcan en la lista (Incell, OLED, OLED Premium) con sus precios. Si la lista no tiene todas las calidades, mostrá solo las que están.
3. Si genuinamente NO hay precio en la lista para lo que preguntan, entonces decí "consultanos directamente para darte el precio exacto"
4. Respuestas cortas (3-5 líneas máximo para pantallas, 1-2 líneas para preguntas simples)
5. No digas que sos una IA`
}

// ─── Gemini AI (GRATIS) ───────────────────────────────────────────────────────
export async function callGeminiAI(
  sessionId: string,
  userText: string,
  apiKey: string,
  config: TelegramConfig,
): Promise<string | null> {
  try {
    const history = (await getMessages(sessionId)).slice(-20)
    // Buscar precios en ambas listas: servicios (gremio) + repuestos (clientes)
    const [gremioResults, clientesResults] = await Promise.all([
      config.gremioListaId   ? searchPriceList(config.gremioListaId,   userText) : Promise.resolve([]),
      config.clientesListaId ? searchPriceList(config.clientesListaId, userText) : Promise.resolve([]),
    ])
    const priceResults = [...gremioResults, ...clientesResults].slice(0, 15)
    const systemPrompt = buildSystemPrompt(config, priceResults)

    // Construir historial en formato Gemini (roles deben alternar: user → model → user…)
    const contents: { role: string; parts: { text: string }[] }[] = []
    for (const m of history) {
      const role = m.role === 'user' ? 'user' : 'model'
      // Omitir mensajes consecutivos del mismo rol (Gemini los rechaza)
      if (contents.length > 0 && contents[contents.length - 1].role === role) continue
      contents.push({ role, parts: [{ text: m.text }] })
    }
    // El último turno DEBE ser del usuario
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: userText }] })
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    )
    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message: string }
    }
    if (data.error) { console.error('Gemini error:', data.error.message); return null }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch (e) {
    console.error('Gemini AI error:', e)
    return null
  }
}

// ─── Claude AI ────────────────────────────────────────────────────────────────
export async function callClaudeAI(
  sessionId: string,
  userText: string,
  apiKey: string,
  config: TelegramConfig,
): Promise<string | null> {
  try {
    const client = new Anthropic({ apiKey })
    const history = (await getMessages(sessionId)).filter(m => m.text !== '👋').slice(-20)
    const [gremioResults, clientesResults] = await Promise.all([
      config.gremioListaId   ? searchPriceList(config.gremioListaId,   userText) : Promise.resolve([]),
      config.clientesListaId ? searchPriceList(config.clientesListaId, userText) : Promise.resolve([]),
    ])
    const priceResults = [...gremioResults, ...clientesResults].slice(0, 15)
    const systemPrompt = buildSystemPrompt(config, priceResults)

    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }))
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: userText })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const block = response.content[0]
    if (block.type === 'text') return block.text
    return null
  } catch (e) {
    console.error('Claude AI error:', e)
    return null
  }
}

// ─── Auto-responder ───────────────────────────────────────────────────────────
export async function checkAutoResponder(text: string): Promise<string | null> {
  const config = await getTelegramConfig()
  const lower = text.toLowerCase()
  for (const rule of config.autoResponder) {
    if (!rule.active) continue
    const keywords = rule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    if (keywords.some(k => lower.includes(k))) return rule.response
  }
  return null
}
