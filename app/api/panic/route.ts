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

// Inyecta CSS para ocultar navegación/header de panicfull.com y dejar solo el contenido
function injectCleanStyles(html: string): string {
  const css = `
<style>
  /* Ocultar navegación, header y footer del sitio panicfull.com */
  nav, header, footer,
  .navbar, .nav-bar, #navbar, #nav,
  .header, #header, .site-header,
  .footer, #footer, .site-footer,
  .menu, #menu, .menu-container, .main-menu,
  .top-bar, .top-nav, .navigation,
  .sidebar, #sidebar,
  [class*="nav-"], [id*="nav-"],
  [class*="menu-"], [id*="menu-"] { display: none !important; }

  /* Limpiar estilos del body */
  body {
    margin: 0 !important;
    padding: 12px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 13px !important;
    background: #fff !important;
    color: #1a1a1a !important;
  }

  /* Asegurar que el contenido principal use todo el ancho */
  main, .main, #main, .content, #content,
  .container, .wrapper, .page, .result {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Tablas legibles */
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { background: #f3f4f6; font-weight: 600; }
  th, td { padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left; }
  tr:nth-child(even) td { background: #f9fafb; }

  /* Links en el resultado */
  a { color: #2563eb; }

  /* Badges y etiquetas */
  .badge, .tag, .label { font-size: 11px; padding: 2px 6px; border-radius: 4px; }

  /* VERSION PRO badge — ocultar también */
  [class*="pro"], [class*="Pro"], [class*="version"] {
    /* mantener si es parte del resultado */
  }
</style>`

  // Insertar antes de </head> si existe, o al inicio del <body>
  if (html.includes('</head>')) {
    return html.replace('</head>', css + '</head>')
  }
  if (html.includes('<body')) {
    return html.replace(/<body([^>]*)>/, `<body$1>${css}`)
  }
  // Sin estructura HTML: envolver en documento limpio
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${css}</head><body>${html}</body></html>`
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

  // ── Rate limit check ──────────────────────────────────────────────────────
  const { used, remaining } = await getRateInfo(ip)
  if (used >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `Límite diario alcanzado. Podés realizar hasta ${DAILY_LIMIT} análisis por día. Volvé mañana.`,
        limitReached: true,
        remaining: 0,
        limit: DAILY_LIMIT,
      },
      { status: 429 }
    )
  }

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

    // ── Limpiar HTML: inyectar CSS para ocultar nav/header de panicfull.com ──
    const cleanedHtml = injectCleanStyles(resultHtml)

    // ── Éxito ─────────────────────────────────────────────────────────────
    await incrementRate(ip)
    const newRemaining = Math.max(0, remaining - 1)

    return NextResponse.json({ ok: true, html: cleanedHtml, remaining: newRemaining, limit: DAILY_LIMIT })

  } catch (e) {
    console.error('[panic proxy]', e)
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
