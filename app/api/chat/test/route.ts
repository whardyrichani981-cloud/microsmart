import { NextRequest, NextResponse } from 'next/server'
import { getTelegramConfig } from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

// POST /api/chat/test — prueba la IA con un mensaje sin guardar nada
export async function POST(req: NextRequest) {
  try {
    const { message, knowledge } = await req.json() as { message: string; knowledge?: string }
    if (!message?.trim()) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

    const config = await getTelegramConfig()
    const provider = config.aiProvider ?? 'gemini'
    const apiKey = provider === 'gemini' ? config.geminiApiKey : config.anthropicApiKey

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'No hay API key configurada. Guardá primero la configuración de IA.' }, { status: 400 })
    }

    // Usar el knowledge que se pasa (en tiempo real, sin guardar) o el guardado
    const knowledgeToUse = knowledge ?? config.aiKnowledge ?? ''

    const systemPrompt = `Sos el asistente virtual de Microsmart, un servicio técnico especializado en productos Apple (iPhone, iPad, Apple Watch, Mac, etc.) ubicado en Argentina.
Respondés consultas de clientes de manera amable, directa y profesional, siempre en español con modismos argentinos naturales (vos, te, acá, etc.).

${knowledgeToUse ? `INFORMACIÓN DEL NEGOCIO Y CÓMO RESPONDER:\n${knowledgeToUse}\n` : ''}

REGLAS:
- Si no sabés el precio exacto, decí que lo confirmás a la brevedad
- Respuestas cortas y útiles (máximo 3-4 líneas)
- No menciones que sos una IA`

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: message }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
          }),
        }
      )
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message: string } }
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      return NextResponse.json({ reply })
    }

    // Claude
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-5', max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })
    const block = response.content[0]
    return NextResponse.json({ reply: block.type === 'text' ? block.text : '' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
