import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'ms_auth'
const SECRET = () => process.env.SESSION_SECRET ?? 'dev-secret-change-me'

function sign(payload: string): string {
  return createHmac('sha256', SECRET()).update(payload).digest('base64url')
}

export function makeToken(user: string): string {
  const p = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + 7 * 86_400_000 })).toString('base64url')
  return `${p}.${sign(p)}`
}

export function verifyTokenNode(token: string): boolean {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 0) return false
    const p = token.slice(0, dot)
    const s = token.slice(dot + 1)
    const expected = sign(p)
    if (!timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return false
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch { return false }
}

export { COOKIE_NAME }
