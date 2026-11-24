export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { tripAvailability } from '../../../../../lib/repo/trips.js'
import { json, parseId, route } from '../../../../../lib/http.js'

// Público. La web lo usa cuando alguien abre un viaje que no está en el catálogo, para saber por qué:
//   expired  -> ya pasaron todas las salidas ("no disponible por fecha")
//   inactive / missing -> se manda a la portada
export const GET = route(async ({ params }) => {
  let id
  try {
    id = parseId(params.id)
  } catch {
    return json({ status: 'missing' }, 200, { 'Cache-Control': 'public, s-maxage=30' })
  }
  return json(await tripAvailability(id), 200, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' })
})
