// Carga los datos de ejemplo. Solo si las tablas están vacías (o con { force: true }, que las vacía).
import { SEED_DESTINATIONS, SEED_TRIPS } from '../db/seed-data.js'
import { query } from './db.js'

export async function seedCatalog({ force = false } = {}) {
  const [{ n }] = await query('SELECT (SELECT count(*) FROM destinations) + (SELECT count(*) FROM trips) AS n')
  if (Number(n) > 0 && !force) return { skipped: true }
  if (force) await query('TRUNCATE inquiries, trips, destinations RESTART IDENTITY')

  await query(
    `INSERT INTO destinations (id, name, country, scope, images)
     SELECT x.id, x.name, x.country, x.scope, ARRAY(SELECT jsonb_array_elements_text(x.images))
     FROM jsonb_to_recordset($1::jsonb) AS x(id int, name text, country text, scope text, images jsonb)
     RETURNING id`,
    [JSON.stringify(SEED_DESTINATIONS)]
  )
  await query(
    `INSERT INTO trips (id, category, destination_id, title, summary, currency, price, offer, nights, departure,
                        origin, includes, hotel, airline, trip_kind, active)
     SELECT x.id, x.category, x."destinationId", x.title, x.summary, x.currency, x.price, x.offer, x.nights, x.departure::date,
            x."from", ARRAY(SELECT jsonb_array_elements_text(x.includes)), x.hotel, x.airline, x."tripKind", COALESCE(x.active, true)
     FROM jsonb_to_recordset($1::jsonb) AS x(
       id int, category text, "destinationId" int, title text, summary text, currency text, price int, offer jsonb,
       nights int, departure text, "from" text, includes jsonb, hotel text, airline text, "tripKind" text, active boolean)
     RETURNING id`,
    [JSON.stringify(SEED_TRIPS)]
  )
  await query(`SELECT setval(pg_get_serial_sequence('destinations', 'id'), (SELECT max(id) FROM destinations)) AS s`)
  await query(`SELECT setval(pg_get_serial_sequence('trips', 'id'), (SELECT max(id) FROM trips)) AS s`)
  return { skipped: false, destinations: SEED_DESTINATIONS.length, trips: SEED_TRIPS.length }
}
