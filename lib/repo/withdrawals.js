import { query } from '../db.js'

const COLS = 'id, first_name, last_name, dni, email, phone, booking_code, mail_status, status, created_at'

export const toWithdrawal = (r) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  dni: r.dni,
  email: r.email,
  phone: r.phone,
  bookingCode: r.booking_code,
  mailStatus: r.mail_status,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
})

export async function createWithdrawal(w) {
  const rows = await query(
    `INSERT INTO withdrawals (first_name, last_name, dni, email, phone, booking_code)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
    [w.firstName, w.lastName, w.dni, w.email, w.phone, w.bookingCode]
  )
  return toWithdrawal(rows[0])
}

export async function setWithdrawalMailStatus(id, status) {
  await query('UPDATE withdrawals SET mail_status = $2 WHERE id = $1 RETURNING id', [id, status])
}

export async function listWithdrawals(limit = 500) {
  return (await query(`SELECT ${COLS} FROM withdrawals ORDER BY created_at DESC, id DESC LIMIT $1`, [limit])).map(toWithdrawal)
}

export async function setWithdrawalStatus(id, status) {
  const rows = await query(`UPDATE withdrawals SET status = $2 WHERE id = $1 RETURNING ${COLS}`, [id, status])
  return rows[0] ? toWithdrawal(rows[0]) : null
}
