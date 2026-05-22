import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PANIC_HOME = 'https://panicfull.com/'
const PANIC_POST = 'https://panicfull.com/processa_panic.php'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const DAILY_LIMIT = 3

const REDIS_SESSION_KEY = 'panicfull-session-cookies'

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

// Limpia el HTML de panicfull.com: corta el nav y aplica tema Microsmart
function prepareResultHtml(html: string): string {
  // 1. Quitar head, scripts, links, styles propios del sitio
  let out = html
  out = out.replace(/<head[\s\S]*?<\/head>/gi, '')
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<link[^>]*>/gi, '')
  out = out.replace(/<\/?html[^>]*>/gi, '')
  out = out.replace(/<\/?body[^>]*>/gi, '')

  // 2. Eliminar bloques fijos del sitio que no son parte del análisis
  // Selector de idioma (siempre aparece igual)
  out = out.replace(/Elegir el idioma[\s\S]{0,400}Português Idioma/gi, '')
  // Header "panicfull.com" y toggle de tema
  out = out.replace(/panicfull\.com/gi, '')
  // Badge VERSIÓN PRO / VERSION PRO
  out = out.replace(/VERSI[ÓO]N PRO[!]?/gi, '')
  // Nombre del usuario logueado (RONALD DIA... etc.)
  out = out.replace(/RONALD DIA[^\n<]*/gi, '')
  // Idioma / Lang label
  out = out.replace(/Idioma\s*\/\s*Lang/gi, '')
  // Restos de "www." que quedan al quitar "PanicFull.com"
  out = out.replace(/\bwww\.\s*/gi, '')

  // 4. Encontrar dónde empieza el contenido real de análisis
  //    El nav de panicfull siempre aparece ANTES de los datos del dispositivo
  const CONTENT_MARKERS = [
    'Datos del Dispositivo',
    'Device Data',
    'Dados do Dispositivo',
    'Error de Descripción',
    'Componentes Involucrados',
    'Sugerencia de Reparación',
    'Incident Identifier',
  ]

  for (const marker of CONTENT_MARKERS) {
    const markerIdx = out.indexOf(marker)
    if (markerIdx > 80) {
      // Buscar la apertura de tag más cercana antes del marker
      // para no cortar en medio de un elemento
      const before = out.substring(0, markerIdx)
      const lastOpen = before.lastIndexOf('<')
      if (lastOpen >= 0) {
        out = out.substring(lastOpen)
        break
      }
    }
  }

  // 5. Cortar el footer del resultado (info del usuario, feedback, etc.)
  const FOOTER_MARKERS = [
    'Datos Adicionales',
    'Consulta realizada por',
    'Consulta Realizada por',
    'Historial de Consultas',
    'Ver archivo Panic-Full',
    'Nuevo Análisis',
    'Evalúa esta interpretación',
    'Feedback',
    'Sugerir Corrección',
    '¡Gracias por la reseña',
  ]

  for (const marker of FOOTER_MARKERS) {
    const footerIdx = out.indexOf(marker)
    if (footerIdx > 0) {
      // Buscar el tag de apertura más cercano antes del marker y cortar ahí
      const before = out.substring(0, footerIdx)
      const lastOpen = before.lastIndexOf('<')
      if (lastOpen >= 0) {
        out = out.substring(0, lastOpen)
        break
      }
    }
  }

  // 6. CSS con tema Microsmart (dark/light automático)
  const css = `
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 20px 22px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.65;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1C1C1E; color: #E5E5EA; }
      a { color: #0A84FF; }
      th { background: #2C2C2E; color: #F5F5F7; border-color: #3A3A3C; }
      td { border-color: #3A3A3C; color: #D1D1D6; }
      tr:nth-child(even) td { background: #2C2C2E; }
      b, strong { color: #F5F5F7; }
      hr { border-color: #3A3A3C; }
      input[type=checkbox] { accent-color: #0A84FF; }
    }
    @media (prefers-color-scheme: light) {
      body { background: #FFFFFF; color: #1D1D1F; }
      a { color: #0066CC; }
      th { background: #F5F5F7; color: #1D1D1F; border-color: #D1D1D6; }
      td { border-color: #E8E8ED; color: #3A3A3C; }
      tr:nth-child(even) td { background: #F9F9F9; }
      b, strong { color: #1D1D1F; }
      hr { border-color: #E8E8ED; }
      input[type=checkbox] { accent-color: #0066CC; }
    }
    h1, h2, h3 {
      font-size: 14px; font-weight: 700;
      margin: 20px 0 8px; padding-bottom: 6px;
      border-bottom: 1px solid rgba(128,128,128,0.25);
    }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
    th, td { padding: 7px 11px; border: 1px solid; text-align: left; }
    p { margin: 5px 0; }
    ul, ol { padding-left: 18px; margin: 6px 0; }
    li { margin: 3px 0; }
    hr { border: none; border-top: 1px solid; margin: 14px 0; }
    img { display: none; }
  `

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${out}</body></html>`
}

// Lee cookies de sesión: primero Redis, luego env var de respaldo
async function getPanicfullCookies(): Promise<string> {
  if (redis) {
    const saved = await redis.get<string>(REDIS_SESSION_KEY)
    if (saved) return saved
  }
  return process.env.PANICFULL_COOKIES || ''
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

async function getRateInfo(ip: string): Promise<{ used: number; remaining: number; limit: number }> {
  if (!redis) return { used: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT }
  const key = `panic-rate:${ip}:${todayKey()}`
  const used = (await redis.get<number>(key)) ?? 0
  return { used, remaining: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT }
}

async function incrementRate(ip: string): Promise<void> {
  if (!redis) return
  const key = `panic-rate:${ip}:${todayKey()}`
  const newVal = await redis.incr(key)
  if (newVal === 1) await redis.expire(key, 86400)
}

// GET /api/panic — consultar usos restantes del día
export async function GET(req: NextRequest) {
  const ip = getClientIP(req)
  const info = await getRateInfo(ip)
  return NextResponse.json(info)
}

// POST /api/panic — analizar archivo(s)
export async function POST(req: NextRequest) {
  const ip = getClientIP(req)

  // ── Rate limit check (DESACTIVADO temporalmente) ─────────────────────────
  const { remaining } = await getRateInfo(ip)

  try {
    const form = await req.formData()

    async function resolveLog(key: string): Promise<string> {
      const file = form.get(key) as File | null
      const text = form.get(key + '_text') as string | null
      if (file && file.size > 0) return await file.text()
      if (text?.trim()) return text.trim()
      return ''
    }

    const log1 = await resolveLog('file1') || await resolveLog('file')
    const log2 = await resolveLog('file2')
    const log3 = await resolveLog('file3')

    if (!log1) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo o texto.' }, { status: 400 })
    }

    // ── Leer cookies de sesión (Redis → env var) ──────────────────────────────
    const PANICFULL_COOKIES = await getPanicfullCookies()

    // ── Obtener token tk desde panicfull.com ─────────────────────────────────
    const getHeaders: Record<string, string> = {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    }

    // Si tenemos cookies de sesión Pro, las incluimos en todas las peticiones
    if (PANICFULL_COOKIES) {
      getHeaders['Cookie'] = PANICFULL_COOKIES
    }

    const getRes = await fetch(PANIC_HOME, { headers: getHeaders })

    if (!getRes.ok) {
      return NextResponse.json(
        { error: `Error al conectar con panicfull.com (HTTP ${getRes.status})` },
        { status: 502 }
      )
    }

    const pageHtml = await getRes.text()

    // Verificar si la sesión está activa (página Pro muestra "RONALD" o no muestra botón de login)
    const sessionActive = PANICFULL_COOKIES && !pageHtml.includes('user_login') && !pageHtml.includes('Login')

    const tkMatch =
      pageHtml.match(/name=["']tk["']\s+value=["']([^"']+)["']/) ??
      pageHtml.match(/value=["']([^"']+)["']\s+name=["']tk["']/)

    if (!tkMatch?.[1]) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de sesión de panicfull.com' },
        { status: 502 }
      )
    }
    const tk = tkMatch[1]

    // Combinar cookies de sesión + cookies nuevas de la respuesta GET
    const newCookies: string[] = []
    getRes.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie') newCookies.push(val.split(';')[0])
    })

    // Priorizar cookies de sesión guardadas; agregar las nuevas que no sobreescriban
    let cookieHeader = PANICFULL_COOKIES
    if (newCookies.length > 0) {
      // Agregar solo cookies nuevas que no existan ya en las de sesión
      const existingNames = new Set(
        (PANICFULL_COOKIES || '').split(';').map(c => c.trim().split('=')[0])
      )
      const extra = newCookies.filter(c => !existingNames.has(c.split('=')[0]))
      if (extra.length > 0) {
        cookieHeader = cookieHeader
          ? `${cookieHeader}; ${extra.join('; ')}`
          : extra.join('; ')
      }
    }

    // ── POST a processa_panic.php ─────────────────────────────────────────
    const body = new URLSearchParams()
    body.append('tk', tk)
    if (log2 || log3) {
      body.append('t1_send', log1)
      body.append('t2_send', log2)
      body.append('t3_send', log3)
    } else {
      body.append('t4_send', log1)
    }

    const postHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Referer': PANIC_HOME,
      'Origin': 'https://panicfull.com',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9',
    }
    if (cookieHeader) postHeaders['Cookie'] = cookieHeader

    const postRes = await fetch(PANIC_POST, {
      method: 'POST',
      headers: postHeaders,
      body: body.toString(),
    })

    const resultHtml = await postRes.text()

    // Detectar si la respuesta es la página de inicio (sesión no activa)
    if (resultHtml.includes('<nav') && resultHtml.includes('IMEI') && resultHtml.length > 5000) {
      const msg = sessionActive
        ? 'La sesión de panicfull.com expiró. Actualizá la variable PANICFULL_COOKIES en Vercel.'
        : 'panicfull.com requiere una cuenta Pro activa. Configurá PANICFULL_COOKIES en Vercel.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    if (!resultHtml || resultHtml.length < 50) {
      return NextResponse.json(
        { error: 'panicfull.com no devolvió un resultado válido. Intentá de nuevo.' },
        { status: 502 }
      )
    }

    // ── Preparar HTML con estilos Microsmart y ocultado de nav ───────────────
    const cleanedHtml = prepareResultHtml(resultHtml)

    // ── Éxito ─────────────────────────────────────────────────────────────
    await incrementRate(ip)
    const newRemaining = Math.max(0, remaining - 1)

    return NextResponse.json({ ok: true, html: cleanedHtml, remaining: newRemaining, limit: DAILY_LIMIT })

  } catch (e) {
    console.error('[panic proxy]', e)
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
