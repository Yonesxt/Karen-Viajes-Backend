export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { deleteDestination, getDestination, updateDestination } from '../../../../lib/repo/destinations.js'
import { cleanupImages } from '../../../../lib/imageCleanup.js'
import { HttpError, json, parseId, readJson, route } from '../../../../lib/http.js'
import { hasErrors, normalizeDestination, validateDestination } from '../../../../lib/validation.js'

export const PUT = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const dest = normalizeDestination(await readJson(request))
  const errors = validateDestination(dest)
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los campos marcados.', errors)
  const before = await getDestination(id)
  if (!before) throw new HttpError(404, 'El destino no existe.')
  const updated = await updateDestination(id, dest)
  if (!updated) throw new HttpError(404, 'El destino no existe.')
  await cleanupImages(before.images.filter((u) => !updated.images.includes(u)), id)
  return json(updated)
}, { auth: true })

export const DELETE = route(async ({ params }) => {
  const removed = await deleteDestination(parseId(params.id))
  if (!removed) throw new HttpError(404, 'El destino no existe.')
  await cleanupImages(removed.images)
  return json({ id: removed.id })
}, { auth: true })
