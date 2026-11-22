// Páginas "para compartir": HTML mínimo con las etiquetas Open Graph de un viaje.
// WhatsApp, Instagram, Facebook, Telegram, etc. NO ejecutan JavaScript al armar la vista previa, y el front
// es una app de una sola página (todas las direcciones devuelven el mismo HTML). Por eso el link que se
// comparte apunta a esta página, que tiene el título, la descripción y la foto de ESE viaje, y que
// a las personas las lleva directo a la web.
import { todayAR } from './repo/trips.js'

export const SITE_NAME = 'Viajes con Karen'
export const DEFAULT_TITLE = 'Viajes con Karen | Paquetes, cruceros, hoteles y vuelos desde Paraná'
export const DEFAULT_DESCRIPTION =
  'Agencia de viajes en Paraná, Entre Ríos. Paquetes, cruceros, hoteles y vuelos a todo el mundo, y viajes a tu medida. Consultá sin compromiso.'

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const truncate = (s, max) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

const money = (n, currency) => `${currency === 'ARS' ? '$' : 'USD'} ${Number(n).toLocaleString('es-AR')}`
const dateAR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

// Cloudinary: pide la foto ya recortada a 1200x630 y liviana (WhatsApp descarta imágenes muy pesadas).
// Otras imágenes se usan tal cual.
export function ogImageUrl(url) {
  if (typeof url !== 'string') return null
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\/upload\/[^/]*(c_fill|w_1200)/.test(url)) {
    return url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_1200,h_630,q_auto:good,f_jpg/')
  }
  return url
}

export function priceText(trip) {
  const offer = trip.offer
  if (offer?.type === 'discount' && offer.price < trip.price && !(offer.until && offer.until < todayAR())) {
    return `Oferta ${money(offer.price, trip.currency)} (antes ${money(trip.price, trip.currency)})`
  }
  if (offer?.type === 'promo' && !(offer.until && offer.until < todayAR())) {
    return `Promo ${offer.label} · desde ${money(trip.price, trip.currency)}`
  }
  return `Desde ${money(trip.price, trip.currency)}`
}

// Título y descripción de la vista previa de un viaje.
export function tripShareText(trip, destination) {
  const place = destination ? `${destination.name}, ${destination.country}` : ''
  const title = truncate(place ? `${trip.title} – ${place}` : trip.title, 90)
  const parts = []
  if (trip.nights != null) parts.push(trip.nights === 0 ? 'Viaje en el día' : `${trip.nights} ${trip.nights === 1 ? 'noche' : 'noches'}`)
  const dates = trip.departures || [trip.departure]
  parts.push(dates.length > 1 ? `${dates.length} fechas de salida (próxima ${dateAR(dates[0])})` : `Salida ${dateAR(dates[0])}`)
  parts.push(priceText(trip))
  const description = truncate(`${parts.join(' · ')}. ${trip.summary}`, 200)
  return { title: `${title} | ${SITE_NAME}`, description }
}

export function renderSharePage({ title, description, image, shareUrl, targetUrl, imageIsSized = false }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const target = escapeHtml(targetUrl)
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">\n<meta property="og:image:secure_url" content="${escapeHtml(image)}">\n<meta property="og:image:alt" content="${t}">` : ''}
${image && imageIsSized ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
<noscript><meta http-equiv="refresh" content="0; url=${target}"></noscript>
<script>window.location.replace(${JSON.stringify(targetUrl).replace(/</g, '\\u003c')})</script>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px">
<p>Te estamos llevando a <a href="${target}">${t}</a>…</p>
</body>
</html>`
}

// Sitemap XML con la portada y los viajes publicados.
export function renderSitemap(front, trips) {
  const urls = [{ loc: `${front}/`, lastmod: null }, ...trips.map((t) => ({ loc: `${front}/viaje/${t.id}`, lastmod: t.updatedAt?.slice(0, 10) }))]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
}
