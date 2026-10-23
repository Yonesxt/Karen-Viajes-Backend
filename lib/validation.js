// Validación y normalización de lo que llega a la API. Las reglas y los mensajes son los mismos
// que usa el formulario del front (src/utils/validation.js), más límites de largo y de tipo,
// porque el servidor nunca debe confiar en lo que manda el navegador.
import { CATEGORIES, CURRENCIES, INQUIRY_CHANNELS, INQUIRY_SOURCES, MAX_PRICE, SCOPES } from './constants.js'

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) &&
  new Date(`${s}T12:00:00Z`).toISOString().startsWith(s)
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const optStr = (v) => str(v) || null
const int = (v) => (typeof v === 'number' && Number.isInteger(v) ? v : null)

export const hasErrors = (errors) => Object.keys(errors).length > 0
export { isDate }

// ───────── Ofertas ─────────
export function normalizeOffer(o) {
  if (o == null) return null
  if (typeof o !== 'object' || Array.isArray(o)) return { type: '?' }
  const until = str(o.until)
  if (o.type === 'discount') return { type: 'discount', price: o.price, ...(until ? { until } : {}) }
  if (o.type === 'promo') {
    const note = str(o.note)
    return { type: 'promo', label: str(o.label), ...(note ? { note } : {}), ...(until ? { until } : {}) }
  }
  return { type: '?' }
}

export function validateOffer(offer, price) {
  const e = {}
  if (!offer) return e
  if (offer.type === 'discount') {
    if (int(offer.price) == null || offer.price <= 0) e.offerPrice = 'Ingresá un precio entero mayor a 0.'
    else if (Number.isInteger(price) && offer.price >= price) e.offerPrice = 'El precio de oferta debe ser menor al precio normal.'
  } else if (offer.type === 'promo') {
    if (!offer.label) e.offerLabel = 'Indicá la promo (por ejemplo 2x1 o 3x2).'
    else if (offer.label.length > 16) e.offerLabel = 'Máximo 16 caracteres.'
    if (offer.note && offer.note.length > 160) e.offerNote = 'Máximo 160 caracteres.'
  } else {
    e.offerType = 'Tipo de oferta inválido.'
  }
  if (offer.until && !isDate(offer.until)) e.offerUntil = 'Fecha inválida.'
  return e
}

// ───────── Viajes ─────────
export function normalizeTrip(b) {
  const category = str(b.category)
  const isFlight = category === 'vuelo'
  return {
    category,
    destinationId: int(b.destinationId),
    title: str(b.title),
    summary: str(b.summary),
    currency: str(b.currency),
    price: int(b.price),
    offer: normalizeOffer(b.offer),
    nights: isFlight ? (b.nights == null ? null : int(b.nights) ?? NaN) : int(b.nights),
    departure: str(b.departure),
    from: str(b.from),
    includes: Array.isArray(b.includes) ? b.includes.filter((i) => typeof i === 'string').map((i) => i.trim()).filter(Boolean) : [],
    hotel: isFlight ? null : optStr(b.hotel),
    airline: isFlight ? str(b.airline) : null,
    tripKind: isFlight ? str(b.tripKind) : null,
    active: b.active !== false,
  }
}

// destinationExists: función (id) => boolean, la resuelve el llamador con la base de datos.
export function validateTrip(t, { destinationExists }) {
  const e = {}
  if (!CATEGORIES.includes(t.category)) e.category = 'Elegí un tipo de viaje.'
  if (t.destinationId == null || !destinationExists(t.destinationId)) e.destinationId = 'Elegí un destino.'
  if (t.title.length < 3) e.title = 'Escribí un título (mínimo 3 letras).'
  else if (t.title.length > 120) e.title = 'El título admite hasta 120 caracteres.'
  if (!CURRENCIES.includes(t.currency)) e.currency = 'Elegí la moneda.'
  if (t.price == null || t.price <= 0) e.price = 'Ingresá un precio entero mayor a 0.'
  else if (t.price > MAX_PRICE) e.price = 'El precio es demasiado alto.'
  if (!isDate(t.departure)) e.departure = 'Elegí la fecha de salida.'
  if (!t.from) e.from = 'Indicá desde dónde sale.'
  else if (t.from.length > 120) e.from = 'Máximo 120 caracteres.'
  if (t.summary.length < 10) e.summary = 'Escribí un resumen (mínimo 10 letras).'
  else if (t.summary.length > 2000) e.summary = 'El resumen admite hasta 2000 caracteres.'
  if (t.includes.length === 0) e.includes = 'Agregá al menos un ítem de lo que incluye.'
  else if (t.includes.length > 40 || t.includes.some((i) => i.length > 200)) e.includes = 'Máximo 40 ítems de hasta 200 caracteres.'
  if (t.hotel && t.hotel.length > 300) e.hotel = 'Máximo 300 caracteres.'
  if (t.category === 'vuelo') {
    if (t.nights != null) e.nights = 'Los vuelos no llevan noches.'
    if (!t.airline) e.airline = 'Indicá la aerolínea.'
    else if (t.airline.length > 80) e.airline = 'Máximo 80 caracteres.'
    if (!t.tripKind) e.tripKind = 'Indicá el tipo de pasaje.'
    else if (t.tripKind.length > 60) e.tripKind = 'Máximo 60 caracteres.'
  } else if (t.nights == null || t.nights <= 0 || t.nights > 400) {
    e.nights = 'Ingresá la cantidad de noches (entero mayor a 0).'
  }
  Object.assign(e, validateOffer(t.offer, t.price ?? undefined))
  return e
}

// ───────── Destinos ─────────
export const isHttpsUrl = (s) => typeof s === 'string' && s.length <= 2048 && /^https:\/\/\S+$/i.test(s)

export function normalizeDestination(b) {
  const images = Array.isArray(b.images) ? b.images.map((i) => (typeof i === 'string' ? i.trim() : i)) : null
  return {
    name: str(b.name),
    country: str(b.country),
    scope: str(b.scope),
    // sin repetidos y conservando el orden (la primera es la portada)
    images: images ? [...new Set(images)] : null,
  }
}

export function validateDestination(d) {
  const e = {}
  if (d.name.length < 2) e.name = 'Escribí el nombre del destino.'
  else if (d.name.length > 120) e.name = 'Máximo 120 caracteres.'
  if (!d.country) e.country = 'Indicá el país.'
  else if (d.country.length > 120) e.country = 'Máximo 120 caracteres.'
  if (!SCOPES.includes(d.scope)) e.scope = 'Elegí si es nacional o internacional.'
  if (!Array.isArray(d.images)) e.images = 'Las imágenes tienen que ser una lista de links.'
  else if (d.images.length > 20) e.images = 'Máximo 20 imágenes por destino.'
  else if (d.images.some((src) => !isHttpsUrl(src))) {
    e.images = 'Hay imágenes con un link inválido (tienen que ser links https).'
  }
  return e
}

// ───────── Consultas ─────────
const isPhone = (s) => /^[0-9+()\-.\s]{6,40}$/.test(s) && (s.match(/\d/g) || []).length >= 6

export function normalizeInquiry(b) {
  return {
    name: str(b.name),
    email: str(b.email),
    phone: str(b.phone),
    subject: str(b.subject),
    message: str(b.message),
    tripId: int(b.tripId),
    source: INQUIRY_SOURCES.includes(b.source) ? b.source : 'web',
    channel: INQUIRY_CHANNELS.includes(b.channel) ? b.channel : 'formulario',
  }
}

export function validateInquiry(i) {
  const e = {}
  if (!i.name) e.name = 'Ingresá tu nombre.'
  else if (i.name.length > 120) e.name = 'Máximo 120 caracteres.'
  if (!i.message) e.message = 'Escribí tu consulta.'
  else if (i.message.length > 4000) e.message = 'La consulta admite hasta 4000 caracteres.'
  if (i.email && (i.email.length > 160 || !/^\S+@\S+\.\S+$/.test(i.email))) e.email = 'El e-mail no es válido.'
  if (i.phone && !isPhone(i.phone)) e.phone = 'Ingresá un teléfono válido con al menos 6 números. Podés usar +, espacios, paréntesis o guiones.'
  if (!i.email && !i.phone) e.contact = 'Dejanos un e-mail o un teléfono para responderte.'
  if (i.subject.length > 200) e.subject = 'Máximo 200 caracteres.'
  return e
}
