export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getTrip, setTripOffer } from '../../../../../lib/repo/trips.js'
import { HttpError, json, parseId, readJson, route } from '../../../../../lib/http.js'
import { hasErrors, normalizeOffer, validateOffer } from '../../../../../lib/validation.js'

// El cuerpo es la oferta: { type: 'discount', price, until? } o { type: 'promo', label, note?, until? }
export const PUT = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const body = await readJson(request)
  const offer = normalizeOffer(body.offer !== undefined ? body.offer : body)
  const current = await getTrip(id)
  if (!current) throw new HttpError(404, 'El viaje no existe.')
  const errors = offer ? validateOffer(offer, current.price) : { offerType: 'Indicá la oferta.' }
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá la oferta.', errors)
  return json(await setTripOffer(id, offer))
}, { auth: true })

export const DELETE = route(async ({ params }) => {
  const trip = await setTripOffer(parseId(params.id), null)
  if (!trip) throw new HttpError(404, 'El viaje no existe.')
  return json(trip)
}, { auth: true })
