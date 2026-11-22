export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { config } from '../../../../lib/config.js'
import { getDestination } from '../../../../lib/repo/destinations.js'
import { getTrip, publicTrips } from '../../../../lib/repo/trips.js'
import { parseId, route } from '../../../../lib/http.js'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, ogImageUrl, renderSharePage, tripShareText } from '../../../../lib/share.js'

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })

// Público. Es el link que se comparte por WhatsApp / Instagram: devuelve la vista previa del viaje
// (título, descripción y foto) y lleva a la persona a la web.
// Un viaje que no existe, está desactivado o venció muestra la tarjeta general de la agencia.
export const GET = route(async ({ request, params }) => {
  const front = config().frontUrl || new URL(request.url).origin
  const shareUrl = `${new URL(request.url).origin}/api/compartir/${params.id}`
  const generic = (target) =>
    html(renderSharePage({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, image: `${front}/og-default.jpg`, shareUrl, targetUrl: target, imageIsSized: true }))

  let id
  try {
    id = parseId(params.id)
  } catch {
    return generic(`${front}/`)
  }
  const found = await getTrip(id)
  const trip = found && found.active ? publicTrips([found])[0] : null
  if (!trip) return generic(`${front}/`)

  const destination = await getDestination(trip.destinationId)
  const { title, description } = tripShareText(trip, destination)
  const cover = destination?.images?.[0]
  const image = cover ? ogImageUrl(cover) : `${front}/og-default.jpg`
  return html(
    renderSharePage({
      title,
      description,
      image,
      shareUrl,
      targetUrl: `${front}/viaje/${trip.id}`,
      imageIsSized: !cover || image !== cover,
    })
  )
})
