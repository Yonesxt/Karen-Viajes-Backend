// Token de sesión firmado (JWT HS256) con node:crypto. Sin dependencias.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.js'

const b64 = (buf) => Buffer.from(buf).toString('base64url')
const unb64 = (s) => Buffer.from(s, 'base64url')

function secret() {
  const s = config().jwtSecret
  if (s.length < 32) throw new Error('JWT_SECRET falta o es muy corto (mínimo 32 caracteres).')
  return s
}

const sign = (data) => createHmac('sha256', secret()).update(data).digest()

export function signToken(payload, { expiresInSec }) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec }))
  return `${head}.${body}.${b64(sign(`${head}.${body}`))}`
}

// Devuelve el payload si el token es válido y no venció; si no, null.
export function verifyToken(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts
  try {
    if (JSON.parse(unb64(head).toString()).alg !== 'HS256') return null
    const expected = sign(`${head}.${body}`)
    const given = unb64(sig)
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const payload = JSON.parse(unb64(body).toString())
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
