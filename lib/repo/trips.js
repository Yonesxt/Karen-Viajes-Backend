import { query } from '../db.js'

const COLS = `id, category, destination_id, title, summary, currency, price, offer, nights,
  to_char(departure, 'YYYY-MM-DD') AS departure, origin, includes, hotel, airline, trip_kind, active, created_at, updated_at`
const iso = (d) => new Date(d).toISOString()

// Fila -> viaje con el formato que espera el front.
export function toTrip(r) {
  const trip = {
    id: r.id,
    category: r.category,
    destinationId: r.destination_id,
    title: r.title,
    summary: r.summary,
    currency: r.currency,
    price: r.price,
    offer: r.offer || null,
    nights: r.nights ?? null,
    departure: r.departure,
    from: r.origin,
    includes: r.includes || [],
    hotel: r.hotel ?? null,
    active: r.active,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
  if (r.category === 'vuelo') {
    trip.airline = r.airline
    trip.tripKind = r.trip_kind
  }
  return trip
}

export async function listTrips({ onlyActive = false } = {}) {
  const rows = await query(`SELECT ${COLS} FROM trips ${onlyActive ? 'WHERE active' : ''} ORDER BY id`)
  return rows.map(toTrip)
}

export async function getTrip(id) {
  const rows = await query(`SELECT ${COLS} FROM trips WHERE id = $1`, [id])
  return rows[0] ? toTrip(rows[0]) : null
}

const offerParam = (offer) => (offer ? JSON.stringify(offer) : null)

export async function createTrip(t) {
  const rows = await query(
    `INSERT INTO trips (category, destination_id, title, summary, currency, price, offer, nights, departure,
                        origin, includes, hotel, airline, trip_kind, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING ${COLS}`,
    [t.category, t.destinationId, t.title, t.summary, t.currency, t.price, offerParam(t.offer), t.nights, t.departure,
     t.from, t.includes, t.hotel, t.airline, t.tripKind, t.active]
  )
  return toTrip(rows[0])
}

export async function updateTrip(id, t) {
  const rows = await query(
    `UPDATE trips SET category = $2, destination_id = $3, title = $4, summary = $5, currency = $6, price = $7,
            offer = $8::jsonb, nights = $9, departure = $10, origin = $11, includes = $12, hotel = $13,
            airline = $14, trip_kind = $15, active = $16, updated_at = now()
     WHERE id = $1 RETURNING ${COLS}`,
    [id, t.category, t.destinationId, t.title, t.summary, t.currency, t.price, offerParam(t.offer), t.nights, t.departure,
     t.from, t.includes, t.hotel, t.airline, t.tripKind, t.active]
  )
  return rows[0] ? toTrip(rows[0]) : null
}

export async function setTripActive(id, active) {
  const rows = await query(`UPDATE trips SET active = $2, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id, active])
  return rows[0] ? toTrip(rows[0]) : null
}

export async function setTripOffer(id, offer) {
  const rows = await query(`UPDATE trips SET offer = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id, offerParam(offer)])
  return rows[0] ? toTrip(rows[0]) : null
}

// Copia desactivada y sin oferta (para armar un viaje parecido sin cargar todo de nuevo).
export async function duplicateTrip(id) {
  const rows = await query(
    `INSERT INTO trips (category, destination_id, title, summary, currency, price, offer, nights, departure,
                        origin, includes, hotel, airline, trip_kind, active)
     SELECT category, destination_id, left(title, 110) || ' (copia)', summary, currency, price, NULL, nights, departure,
            origin, includes, hotel, airline, trip_kind, false
     FROM trips WHERE id = $1
     RETURNING ${COLS}`,
    [id]
  )
  return rows[0] ? toTrip(rows[0]) : null
}
