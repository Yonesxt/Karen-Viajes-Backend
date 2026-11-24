export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { config } from '../../../../../lib/config.js'
import { getDestination } from '../../../../../lib/repo/destinations.js'
import { getTrip, publicTrips } from '../../../../../lib/repo/trips.js'
import { parseId, route } from '../../../../../lib/http.js'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, getFrontShell, injectHead, ogImageUrl, tripShareText } from '../../../../../lib/share.js'

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60' },
  })

// Es la página que ve quien abre  TU-WEB/viaje/ID  (la web redirige esa ruta acá con una regla de Render).
// Devuelve el mismo index.html de la web, con las etiquetas del viaje en el <head>. La aplicación arranca
// igual que siempre; la diferencia es que WhatsApp, Instagram y Google ya ven el título, la descripción y
// la foto de ese viaje, y que el link que se comparte es el de la propia web.
export const GET = route(async ({ params }) => {
  const front = config().frontUrl
  if (!front) return html('<p>Falta configurar FRONT_URL en el servidor.</p>', 503)
  const shell = await getFrontShell(front)
  if (!shell) return html('<p>La web no está disponible en este momento. Probá de nuevo en unos segundos.</p>', 503)

  const generic = (title, description, id) =>
    html(
      injectHead(shell, {
        title,
        description,
        image: `${front}/og-default.jpg`,
        url: id ? `${front}/viaje/${id}` : `${front}/`,
        imageIsSized: true,
        noindex: true, // viaje inexistente, desactivado o vencido: que no quede en Google
      })
    )

  let id
  try {
    id = parseId(params.id)
  } catch {
    return generic(DEFAULT_TITLE, DEFAULT_DESCRIPTION, null)
  }
  const found = await getTrip(id)
  if (!found || !found.active) return generic(DEFAULT_TITLE, DEFAULT_DESCRIPTION, null)
  const trip = publicTrips([found])[0]
  if (!trip) return generic('Viaje no disponible | Viajes con Karen', 'Este viaje ya no está disponible por fecha. Mirá todos nuestros viajes.', id)

  const destination = await getDestination(trip.destinationId)
  const { title, description } = tripShareText(trip, destination)
  const cover = destination?.images?.[0]
  const image = cover ? ogImageUrl(cover) : `${front}/og-default.jpg`
  return html(
    injectHead(shell, { title, description, image, url: `${front}/viaje/${trip.id}`, imageIsSized: !cover || image !== cover })
  )
})
