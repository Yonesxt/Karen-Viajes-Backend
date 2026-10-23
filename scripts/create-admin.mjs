// Crea (o actualiza la contraseña de) un administrador:
//   npm run admin:create -- correo@dominio.com "MiContraseñaLarga" "Nombre"
// o con ADMIN_EMAIL / ADMIN_PASSWORD en el .env.
import './_env.mjs'
import { closePool } from '../lib/db.js'
import { hashPassword } from '../lib/password.js'
import { upsertAdmin } from '../lib/repo/admins.js'

const [, , argEmail, argPassword, argName] = process.argv
const email = (argEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = argPassword || process.env.ADMIN_PASSWORD || ''

if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Indicá un e-mail válido.')
  process.exit(1)
}
if (password.length < 10) {
  console.error('La contraseña tiene que tener al menos 10 caracteres.')
  process.exit(1)
}

try {
  const admin = await upsertAdmin({ email, name: argName || 'Administrador', passwordHash: await hashPassword(password) })
  console.log(admin.created ? `Administrador creado: ${admin.email}` : `Contraseña actualizada: ${admin.email}`)
} catch (e) {
  console.error('No se pudo crear el administrador:', e.message)
  process.exitCode = 1
} finally {
  await closePool()
}
