// Limitador simple en memoria (por instancia del servidor). Alcanza para frenar fuerza bruta
// y spam básicos; si corrés varias instancias o serverless, usá uno compartido (Redis, etc.).
export function createLimiter({ max, windowMs }) {
  const hits = new Map() // key -> { count, resetAt }
  return {
    hit(key, now = Date.now()) {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      let entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs }
        hits.set(key, entry)
      }
      entry.count += 1
      return { ok: entry.count <= max, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
    },
    reset(key) {
      hits.delete(key)
    },
  }
}
