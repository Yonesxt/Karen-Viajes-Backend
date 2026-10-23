// Hash de contraseñas con scrypt (node:crypto). Formato: scrypt$N$r$p$salt$hash
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

const derive = (password, salt, n, r, p) =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => (err ? reject(err) : resolve(key)))
  )

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password, stored) {
  try {
    const [algo, n, r, p, saltB64, keyB64] = String(stored).split('$')
    if (algo !== 'scrypt') return false
    const expected = Buffer.from(keyB64, 'base64')
    const key = await derive(password, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p))
    return key.length === expected.length && timingSafeEqual(key, expected)
  } catch {
    return false
  }
}

// Hash de relleno para gastar el mismo tiempo cuando el e-mail no existe (evita revelar qué cuentas hay).
export const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(KEYLEN).toString('base64')
