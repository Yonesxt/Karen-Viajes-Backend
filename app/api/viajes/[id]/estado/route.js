export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { setTripActive } from '../../../../../lib/repo/trips.js'
import { HttpError, json, parseId, readJson, route } from '../../../../../lib/http.js'

export const PATCH = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const { active } = await readJson(request)
  if (typeof active !== 'boolean') throw new HttpError(422, 'Indicá si el viaje queda activo o no.', { active: 'Tiene que ser true o false.' })
  const trip = await setTripActive(id, active)
  if (!trip) throw new HttpError(404, 'El viaje no existe.')
  return json(trip)
}, { auth: true })
