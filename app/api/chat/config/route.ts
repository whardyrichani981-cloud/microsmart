import { NextRequest, NextResponse } from 'next/server'
import { getTelegramConfig, saveTelegramConfig, sendToTelegram } from '@/lib/chat-db'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getTelegramConfig())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await saveTelegramConfig(body)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT — test Telegram OR AI connection
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      botToken?: string; chatId?: string
      testAI?: boolean; aiProvider?: string
      geminiApiKey?: string; anthropicApiKey?: string
    }

    // Test Gemini API key
    if (body.testAI && body.aiProvider === 'gemini' && body.geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${body.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hola' }] }], generationConfig: { maxOutputTokens: 10 } }),
          }
        )
        const data = await res.json() as { candidates?: unknown[]; error?: { message: string } }
        if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
        if (data.candidates?.length) return NextResponse.json({ ok: true })
        return NextResponse.json({ error: 'Respuesta inválida de Gemini.' }, { status: 400 })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    // Test Claude API key
    if (body.testAI && body.aiProvider === 'claude' && body.anthropicApiKey) {
      try {
        const client = new Anthropic({ apiKey: body.anthropicApiKey })
        const response = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hola' }],
        })
        if (response.id) return NextResponse.json({ ok: true })
        return NextResponse.json({ error: 'Respuesta inválida de la API.' }, { status: 400 })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    // Test Telegram connection
    if (body.botToken && body.chatId) {
      const msgId = await sendToTelegram(
        body.botToken, body.chatId,
        '✅ <b>Conexión exitosa con Microsmart</b>\n\nEl bot está listo para recibir mensajes del chat. Cuando un cliente escriba, recibirás una notificación aquí. Respondé directamente a cada mensaje para que llegue al chat del cliente.'
      )
      if (msgId) return NextResponse.json({ ok: true })
      return NextResponse.json({ error: 'No se pudo enviar el mensaje de prueba. Verificá el token y el chat ID.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Parámetros insuficientes.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
