import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateSession, addMessage, getMessages,
  getTelegramConfig, sendToTelegram, updateMessageTelegramId,
  pollTelegramUpdates, checkAutoResponder, callClaudeAI,
} from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

// GET /api/chat/messages?session_id=xxx
// Polls Telegram for new replies, then returns messages for the session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id requerido' }, { status: 400 })

  const config = getTelegramConfig()
  if (config.botToken) {
    await pollTelegramUpdates(config.botToken)
  }

  const messages = getMessages(sessionId)
  return NextResponse.json(messages)
}

// POST /api/chat/messages — send a message (from widget or admin)
export async function POST(req: NextRequest) {
  try {
    const { sessionId, visitorName, text, role } = await req.json() as {
      sessionId: string; visitorName?: string; text: string; role?: 'user' | 'owner'
    }
    if (!sessionId || !text?.trim()) {
      return NextResponse.json({ error: 'sessionId y text son requeridos' }, { status: 400 })
    }

    const session = getOrCreateSession(sessionId, visitorName)
    const msgRole = role ?? 'user'

    const msg = addMessage({ sessionId, role: msgRole, text: text.trim() })

    const config = getTelegramConfig()

    if (msgRole === 'user') {
      // Forward to Telegram
      if (config.botToken && config.chatId) {
        const tgText =
          `💬 <b>${session.visitorName}</b>\n` +
          `${text.trim()}\n\n` +
          `<i>🔑 Sesión: ${sessionId.slice(0, 8)}…</i>\n` +
          `<i>Respondé a este mensaje para que llegue al chat</i>`
        const tgMsgId = await sendToTelegram(config.botToken, config.chatId, tgText)
        if (tgMsgId) updateMessageTelegramId(msg.id, tgMsgId)
      }

      // Check auto-responder first (keyword rules, highest priority)
      const autoReply = checkAutoResponder(text)
      if (autoReply) {
        const botMsg = addMessage({ sessionId, role: 'bot', text: autoReply, source: 'autoresponder' })
        return NextResponse.json({ msg, autoReply: botMsg })
      }

      // Call Claude AI if enabled
      if (config.aiEnabled && config.anthropicApiKey) {
        const aiReply = await callClaudeAI(sessionId, text.trim(), config.anthropicApiKey, config.aiKnowledge)
        if (aiReply) {
          const botMsg = addMessage({ sessionId, role: 'bot', text: aiReply, source: 'ai' })
          return NextResponse.json({ msg, autoReply: botMsg })
        }
      }

      // Send offline message if no auto-reply, no AI, and no Telegram config
      if (!config.botToken || !config.chatId) {
        if (config.offlineMessage) {
          const offlineMsg = addMessage({ sessionId, role: 'bot', text: config.offlineMessage })
          return NextResponse.json({ msg, autoReply: offlineMsg })
        }
      }
    }

    if (msgRole === 'owner') {
      // Admin replied from the sistema → also send to Telegram as confirmation
      if (config.botToken && config.chatId) {
        const tgText = `✅ <b>Respuesta enviada a ${session.visitorName}</b>:\n${text.trim()}`
        await sendToTelegram(config.botToken, config.chatId, tgText)
      }
    }

    return NextResponse.json({ msg })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
