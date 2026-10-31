export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getSettings, updateSettings } from '../../../lib/repo/settings.js'
import { HttpError, json, readJson, route } from '../../../lib/http.js'
import { hasErrors, validateSettings } from '../../../lib/validation.js'

export const GET = route(async () => json(await getSettings()), { auth: true })

export const PUT = route(async ({ request }) => {
  const body = await readJson(request)
  const settings = { tripsPerPage: body.tripsPerPage }
  const errors = validateSettings(settings)
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los campos marcados.', errors)
  return json(await updateSettings(settings))
}, { auth: true })
