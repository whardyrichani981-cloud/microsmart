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
  negocio: string       // Info general, horarios, ubicación
  precios: string       // Precios y servicios
  tecnico: string       // Conocimiento técnico y diagnósticos
  faq: string           // Preguntas frecuentes
  estilo: string        // Cómo hablar, tono, reglas de comunicación
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
  aiKnowledge: string           // legacy / campo libre adicional
  aiSections: AIKnowledgeSections
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

// ─── System prompt compartido ─────────────────────────────────────────────────
function buildSystemPrompt(config: TelegramConfig): string {
  const s = config.aiSections ?? { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' }

  const sections: string[] = []
  if (s.negocio?.trim())  sections.push(`## INFORMACIÓN DEL NEGOCIO\n${s.negocio.trim()}`)
  if (s.precios?.trim())  sections.push(`## PRECIOS Y SERVICIOS\n${s.precios.trim()}`)
  if (s.tecnico?.trim())  sections.push(`## CONOCIMIENTO TÉCNICO\n${s.tecnico.trim()}`)
  if (s.faq?.trim())      sections.push(`## PREGUNTAS FRECUENTES\n${s.faq.trim()}`)
  if (s.estilo?.trim())   sections.push(`## ESTILO DE COMUNICACIÓN\n${s.estilo.trim()}`)
  // Backward compat: campo libre legacy
  if (config.aiKnowledge?.trim()) sections.push(`## INFO ADICIONAL\n${config.aiKnowledge.trim()}`)

  const knowledge = sections.join('\n\n')

  return `Sos el asistente de atención al cliente de Microsmart, servicio técnico especializado en productos Apple ubicado en Argentina.
Respondés consultas de clientes de manera amable, directa y profesional, siempre en español con modismos argentinos (vos, te, acá, etc.).

${knowledge ? `${knowledge}\n` : ''}
REGLAS IMPORTANTES:
- Si no sabés el precio exacto, decí que lo confirmás a la brevedad, nunca inventes datos
- Respuestas cortas y útiles (2-4 líneas), salvo que el cliente pida más detalle
- No menciones que sos una IA a menos que te lo pregunten directamente
- Usá la información de arriba para responder con precisión`
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
    const systemPrompt = buildSystemPrompt(config)

    // Construir historial en formato Gemini
    const contents: { role: string; parts: { text: string }[] }[] = []
    for (const m of history) {
      const role = m.role === 'user' ? 'user' : 'model'
      contents.push({ role, parts: [{ text: m.text }] })
    }
    // Asegurarse que el último mensaje es del usuario
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: userText }] })
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
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
    const systemPrompt = buildSystemPrompt(config)

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
