import { query } from '../db.js'
import { DEFAULT_TRIPS_PER_PAGE } from '../constants.js'

export async function getSettings() {
  const rows = await query(`SELECT value FROM settings WHERE key = 'tripsPerPage'`)
  const n = Number(rows[0]?.value)
  return { tripsPerPage: Number.isInteger(n) && n > 0 ? n : DEFAULT_TRIPS_PER_PAGE }
}

export async function updateSettings({ tripsPerPage }) {
  await query(
    `INSERT INTO settings (key, value) VALUES ('tripsPerPage', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`,
    [JSON.stringify(tripsPerPage)]
  )
  return getSettings()
}
