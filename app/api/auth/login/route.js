export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { config } from '../../../../lib/config.js'
import { loginAccountLimiter as accountLimiter, loginIpLimiter as ipLimiter } from '../../../../lib/limiters.js'
import { DUMMY_HASH, verifyPassword } from '../../../../lib/password.js'
import { issueToken, sessionCookie } from '../../../../lib/auth.js'
import { findAdminByEmail } from '../../../../lib/repo/admins.js'
import { HttpError, json, readJson, route } from '../../../../lib/http.js'

export const POST = route(async ({ request, ip }) => {
  const body = await readJson(request)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password || email.length > 200 || password.length > 200) {
    throw new HttpError(401, 'E-mail o contraseña incorrectos.')
  }

  const accountKey = `${ip}|${email}`
  const a = accountLimiter.hit(accountKey)
  const b = ipLimiter.hit(ip)
  if (!a.ok || !b.ok) {
    const retry = Math.max(a.ok ? 0 : a.retryAfterSec, b.ok ? 0 : b.retryAfterSec)
    throw new HttpError(429, 'Demasiados intentos. Probá de nuevo en unos minutos.', null, { 'Retry-After': String(retry) })
  }

  const admin = await findAdminByEmail(email)
  // Siempre se calcula el hash (aunque el e-mail no exista) para no revelar qué cuentas existen por el tiempo de respuesta.
  const valid = await verifyPassword(password, admin ? admin.password_hash : DUMMY_HASH)
  if (!admin || !valid) throw new HttpError(401, 'E-mail o contraseña incorrectos.')

  accountLimiter.reset(accountKey)
  const result = { email: admin.email, name: admin.name }
  if (config().allowBearer) result.token = issueToken(admin)
  return json(result, 200, { 'Set-Cookie': sessionCookie(admin) })
})
