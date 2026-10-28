import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setQueryImpl } from '../../lib/db.js'
import { psql, psqlQuery, runFile, TEST_DB } from './psql-adapter.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

process.env.JWT_SECRET = 'prueba-prueba-prueba-prueba-prueba-1234'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,https://www.viajesconkaren.com'
process.env.SESSION_DAYS = '7'
process.env.COOKIE_SAMESITE = 'lax'
process.env.NODE_ENV = 'test'
for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_DELETE_ORPHANS']) delete process.env[k]

setQueryImpl(psqlQuery)

// Base vacía con el esquema real (las migraciones de db/migrations).
export function resetDatabase() {
  // Las pruebas BORRAN todo el esquema: solo se permite en bases cuyo nombre termina en _test.
  if (!/_test$/.test(TEST_DB)) throw new Error(`Por seguridad las pruebas solo corren en una base que termine en _test (actual: ${TEST_DB}).`)
  psql(['-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'])
  // todas las migraciones, en orden (001_init, 002_hotel_tour, ...)
  const dir = resolve(root, 'db/migrations')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) runFile(resolve(dir, f))
}

// Llama a un handler de ruta como lo haría Next (Request estándar -> Response).
export async function call(handler, { method = 'GET', url = 'http://localhost:3000/api/x', body, cookie, origin = 'http://localhost:5173', ip = '10.0.0.1', headers = {}, params } = {}) {
  const h = { 'x-forwarded-for': ip, ...headers }
  if (origin) h.origin = origin
  if (cookie) h.cookie = cookie
  let payload
  if (body !== undefined) {
    h['content-type'] = h['content-type'] || 'application/json'
    payload = typeof body === 'string' ? body : JSON.stringify(body)
  }
  const res = await handler(new Request(url, { method, headers: h, body: payload }), { params: Promise.resolve(params || {}) })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

export const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0]
