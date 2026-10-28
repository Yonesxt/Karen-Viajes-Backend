export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { destinationExists } from '../../../lib/repo/destinations.js'
import { createTrip } from '../../../lib/repo/trips.js'
import { HttpError, json, readJson, route } from '../../../lib/http.js'
import { hasErrors, normalizeTrip, validateTrip } from '../../../lib/validation.js'

export const POST = route(async ({ request }) => {
  const trip = normalizeTrip(await readJson(request))
  const destOk = trip.destinationId != null && (await destinationExists(trip.destinationId))
  const errors = validateTrip(trip, { destinationExists: () => destOk })
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los campos marcados.', errors)
  return json(await createTrip(trip), 201)
}, { auth: true })
