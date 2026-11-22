export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { statsLimiter } from '../../../../lib/limiters.js'
import { recordEvent, STAT_KINDS } from '../../../../lib/repo/stats.js'
import { HttpError, json, readJson, route } from '../../../../lib/http.js'

// Robots de buscadores y similares: no se cuentan como visitas.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|curl|wget|python|node-fetch|axios/i

// Público: la web avisa que se vio un viaje ("view") o que se tocó el botón de WhatsApp ("whatsapp").
// Solo suma 1 a un contador diario: no guarda IP, navegador ni nada de la persona.
export const POST = route(async ({ request, session, ip }) => {
  const rl = statsLimiter.hit(ip)
  if (!rl.ok) throw new HttpError(429, 'Demasiados eventos.', null, { 'Retry-After': String(rl.retryAfterSec) })
  const body = await readJson(request)
  const tripId = Number.isInteger(body.tripId) && body.tripId > 0 && body.tripId <= 2_147_483_647 ? body.tripId : null
  if (tripId == null || !STAT_KINDS.includes(body.kind)) throw new HttpError(422, 'Evento inválido.')
  // las visitas de la administradora y de los robots no cuentan
  if (session || BOT.test(request.headers.get('user-agent') || '')) return json({ counted: false })
  return json({ counted: await recordEvent(tripId, body.kind) })
})
