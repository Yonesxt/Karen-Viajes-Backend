// Aplica en orden los archivos de db/migrations que todavía no se aplicaron.
// Cada archivo corre dentro de una transacción. Es seguro ejecutarlo varias veces.
import './_env.mjs'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (definila en .env).')
  process.exit(1)
}

const dir = resolve(process.cwd(), 'db/migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  let applied = 0
  for (const f of files) {
    if (done.has(f)) continue
    console.log(`Aplicando ${f}...`)
    await client.query('BEGIN')
    try {
      await client.query(readFileSync(resolve(dir, f), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f])
      await client.query('COMMIT')
      applied += 1
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  }
  console.log(applied ? `Listo: ${applied} migración(es) aplicada(s).` : 'La base ya está al día.')
} catch (e) {
  console.error('Error en la migración:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
