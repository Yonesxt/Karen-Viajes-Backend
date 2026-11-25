export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { setWithdrawalStatus } from '../../../../lib/repo/withdrawals.js'
import { INQUIRY_STATUSES } from '../../../../lib/constants.js'
import { HttpError, json, parseId, readJson, route } from '../../../../lib/http.js'

// Solo se puede marcar como atendida / nueva. No hay DELETE: es una constancia legal.
export const PATCH = route(async ({ request, params }) => {
  const id = parseId(params.id)
  const { status } = await readJson(request)
  if (!INQUIRY_STATUSES.includes(status)) throw new HttpError(422, 'Estado inválido.', { status: 'Tiene que ser "nueva" o "atendida".' })
  const updated = await setWithdrawalStatus(id, status)
  if (!updated) throw new HttpError(404, 'La solicitud no existe.')
  return json(updated)
}, { auth: true })
