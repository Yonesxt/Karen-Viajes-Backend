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

// Etiquetas <meta> de una vista previa (Open Graph + Twitter + descripción + robots).
export function metaTagsHtml({ title, description, image, url, imageIsSized = false, noindex = false }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(url)
  const img = image ? escapeHtml(image) : ''
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
    `<link rel="canonical" href="${u}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${u}">`,
    img && `<meta property="og:image" content="${img}">`,
    img && `<meta property="og:image:secure_url" content="${img}">`,
    img && `<meta property="og:image:alt" content="${t}">`,
    img && imageIsSized && '<meta property="og:image:width" content="1200">',
    img && imageIsSized && '<meta property="og:image:height" content="630">',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    img && `<meta name="twitter:image" content="${img}">`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Página para compartir (versión anterior, sigue funcionando para los links ya enviados): solo trae las
// etiquetas y lleva a la persona a la web.
export function renderSharePage({ title, description, image, shareUrl, targetUrl, imageIsSized = false }) {
  const target = escapeHtml(targetUrl)
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${metaTagsHtml({ title, description, image, url: shareUrl, imageIsSized, noindex: true })}
<noscript><meta http-equiv="refresh" content="0; url=${target}"></noscript>
<script>window.location.replace(${JSON.stringify(targetUrl).replace(/</g, '\\u003c')})</script>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px">
<p>Te estamos llevando a <a href="${target}">${escapeHtml(title)}</a>…</p>
</body>
</html>`
}

// Toma el index.html de la web (el front) y le cambia las etiquetas por las del viaje, para que
// WhatsApp, Instagram, Google, etc. vean el título, la descripción y la foto de ESE viaje en la dirección de la web.
export function injectHead(shell, meta) {
  const cleaned = shell
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+(?:name|property)=["'](?:og:[^"']*|twitter:[^"']*|description|robots)["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  const tags = metaTagsHtml(meta)
  return /<\/head>/i.test(cleaned) ? cleaned.replace(/<\/head>/i, `${tags}\n</head>`) : `${tags}\n${cleaned}`
}

// El index.html de la web se guarda unos segundos para no pedirlo en cada visita. Si la web no responde,
// se usa la última copia. Si nunca se pudo leer, devuelve null.
let shellCache = { html: null, at: 0 }
export const resetShellCache = () => {
  shellCache = { html: null, at: 0 }
}
export async function getFrontShell(frontUrl, { ttlMs = 30_000, fetchImpl = fetch, now = Date.now() } = {}) {
  if (shellCache.html && now - shellCache.at < ttlMs) return shellCache.html
  try {
    const res = await fetchImpl(`${frontUrl}/index.html`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'viajes-con-karen-api' } })
    if (res.ok) {
      const html = await res.text()
      if (/<div id="root"/i.test(html)) {
        shellCache = { html, at: now }
        return html
      }
    }
  } catch {
    /* se usa la copia anterior, si hay */
  }
  return shellCache.html
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
