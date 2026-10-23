import { query } from '../db.js'

const COLS = 'id, name, email, phone, subject, message, trip_id, trip_title, source, channel, status, created_at'

export const toInquiry = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  subject: r.subject,
  message: r.message,
  tripId: r.trip_id ?? null,
  tripTitle: r.trip_title ?? null,
  source: r.source,
  channel: r.channel,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
})

export async function createInquiry(i) {
  // El título del viaje se toma de la base (no del navegador) para que no se pueda falsear.
  const rows = await query(
    `INSERT INTO inquiries (name, email, phone, subject, message, trip_id, trip_title, source, channel)
     VALUES ($1, $2, $3, $4, $5,
             (SELECT id FROM trips WHERE id = $6::integer),
             (SELECT title FROM trips WHERE id = $6::integer),
             $7, $8)
     RETURNING ${COLS}`,
    [i.name, i.email, i.phone, i.subject, i.message, i.tripId, i.source, i.channel]
  )
  return toInquiry(rows[0])
}

export async function listInquiries(limit = 1000) {
  return (await query(`SELECT ${COLS} FROM inquiries ORDER BY created_at DESC, id DESC LIMIT $1`, [limit])).map(toInquiry)
}

export async function setInquiryStatus(id, status) {
  const rows = await query(`UPDATE inquiries SET status = $2 WHERE id = $1 RETURNING ${COLS}`, [id, status])
  return rows[0] ? toInquiry(rows[0]) : null
}

export async function deleteInquiry(id) {
  const rows = await query('DELETE FROM inquiries WHERE id = $1 RETURNING id', [id])
  return rows[0] ? { id: rows[0].id } : null
}
