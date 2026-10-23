export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { duplicateTrip } from '../../../../../lib/repo/trips.js'
import { HttpError, json, parseId, route } from '../../../../../lib/http.js'

export const POST = route(async ({ params }) => {
  const copy = await duplicateTrip(parseId(params.id))
  if (!copy) throw new HttpError(404, 'El viaje no existe.')
  return json(copy, 201)
}, { auth: true })
