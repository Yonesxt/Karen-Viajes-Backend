export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { deleteInquiry, setInquiryStatus } from '../../../../lib/repo/inquiries.js'
import { INQUIRY_STATUSES } from '../../../../lib/constants.js'
import { HttpError, json, parseId, readJson, route } from '../../../../lib/http.js'

export const PATCH = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const { status } = await readJson(request)
  if (!INQUIRY_STATUSES.includes(status)) throw new HttpError(422, 'Estado inválido.', { status: 'Tiene que ser "nueva" o "atendida".' })
  const updated = await setInquiryStatus(id, status)
  if (!updated) throw new HttpError(404, 'La consulta no existe.')
  return json(updated)
}, { auth: true })

export const DELETE = route(async ({ params }) => {
  const removed = await deleteInquiry(parseId(params.id))
  if (!removed) throw new HttpError(404, 'La consulta no existe.')
  return json(removed)
}, { auth: true })
