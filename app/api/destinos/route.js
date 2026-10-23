export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createDestination, listDestinations } from '../../../lib/repo/destinations.js'
import { HttpError, json, readJson, route } from '../../../lib/http.js'
import { hasErrors, normalizeDestination, validateDestination } from '../../../lib/validation.js'

export const GET = route(async () => json(await listDestinations()), { auth: true })

export const POST = route(async ({ request }) => {
  const dest = normalizeDestination(await readJson(request))
  if (dest.images == null) dest.images = []
  const errors = validateDestination(dest)
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los campos marcados.', errors)
  return json(await createDestination(dest), 201)
}, { auth: true })
