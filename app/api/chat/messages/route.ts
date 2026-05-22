import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateSession, addMessage, getMessages,
  getTelegramConfig, sendToTelegram, updateMessageTelegramId,
  pollTelegramUpdates, checkAutoResponder, callClaudeAI, callGeminiAI,
} from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

// GET /api/chat/messages?session_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id requerido' }, { status: 400 })

  const config = await getTelegramConfig()
  if (config.botToken) {
    await pollTelegramUpdates(config.botToken)
  }

  const messages = await getMessages(sessionId)
  return NextResponse.json(messages)
}

// POST /api/chat/messages — send a message
export async function POST(req: NextRequest) {
  try {
    const { sessionId, visitorName, text, role } = await req.json() as {
      sessionId: string; visitorName?: string; text: string; role?: 'user' | 'owner'
    }
    if (!sessionId || !text?.trim()) {
      return NextResponse.json({ error: 'sessionId y text son requeridos' }, { status: 400 })
    }

    const session = await getOrCreateSession(sessionId, visitorName)
    const msgRole = role ?? 'user'

    const msg = await addMessage({ sessionId, role: msgRole, text: text.trim() })

    const config = await getTelegramConfig()

    if (msgRole === 'user') {
      // Reenviar a Telegram
      if (config.botToken && config.chatId) {
        const tgText =
          `👤 <b>${session.visitorName}</b>\n` +
          `💬 ${text.trim()}\n\n` +
          `<i>🔑 ${sessionId.slice(0, 8)}… · Respondé este mensaje para contestar</i>`
        const tgMsgId = await sendToTelegram(config.botToken, config.chatId, tgText)
        if (tgMsgId) await updateMessageTelegramId(msg.id, tgMsgId)
      }

      // Auto-responder (mayor prioridad)
      const autoReply = await checkAutoResponder(text)
      if (autoReply) {
        const botMsg = await addMessage({ sessionId, role: 'bot', text: autoReply, source: 'autoresponder' })
        return NextResponse.json({ msg, autoReply: botMsg })
      }

      // IA si está habilitada (Gemini gratis o Claude)
      if (config.aiEnabled) {
        const provider = config.aiProvider ?? 'gemini'
        let aiReply: string | null = null
        if (provider === 'gemini' && config.geminiApiKey) {
          aiReply = await callGeminiAI(sessionId, text.trim(), config.geminiApiKey, config.aiKnowledge)
        } else if (provider === 'claude' && config.anthropicApiKey) {
          aiReply = await callClaudeAI(sessionId, text.trim(), config.anthropicApiKey, config.aiKnowledge)
        }
        if (aiReply) {
          const botMsg = await addMessage({ sessionId, role: 'bot', text: aiReply, source: 'ai' })
          return NextResponse.json({ msg, autoReply: botMsg })
        }
      }

      // Mensaje offline si no hay Telegram ni AI
      if (!config.botToken || !config.chatId) {
        if (config.offlineMessage) {
          const offlineMsg = await addMessage({ sessionId, role: 'bot', text: config.offlineMessage })
          return NextResponse.json({ msg, autoReply: offlineMsg })
        }
      }
    }

    if (msgRole === 'owner') {
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
