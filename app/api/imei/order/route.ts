import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const API_URL = process.env.TEAM_SAUL_API_URL || 'https://team-saul.com/api/v2'
const API_KEY = process.env.TEAM_SAUL_API_KEY || ''

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'API key de team-saul.com no configurada.' },
      { status: 503 }
    )
  }

  try {
    const body = await req.json() as { service: string; imei: string }
    const { service, imei } = body

    if (!service || !imei) {
      return NextResponse.json(
        { error: 'Faltan parámetros: service e imei son requeridos.' },
        { status: 400 }
      )
    }

    // Limpiar IMEI (solo números)
    const cleanImei = imei.replace(/\D/g, '')
    if (cleanImei.length < 14 || cleanImei.length > 16) {
      return NextResponse.json(
        { error: 'IMEI inválido. Debe tener 14-16 dígitos.' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      action: 'add',
      key: API_KEY,
      service: service,
      link: cleanImei,
      quantity: '1',
    })

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Microsmart/1.0',
      },
      body: params.toString(),
    })

    const text = await res.text()

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: `Respuesta inválida de team-saul.com: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, result: data })
  } catch (e) {
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
