export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { listDestinations } from '../../../lib/repo/destinations.js'
import { getSettings } from '../../../lib/repo/settings.js'
import { listTrips, publicTrips } from '../../../lib/repo/trips.js'
import { json, route } from '../../../lib/http.js'

// Público: solo viajes activos (y los destinos que usan). Con sesión de admin: todo.
export const GET = route(async ({ session }) => {
  const admin = Boolean(session)
  const [allTrips, allDestinations, settings] = await Promise.all([
    listTrips({ onlyActive: !admin }),
    listDestinations({ onlyUsedByActiveTrips: !admin }),
    getSettings(),
  ])
  // El público no ve las fechas pasadas ni los viajes que ya no tienen ninguna salida futura.
  const trips = admin ? allTrips : publicTrips(allTrips)
  const used = new Set(trips.map((t) => t.destinationId))
  const destinations = admin ? allDestinations : allDestinations.filter((d) => used.has(d.id))
  const cache = admin
    ? { 'Cache-Control': 'private, no-store' }
    : { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60', Vary: 'Cookie' }
  return json({ trips, destinations, settings }, 200, cache)
})
