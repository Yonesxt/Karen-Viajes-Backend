export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { listDestinations } from '../../../lib/repo/destinations.js'
import { listTrips } from '../../../lib/repo/trips.js'
import { json, route } from '../../../lib/http.js'

// Público: solo viajes activos (y los destinos que usan). Con sesión de admin: todo.
export const GET = route(async ({ session }) => {
  const admin = Boolean(session)
  const [trips, destinations] = await Promise.all([
    listTrips({ onlyActive: !admin }),
    listDestinations({ onlyUsedByActiveTrips: !admin }),
  ])
  const cache = admin
    ? { 'Cache-Control': 'private, no-store' }
    : { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60', Vary: 'Cookie' }
  return json({ trips, destinations }, 200, cache)
})
