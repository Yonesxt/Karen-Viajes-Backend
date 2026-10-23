import { query } from '../db.js'

export async function findAdminByEmail(email) {
  const rows = await query('SELECT id, email, name, password_hash FROM admins WHERE email = $1', [email.trim().toLowerCase()])
  return rows[0] || null
}

// Crea el administrador o, si el e-mail ya existe, le cambia la contraseña.
export async function upsertAdmin({ email, name, passwordHash }) {
  const rows = await query(
    `INSERT INTO admins (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
     RETURNING id, email, name, (xmax = 0) AS created`,
    [email.trim().toLowerCase(), name || 'Administrador', passwordHash]
  )
  return rows[0]
}
