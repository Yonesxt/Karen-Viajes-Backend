export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { imageProxyLimiter } from '../../../lib/limiters.js'
import { query } from '../../../lib/db.js'
import { HttpError, route } from '../../../lib/http.js'
import { isHttpsUrl } from '../../../lib/validation.js'

const MAX_BYTES = 8 * 1024 * 1024

// Reenvía una foto del catálogo para que el navegador pueda dibujarla en la imagen de la historia de Instagram.
// Muchas webs (hoteles, etc.) no permiten leer sus fotos desde otra página; el servidor sí puede pedirlas.
// Seguridad: SOLO reenvía links que ya están guardados como fotos de un destino o de un viaje (los carga el admin),
// así no sirve para pedir cualquier dirección de internet.
export const GET = route(async ({ request, ip }) => {
  const rl = imageProxyLimiter.hit(ip)
  if (!rl.ok) throw new HttpError(429, 'Demasiados pedidos de imágenes.', null, { 'Retry-After': String(rl.retryAfterSec) })

  const url = new URL(request.url).searchParams.get('url') || ''
  if (!isHttpsUrl(url)) throw new HttpError(400, 'Link inválido.')
  const known = await query(
    `SELECT 1 AS ok FROM destinations WHERE $1 = ANY(images)
     UNION ALL SELECT 1 FROM trips WHERE $1 = ANY(hotel_images) OR $1 = ANY(tour_images)
     LIMIT 1`,
    [url]
  )
  if (!known.length) throw new HttpError(404, 'La imagen no es parte del catálogo.')

  let upstream
  try {
    upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ViajesConKaren/1.0)', Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new HttpError(502, 'No se pudo obtener la imagen.')
  }
  if (!upstream.ok) throw new HttpError(502, 'No se pudo obtener la imagen.')
  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) throw new HttpError(415, 'El link no es una imagen.')
  const declared = Number(upstream.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) throw new HttpError(413, 'La imagen es demasiado grande.')
  const bytes = Buffer.from(await upstream.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'La imagen es demasiado grande.')

  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  })
})
