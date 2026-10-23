export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { destinationExists } from '../../../../lib/repo/destinations.js'
import { getTrip, updateTrip } from '../../../../lib/repo/trips.js'
import { HttpError, json, parseId, readJson, route } from '../../../../lib/http.js'
import { hasErrors, normalizeTrip, validateTrip } from '../../../../lib/validation.js'

export const GET = route(async ({ params }) => {
  const trip = await getTrip(parseId(params.id))
  if (!trip) throw new HttpError(404, 'El viaje no existe.')
  return json(trip)
}, { auth: true })

export const PUT = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const trip = normalizeTrip(await readJson(request))
  const destOk = trip.destinationId != null && (await destinationExists(trip.destinationId))
  const errors = validateTrip(trip, { destinationExists: () => destOk })
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los campos marcados.', errors)
  const updated = await updateTrip(id, trip)
  if (!updated) throw new HttpError(404, 'El viaje no existe.')
  return json(updated)
}, { auth: true })
