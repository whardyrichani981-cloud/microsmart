import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'ms_auth'
const PUBLIC_PATHS = ['/login', '/api/auth/', '/api/debug/', '/seguimiento', '/api/seguimiento/', '/manifest.json', '/sw.js', '/icons/']
// Note: /seguimiento and all sub-paths are public (client-facing tracking page + embed)
// TODO: remove /api/debug/ after testing

async function verify(token: string): Promise<boolean> {
  try {
    const secret = process.env.SESSION_SECRET ?? 'dev-secret-change-me'
    const dot = token.lastIndexOf('.')
    if (dot < 0) return false
    const p = token.slice(0, dot)
    const s = token.slice(dot + 1)

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(p))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    if (s !== expected) return false

    // Decode and check expiry
    const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch { return false }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (token && await verify(token)) return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
