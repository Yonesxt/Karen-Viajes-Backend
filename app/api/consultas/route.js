export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { inquiryLimiter } from '../../../lib/limiters.js'
import { createInquiry, listInquiries } from '../../../lib/repo/inquiries.js'
import { HttpError, json, readJson, route } from '../../../lib/http.js'
import { hasErrors, normalizeInquiry, validateInquiry } from '../../../lib/validation.js'

// Público: lo usan los formularios de la web.
export const POST = route(async ({ request, ip }) => {
  const rl = inquiryLimiter.hit(ip)
  if (!rl.ok) {
    throw new HttpError(429, 'Enviaste muchas consultas seguidas. Probá de nuevo en unos minutos.', null, { 'Retry-After': String(rl.retryAfterSec) })
  }
  const inquiry = normalizeInquiry(await readJson(request))
  const errors = validateInquiry(inquiry)
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los datos de la consulta.', errors)
  return json(await createInquiry(inquiry), 201)
})

export const GET = route(async () => json(await listInquiries()), { auth: true })
