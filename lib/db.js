// Acceso a PostgreSQL. Todo el código usa query(texto, params) y recibe un array de filas.
// "pg" se importa recién cuando hace falta (así las pruebas pueden reemplazar el acceso).

let override = null
export function setQueryImpl(fn) {
  override = fn
}

async function getPool() {
  if (!globalThis.__pgPool) {
    const { default: pg } = await import('pg')
    if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL.')
    globalThis.__pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 })
    globalThis.__pgPool.on('error', (e) => console.error('[pg] error en conexión inactiva:', e.message))
  }
  return globalThis.__pgPool
}

export async function query(text, params = []) {
  if (override) return override(text, params)
  const pool = await getPool()
  const res = await pool.query(text, params)
  return res.rows
}

export async function closePool() {
  if (globalThis.__pgPool) {
    await globalThis.__pgPool.end()
    globalThis.__pgPool = null
  }
}
