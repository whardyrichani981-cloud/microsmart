import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJson<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename)
  try {
    if (!fs.existsSync(filePath)) return defaultValue
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch { return defaultValue }
}

function writeJson<T>(filename: string, data: T): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
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

export interface TelegramConfig {
  botToken: string
  chatId: string
  welcomeMessage: string
  offlineMessage: string
  autoResponder: AutoResponderRule[]
  // AI
  anthropicApiKey: string
  aiEnabled: boolean
  aiKnowledge: string
}

export interface AutoResponderRule {
  id: string
  keywords: string   // comma-separated keywords
  response: string
  active: boolean
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export function getSessions(): ChatSession[] {
  return readJson<ChatSession[]>('chat-sessions.json', [])
}

export function getOrCreateSession(id: string, visitorName?: string): ChatSession {
  const sessions = getSessions()
  const existing = sessions.find(s => s.id === id)
  if (existing) {
    if (visitorName && visitorName !== existing.visitorName) {
      existing.visitorName = visitorName
      writeJson('chat-sessions.json', sessions)
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
  writeJson('chat-sessions.json', sessions)
  return session
}

export function updateSession(id: string, updates: Partial<ChatSession>) {
  const sessions = getSessions()
  const idx = sessions.findIndex(s => s.id === id)
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...updates }
    writeJson('chat-sessions.json', sessions)
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export function getMessages(sessionId?: string): ChatMessage[] {
  const all = readJson<ChatMessage[]>('chat-messages.json', [])
  if (!sessionId) return all
  return all.filter(m => m.sessionId === sessionId)
}

export function addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
  const messages = readJson<ChatMessage[]>('chat-messages.json', [])
  const newMsg: ChatMessage = { ...msg, id: uid(), createdAt: new Date().toISOString() }
  messages.push(newMsg)
  writeJson('chat-messages.json', messages)
  updateSession(msg.sessionId, { lastMessageAt: new Date().toISOString() })
  return newMsg
}

export function updateMessageTelegramId(msgId: string, telegramMsgId: number) {
  const messages = readJson<ChatMessage[]>('chat-messages.json', [])
  const idx = messages.findIndex(m => m.id === msgId)
  if (idx !== -1) { messages[idx].telegramMsgId = telegramMsgId; writeJson('chat-messages.json', messages) }
}

// ─── Config ───────────────────────────────────────────────────────────────────
export function getTelegramConfig(): TelegramConfig {
  return readJson<TelegramConfig>('chat-config.json', {
    botToken: '',
    chatId: '',
    welcomeMessage: '¡Hola! 👋 ¿En qué podemos ayudarte?',
    offlineMessage: 'Gracias por tu mensaje. Te respondemos a la brevedad.',
    autoResponder: [],
    anthropicApiKey: '',
    aiEnabled: false,
    aiKnowledge: '',
  })
}

export function saveTelegramConfig(config: TelegramConfig) {
  writeJson('chat-config.json', config)
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

// Cooldown: no hacer polling más de 1 vez por segundo
let lastPollTime = 0

export async function pollTelegramUpdates(token: string): Promise<void> {
  const now = Date.now()
  if (now - lastPollTime < 1000) return
  lastPollTime = now

  const offsetData = readJson<{ offset: number }>('chat-telegram-offset.json', { offset: 0 })
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offsetData.offset}&timeout=0&limit=100`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json() as { ok: boolean; result?: TgUpdate[] }
    if (!data.ok || !data.result?.length) return

    const updates = data.result
    const allMessages = readJson<ChatMessage[]>('chat-messages.json', [])

    for (const update of updates) {
      if (!update.message?.text) continue
      const text = update.message.text
      if (text.startsWith('/')) continue  // Ignore bot commands

      const replyToId = update.message.reply_to_message?.message_id
      let sessionId: string | null = null

      if (replyToId) {
        const original = allMessages.find(m => m.telegramMsgId === replyToId)
        if (original) sessionId = original.sessionId
      }

      if (!sessionId) {
        // Send to most recent open session
        const sessions = getSessions()
          .filter(s => s.open)
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        if (sessions.length > 0) sessionId = sessions[0].id
      }

      if (sessionId) {
        // Avoid duplicates: check if this telegram message was already processed
        const alreadyStored = allMessages.some(
          m => m.telegramMsgId === update.message!.message_id && m.role === 'owner'
        )
        if (!alreadyStored) {
          addMessage({ sessionId, role: 'owner', text, telegramMsgId: update.message.message_id })
        }
      }
    }

    writeJson('chat-telegram-offset.json', { offset: updates[updates.length - 1].update_id + 1 })
  } catch { /* ignore network errors */ }
}

// ─── Claude AI ────────────────────────────────────────────────────────────────
export async function callClaudeAI(
  sessionId: string,
  userText: string,
  apiKey: string,
  knowledge: string,
): Promise<string | null> {
  try {
    const client = new Anthropic({ apiKey })

    // Build conversation history (last 20 messages for context)
    const history = getMessages(sessionId)
      .filter(m => m.text !== '👋')
      .slice(-20)

    const systemPrompt = `Sos el asistente virtual de Microsmart, un servicio técnico especializado en productos Apple (iPhone, iPad, Apple Watch, Mac, etc.) ubicado en Argentina.
Respondés consultas de clientes de manera amable, directa y profesional, siempre en español con modismos argentinos naturales (vos, te, acá, etc.).

${knowledge ? `INFORMACIÓN DEL NEGOCIO Y CÓMO RESPONDER:\n${knowledge}\n` : ''}

REGLAS IMPORTANTES:
- Si no sabés el precio exacto o un detalle específico, decí que un técnico te va a confirmar a la brevedad, no inventes datos
- Mantené respuestas cortas y útiles (máximo 3-4 líneas salvo que el cliente pida más detalle)
- Si el cliente manda saludos o emojis vacíos como 👋, respondé con un saludo amigable preguntando en qué podés ayudar
- No menciones que sos una IA a menos que te lo pregunten directamente`

    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }))

    // Ensure last message is from user (the current one)
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
export function checkAutoResponder(text: string): string | null {
  const config = getTelegramConfig()
  const lower = text.toLowerCase()
  for (const rule of config.autoResponder) {
    if (!rule.active) continue
    const keywords = rule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    if (keywords.some(k => lower.includes(k))) return rule.response
  }
  return null
}
