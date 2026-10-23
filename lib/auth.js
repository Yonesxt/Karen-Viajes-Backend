// Sesión de administrador: JWT en una cookie httpOnly.
import { config } from './config.js'
import { signToken, verifyToken } from './jwt.js'

export const COOKIE_NAME = 'vck_session'

export function parseCookies(header) {
  const out = {}
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k && !(k in out)) {
      try {
        out[k] = decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        /* cookie mal formada: se ignora */
      }
    }
  }
  return out
}

function cookieAttrs(maxAgeSec) {
  const c = config()
  const attrs = ['Path=/', 'HttpOnly', `SameSite=${c.cookieSameSite[0].toUpperCase()}${c.cookieSameSite.slice(1)}`, `Max-Age=${maxAgeSec}`]
  // SameSite=None exige Secure; en producción siempre Secure.
  if (c.isProd || c.cookieSameSite === 'none') attrs.push('Secure')
  if (c.cookieDomain) attrs.push(`Domain=${c.cookieDomain}`)
  return attrs
}

export function sessionCookie(admin) {
  const maxAge = config().sessionDays * 86400
  const token = signToken({ sub: admin.id, email: admin.email, name: admin.name }, { expiresInSec: maxAge })
  return `${COOKIE_NAME}=${token}; ${cookieAttrs(maxAge).join('; ')}`
}

export const clearedCookie = () => `${COOKIE_NAME}=; ${cookieAttrs(0).join('; ')}`

// Devuelve { id, email, name } o null.
export async function getSession(request) {
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME]
  const payload = token ? verifyToken(token) : null
  return payload ? { id: payload.sub, email: payload.email, name: payload.name } : null
}
