// Adaptador SOLO PARA PRUEBAS: ejecuta las consultas contra un PostgreSQL real usando el cliente
// `psql` (así se prueba el SQL de verdad sin instalar el paquete "pg"). Reemplaza $1, $2... por
// literales escapados del lado del cliente y devuelve las filas como objetos (vía json_agg).
import { execFileSync } from 'node:child_process'

const env = {
  ...process.env,
  PGHOST: process.env.TEST_PGHOST || 'localhost',
  PGPORT: process.env.TEST_PGPORT || '5432',
  PGUSER: process.env.TEST_PGUSER || 'postgres',
  PGDATABASE: process.env.TEST_PGDATABASE || 'vck_test',
  ...(process.env.TEST_PGPASSWORD ? { PGPASSWORD: process.env.TEST_PGPASSWORD } : {}),
}

export const TEST_DB = env.PGDATABASE

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const arrayLiteral = (arr) =>
  `{${arr.map((x) => (x === null ? 'NULL' : `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)).join(',')}}`

function literal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return q(arrayLiteral(v))
  if (v instanceof Date) return q(v.toISOString())
  return q(v)
}

export function psql(args) {
  return execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function runFile(path) {
  psql(['-f', path])
}

export function psqlQuery(text, params = []) {
  const sql = text
    .replace(/\$(\d+)/g, (_, n) => {
      if (Number(n) > params.length) throw new Error(`Falta el parámetro $${n}`)
      return literal(params[Number(n) - 1])
    })
    .trim()
    .replace(/;+$/, '')
  const kind = /^(\w+)/.exec(sql)[1].toUpperCase()
  let wrapped
  if (kind === 'SELECT') wrapped = `SELECT coalesce(json_agg(q), '[]'::json) FROM (${sql}) q`
  else if (['INSERT', 'UPDATE', 'DELETE', 'WITH'].includes(kind)) wrapped = `WITH q AS (${sql}) SELECT coalesce(json_agg(q), '[]'::json) FROM q`
  else {
    psql(['-c', sql])
    return Promise.resolve([])
  }
  try {
    const out = psql(['-t', '-A', '-c', wrapped])
    return Promise.resolve(JSON.parse(out))
  } catch (e) {
    const m = /ERROR:\s+(\w{5}):\s*(.*)/.exec(e.stderr || '')
    const err = new Error(m ? m[2] : e.message)
    err.code = m ? m[1] : undefined
    return Promise.reject(err)
  }
}
