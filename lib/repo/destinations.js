import { query } from '../db.js'
import { HttpError } from '../http.js'

const COLS = 'id, name, country, scope, images, created_at, updated_at'
const iso = (d) => new Date(d).toISOString()

export const toDestination = (r) => ({
  id: r.id,
  name: r.name,
  country: r.country,
  scope: r.scope,
  images: r.images || [],
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

export async function listDestinations({ onlyUsedByActiveTrips = false } = {}) {
  const where = onlyUsedByActiveTrips
    ? 'WHERE EXISTS (SELECT 1 FROM trips t WHERE t.destination_id = destinations.id AND t.active)'
    : ''
  return (await query(`SELECT ${COLS} FROM destinations ${where} ORDER BY id`)).map(toDestination)
}

export async function getDestination(id) {
  const rows = await query(`SELECT ${COLS} FROM destinations WHERE id = $1`, [id])
  return rows[0] ? toDestination(rows[0]) : null
}

export async function destinationExists(id) {
  return (await query('SELECT 1 AS ok FROM destinations WHERE id = $1', [id])).length > 0
}

const duplicateName = () => new HttpError(422, 'Revisá los campos marcados.', { name: 'Ya existe un destino con ese nombre.' })

export async function createDestination(d) {
  try {
    const rows = await query(
      `INSERT INTO destinations (name, country, scope, images) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [d.name, d.country, d.scope, d.images]
    )
    return toDestination(rows[0])
  } catch (e) {
    if (e.code === '23505') throw duplicateName()
    throw e
  }
}

export async function updateDestination(id, d) {
  try {
    const rows = await query(
      `UPDATE destinations SET name = $2, country = $3, scope = $4, images = $5, updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`,
      [id, d.name, d.country, d.scope, d.images]
    )
    return rows[0] ? toDestination(rows[0]) : null
  } catch (e) {
    if (e.code === '23505') throw duplicateName()
    throw e
  }
}

// Devuelve el destino borrado o null si no existía. Falla con 409 si tiene viajes (FK RESTRICT).
export async function deleteDestination(id) {
  try {
    const rows = await query(`DELETE FROM destinations WHERE id = $1 RETURNING ${COLS}`, [id])
    return rows[0] ? toDestination(rows[0]) : null
  } catch (e) {
    if (e.code === '23503') {
      throw new HttpError(409, 'No se puede eliminar: el destino tiene viajes asociados. Desactivá esos viajes y dejá el destino para reutilizarlo.')
    }
    throw e
  }
}

// De una lista de links, los que ningún destino usa (excepto "exceptId").
export async function unusedImages(urls, exceptId = 0) {
  if (!urls.length) return []
  const rows = await query(
    `SELECT u AS url FROM unnest($1::text[]) AS u
     WHERE NOT EXISTS (SELECT 1 FROM destinations d WHERE d.id <> $2 AND u = ANY (d.images))`,
    [urls, exceptId]
  )
  return rows.map((r) => r.url)
}
