import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ENACOM = 'https://imei.enacom.gob.ar'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function parseCookieHeaders(raw: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of raw) {
    const [pair] = h.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  return out
}

export async function GET(req: NextRequest) {
  const imei = req.nextUrl.searchParams.get('imei') ?? ''
  if (!/^\d{15}$/.test(imei)) {
    return NextResponse.json({ error: 'IMEI debe tener exactamente 15 dígitos numéricos.' }, { status: 400 })
  }

  try {
    // ── Step 1: load ENACOM page to get session + XSRF cookie + Livewire snapshot ──
    const pageRes = await fetch(`${ENACOM}/`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      redirect: 'follow',
      // disable Next.js caching — each request needs fresh cookies
      cache: 'no-store',
    })

    if (!pageRes.ok) {
      return NextResponse.json({ error: `ENACOM no disponible (HTTP ${pageRes.status})` }, { status: 502 })
    }

    const html = await pageRes.text()

    // Collect cookies — use getSetCookie() (Node 18+) with fallback
    const setCookieRaw: string[] =
      typeof (pageRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (pageRes.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [pageRes.headers.get('set-cookie') ?? ''].filter(Boolean)

    const cookies = parseCookieHeaders(setCookieRaw)
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    const xsrfToken = decodeURIComponent(cookies['XSRF-TOKEN'] ?? '')

    // ── Step 2: extract Livewire snapshot from the HTML ──
    const snapshotMatch = html.match(/wire:snapshot="([^"]*)"/)
    if (!snapshotMatch) {
      return NextResponse.json({ error: 'No se pudo obtener el formulario de ENACOM. Intentá más tarde.' }, { status: 502 })
    }

    // HTML-unescape the attribute value
    const snapshotStr = snapshotMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')

    // Validate it parses correctly
    JSON.parse(snapshotStr)

    // ── Step 3: call Livewire /update to run the "consultar" action ──
    const livewireBody = {
      components: [{
        snapshot: snapshotStr,
        updates: { imei },
        calls: [{ path: '', method: 'consultar', params: [] }],
      }],
    }

    const lwRes = await fetch(`${ENACOM}/livewire/update`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Content-Type': 'application/json',
        'X-Livewire': 'true',
        'X-XSRF-TOKEN': xsrfToken,
        'Cookie': cookieHeader,
        'Origin': ENACOM,
        'Referer': `${ENACOM}/`,
      },
      body: JSON.stringify(livewireBody),
      cache: 'no-store',
    })

    if (!lwRes.ok) {
      const txt = await lwRes.text().catch(() => '')
      console.error('Livewire error', lwRes.status, txt.slice(0, 300))
      return NextResponse.json(
        { error: `Error al consultar ENACOM (${lwRes.status}). Intentá de nuevo.` },
        { status: 502 }
      )
    }

    const lwData = await lwRes.json()

    // ── Step 4: parse the updated component state ──
    const comp = lwData?.components?.[0]
    const updatedSnap = JSON.parse(comp?.snapshot ?? '{}')
    const data: Record<string, unknown> = updatedSnap?.data ?? {}

    // ENACOM changed their Livewire data shape — support both old and new structures
    // New: { mensaje, bloqueado, mostrar_datos_imei, status, status_class, ... }
    // Old: { resultado, error, showResult }
    const hasResult = data.mostrar_datos_imei || data.showResult
    const mensajeRaw = data.mensaje ?? data.resultado ?? null
    const mensaje = mensajeRaw != null
      ? (typeof mensajeRaw === 'string' ? mensajeRaw : JSON.stringify(mensajeRaw))
      : null
    const bloqueado = Boolean(data.bloqueado)
    const errorRaw = data.codigo_error || data.error
    const errorMsg = errorRaw ? String(errorRaw) : null

    if (!hasResult && !mensaje && !errorMsg) {
      return NextResponse.json({ error: 'ENACOM no devolvió resultado. Verificá el IMEI e intentá de nuevo.' }, { status: 502 })
    }

    return NextResponse.json({
      resultado: mensaje,
      bloqueado,
      error: errorMsg,
      showResult: Boolean(hasResult ?? mensaje),
    })

  } catch (e: unknown) {
    console.error('IMEI route error:', e)
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
