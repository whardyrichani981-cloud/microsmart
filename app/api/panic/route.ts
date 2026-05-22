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

// Limpia el HTML de panicfull.com e inyecta estilos + JS para ocultar nav
function prepareResultHtml(html: string): string {
  // Solo quitar scripts, links y head — mantener el resto intacto
  let out = html
  out = out.replace(/<head[\s\S]*?<\/head>/gi, '')
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<link[^>]*>/gi, '')
  out = out.replace(/<\/?html[^>]*>/gi, '')
  out = out.replace(/<\/?body[^>]*>/gi, '')

  // CSS para tema Microsmart + ocultar nav conocida de panicfull
  const css = `<style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.6;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1C1C1E; color: #F5F5F7; }
      a { color: #0A84FF; }
      table { border-color: #3A3A3C; }
      th { background: #2C2C2E; color: #F5F5F7; }
      td { border-color: #2C2C2E; color: #E5E5EA; }
      tr:nth-child(even) td { background: #2C2C2E; }
      h1,h2,h3,b,strong { color: #F5F5F7; }
      hr { border-color: #3A3A3C; }
      input[type=checkbox] { accent-color: #0A84FF; }
    }
    @media (prefers-color-scheme: light) {
      body { background: #FFFFFF; color: #1D1D1F; }
      a { color: #0066CC; }
      table { border-color: #D1D1D6; }
      th { background: #F5F5F7; color: #1D1D1F; }
      td { border-color: #E8E8ED; color: #3A3A3C; }
      tr:nth-child(even) td { background: #F5F5F7; }
      h1,h2,h3,b,strong { color: #1D1D1F; }
      hr { border-color: #D1D1D6; }
      input[type=checkbox] { accent-color: #0066CC; }
    }
    h1,h2,h3 {
      font-size: 14px; font-weight: 700; margin: 16px 0 8px;
      padding-bottom: 6px; border-bottom: 1px solid currentColor;
      opacity: 1;
    }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th,td { padding: 7px 10px; border: 1px solid; text-align: left; }
    p { margin: 6px 0; }
    hr { border: none; border-top: 1px solid; margin: 12px 0; }
    img { max-width: 100%; display: none; } /* ocultar logos e íconos del sitio */
    /* Ocultar elementos marcados por JS como nav */
    .ms-hide { display: none !important; }
  </style>`

  // JS que detecta y oculta el nav de panicfull por texto conocido
  const js = `<script>
    (function() {
      var NAV_KEYWORDS = ['Inicial','Sus Datos','Análisis Panic Full','Análisis iBoot Panic',
        'Software Errores','NAND información','Compatibilidad CI','Tabla I2C',
        'Power On','iBoot Stylo','Política de Privacidad','Términos de Uso',
        'Contacto','Sobre Site','Elegir el idioma','Choose the language',
        'Escolher o idioma','PanicFull.com','VERSIÓN PRO','VERSION PRO'];
      function hasNavText(el) {
        var t = el.innerText || '';
        return NAV_KEYWORDS.some(function(k){ return t.includes(k); });
      }
      function isSmallContent(el) {
        // Un div que solo tiene links de menú, no contenido de análisis
        var anchors = el.querySelectorAll('a');
        var text = (el.innerText||'').trim();
        return anchors.length > 3 && text.length < 600;
      }
      document.addEventListener('DOMContentLoaded', function() {
        var allEls = document.querySelectorAll('div,ul,section,aside,header,nav,footer');
        allEls.forEach(function(el) {
          if (hasNavText(el) && isSmallContent(el)) {
            el.classList.add('ms-hide');
          }
        });
        // También ocultar líneas horizontales huérfanas al inicio
        var firstHr = document.querySelector('hr');
        if (firstHr) {
          var prev = firstHr.previousElementSibling;
          if (!prev || prev.classList.contains('ms-hide')) firstHr.classList.add('ms-hide');
        }
      });
    })();
  </script>`

  // Envolver todo en documento HTML limpio con nuestros estilos
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${css}</head><body>${js}${out}</body></html>`
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
