// Carga los destinos y viajes de ejemplo:  npm run db:seed   (agregá --force para vaciar y recargar)
import './_env.mjs'
import { closePool } from '../lib/db.js'
import { seedCatalog } from '../lib/seed.js'

try {
  const res = await seedCatalog({ force: process.argv.includes('--force') })
  console.log(res.skipped ? 'Ya hay datos cargados: no se hizo nada (usá --force para recargar).' : `Listo: ${res.destinations} destinos y ${res.trips} viajes.`)
} catch (e) {
  console.error('Error al cargar los datos:', e.message)
  process.exitCode = 1
} finally {
  await closePool()
}
