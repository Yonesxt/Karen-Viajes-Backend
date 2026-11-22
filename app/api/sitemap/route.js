export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { config } from '../../../lib/config.js'
import { listTrips, publicTrips } from '../../../lib/repo/trips.js'
import { renderSitemap } from '../../../lib/share.js'
import { route } from '../../../lib/http.js'

// Público. Lista la portada y los viajes publicados (activos y con salidas futuras).
export const GET = route(async ({ request }) => {
  const front = config().frontUrl || new URL(request.url).origin
  const trips = publicTrips(await listTrips({ onlyActive: true }))
  return new Response(renderSitemap(front, trips), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=900' },
  })
})
