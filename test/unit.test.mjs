import './helpers/setup.mjs'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { signToken, verifyToken } from '../lib/jwt.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createLimiter } from '../lib/rateLimit.js'
import { buildCorsHeaders } from '../lib/cors.js'
import { parseCookies } from '../lib/auth.js'
import { ALLOWED_FORMATS, createUploadSignature, deleteImage, publicIdFromUrl, signParams } from '../lib/cloudinary.js'
import { hasErrors, isDate, normalizeDestination, normalizeInquiry, normalizeTrip, validateDestination, validateInquiry, validateOffer, validateTrip } from '../lib/validation.js'

test('JWT: firma, verifica, detecta alteraciones, vencimiento y alg=none', () => {
  const t = signToken({ sub: 1, email: 'a@b.com' }, { expiresInSec: 60 })
  assert.equal(verifyToken(t).email, 'a@b.com')
  const [h, b, s] = t.split('.')
  const evil = Buffer.from(JSON.stringify({ sub: 2, email: 'x@y.com', exp: 9999999999 })).toString('base64url')
  assert.equal(verifyToken(`${h}.${evil}.${s}`), null, 'payload alterado')
  assert.equal(verifyToken(`${h}.${b}.${s.slice(0, -2)}AA`), null, 'firma alterada')
  assert.equal(verifyToken(signToken({ sub: 1 }, { expiresInSec: -10 })), null, 'vencido')
  const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${b}.`
  assert.equal(verifyToken(none), null, 'alg none')
  const otherKey = createHmac('sha256', 'otra-clave-distinta-otra-clave-distinta').update(`${h}.${b}`).digest('base64url')
  assert.equal(verifyToken(`${h}.${b}.${otherKey}`), null, 'otra clave')
  assert.equal(verifyToken('basura'), null)
  assert.equal(verifyToken(undefined), null)
})

test('JWT: sin secreto o muy corto se rechaza', () => {
  const old = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'corto'
  assert.throws(() => signToken({}, { expiresInSec: 5 }), /JWT_SECRET/)
  process.env.JWT_SECRET = old
})

test('contraseñas: hash distinto cada vez, verifica bien y mal', async () => {
  const h1 = await hashPassword('Contraseña-Larga-1')
  const h2 = await hashPassword('Contraseña-Larga-1')
  assert.notEqual(h1, h2)
  assert.match(h1, /^scrypt\$16384\$8\$1\$/)
  assert.equal(await verifyPassword('Contraseña-Larga-1', h1), true)
  assert.equal(await verifyPassword('contraseña-larga-1', h1), false)
  assert.equal(await verifyPassword('x', 'formato-invalido'), false)
})

test('limitador: bloquea al pasar el máximo y se libera con la ventana', () => {
  const l = createLimiter({ max: 2, windowMs: 1000 })
  assert.equal(l.hit('a', 0).ok, true)
  assert.equal(l.hit('a', 1).ok, true)
  const third = l.hit('a', 2)
  assert.equal(third.ok, false)
  assert.ok(third.retryAfterSec >= 1)
  assert.equal(l.hit('b', 2).ok, true)
  assert.equal(l.hit('a', 1500).ok, true)
})

test('CORS: solo orígenes permitidos', () => {
  const allowed = ['http://localhost:5173']
  const ok = buildCorsHeaders('http://localhost:5173', allowed)
  assert.equal(ok['Access-Control-Allow-Origin'], 'http://localhost:5173')
  assert.equal(ok['Access-Control-Allow-Credentials'], 'true')
  const bad = buildCorsHeaders('https://malo.com', allowed)
  assert.equal(bad['Access-Control-Allow-Origin'], undefined)
  assert.equal(buildCorsHeaders(null, allowed)['Access-Control-Allow-Origin'], undefined)
  assert.match(ok['Access-Control-Allow-Headers'], /Authorization/)
})

test('cookies: parseo básico', () => {
  assert.deepEqual(parseCookies('a=1; vck_session=abc.def; b=%20x'), { a: '1', vck_session: 'abc.def', b: ' x' })
  assert.deepEqual(parseCookies(null), {})
})

test('Cloudinary: la firma coincide con el ejemplo de la documentación oficial', () => {
  const sig = signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e')
})

test('Cloudinary: firma de subida e id público de las imágenes', async () => {
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'micloud', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'secreto', CLOUDINARY_FOLDER: 'viajes-con-karen' })
  const s = createUploadSignature(1_700_000_000_000)
  assert.equal(s.timestamp, 1_700_000_000)
  assert.equal(s.uploadUrl, 'https://api.cloudinary.com/v1_1/micloud/image/upload')
  assert.equal(s.signature, signParams({ allowed_formats: ALLOWED_FORMATS, folder: 'viajes-con-karen', timestamp: 1_700_000_000 }, 'secreto'))
  assert.equal(s.apiSecret, undefined, 'el secreto nunca sale')

  assert.equal(publicIdFromUrl('https://res.cloudinary.com/micloud/image/upload/v169/viajes-con-karen/abc123.jpg'), 'viajes-con-karen/abc123')
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/micloud/image/upload/viajes-con-karen/sub/x.webp'), 'viajes-con-karen/sub/x')
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/otro/image/upload/v1/viajes-con-karen/a.jpg'), null, 'otra cuenta')
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/micloud/image/upload/v1/otra-carpeta/a.jpg'), null, 'otra carpeta')
  assert.equal(publicIdFromUrl('https://ejemplo.com/foto.jpg'), null)
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/micloud/image/upload/v1/viajes-con-karen/../x/a.jpg'), null, 'traversal')

  let sent
  const ok = await deleteImage('https://res.cloudinary.com/micloud/image/upload/v1/viajes-con-karen/a.jpg', async (url, init) => {
    sent = { url, body: Object.fromEntries(init.body) }
    return { ok: true }
  })
  assert.equal(ok, true)
  assert.equal(sent.url, 'https://api.cloudinary.com/v1_1/micloud/image/destroy')
  assert.equal(sent.body.public_id, 'viajes-con-karen/a')
  assert.equal(sent.body.signature, signParams({ public_id: 'viajes-con-karen/a', timestamp: sent.body.timestamp }, 'secreto'))
  assert.equal(await deleteImage('https://ejemplo.com/a.jpg', async () => assert.fail('no debe llamar')), false)
  for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[k]
})

const okTrip = {
  category: 'paquete', destinationId: 1, title: 'Caribe', summary: 'Una semana en el Caribe.', currency: 'USD', price: 1000,
  nights: 7, departure: '2027-05-01', from: 'Buenos Aires', includes: ['Aéreo'], hotel: null, offer: null,
}
const check = (over, dest = true) => validateTrip(normalizeTrip({ ...okTrip, ...over }), { destinationExists: () => dest })

test('validación de viajes', () => {
  assert.deepEqual(check({}), {})
  assert.ok(check({ category: 'auto' }).category)
  assert.ok(check({}, false).destinationId)
  assert.ok(check({ destinationId: '1' }).destinationId, 'el id tiene que ser número')
  assert.ok(check({ title: 'ab' }).title)
  assert.ok(check({ title: 'x'.repeat(121) }).title)
  assert.ok(check({ currency: 'EUR' }).currency)
  assert.ok(check({ price: 10.5 }).price)
  assert.ok(check({ price: '1000' }).price, 'precio como texto no se acepta')
  assert.ok(check({ price: 3_000_000_000 }).price)
  assert.ok(check({ departure: '2027-02-30' }).departure)
  assert.ok(check({ departure: '01/05/2027' }).departure)
  assert.ok(check({ includes: [' ', ''] }).includes)
  assert.ok(check({ nights: 0 }).nights)
  assert.ok(check({ nights: null }).nights)
  assert.ok(check({ from: '  ' }).from)
  assert.deepEqual(check({ includes: ['  Aéreo  ', '', 5] }), {})
  assert.deepEqual(normalizeTrip({ ...okTrip, includes: ['  Aéreo  ', '', 5] }).includes, ['Aéreo'])
})

test('validación de hotel y tour (fotos y descripción)', () => {
  const h = (i) => `https://res.cloudinary.com/x/image/upload/v1/viajes-con-karen/${i}.jpg`
  assert.deepEqual(check({ hotel: 'Hotel 4★', hotelImages: [h(1), h(2)], tour: 'City tour', tourImages: [h(3)] }), {})
  assert.deepEqual(check({}), {}, 'todo es opcional')
  assert.ok(check({ hotelImages: ['http://inseguro.com/a.jpg'] }).hotelImages, 'solo https')
  assert.ok(check({ tourImages: ['data:image/png;base64,AAAA'] }).tourImages, 'sin data URLs')
  assert.ok(check({ hotelImages: Array.from({ length: 11 }, (_, i) => h(i)) }).hotelImages, 'máximo 10')
  assert.ok(check({ tourImages: 'https://a.com/a.jpg' }).tourImages, 'tiene que ser lista')
  assert.ok(check({ tour: 'x'.repeat(2001) }).tour)
  assert.ok(check({ hotel: 'x'.repeat(301) }).hotel)
  const n = normalizeTrip({ ...okTrip, hotelImages: [h(1), h(1), ' ' + h(2) + ' '], tour: '  Paseo  ' })
  assert.deepEqual(n.hotelImages, [h(1), h(2)], 'sin repetidos, recortadas y en orden')
  assert.equal(n.tour, 'Paseo')
  assert.deepEqual(normalizeTrip(okTrip).tourImages, [], 'si no vienen quedan vacías')
  const f = normalizeTrip({ ...okTrip, category: 'vuelo', nights: null, airline: 'SKY', tripKind: 'Solo ida', hotel: 'x', hotelImages: [h(1)], tour: 'y', tourImages: [h(2)] })
  assert.equal(f.hotel, null); assert.equal(f.tour, null); assert.deepEqual([f.hotelImages, f.tourImages], [[], []], 'un vuelo no lleva hotel ni tour')
})

test('validación de vuelos', () => {
  const flight = { category: 'vuelo', nights: null, airline: 'SKY', tripKind: 'Ida y vuelta' }
  assert.deepEqual(check(flight), {})
  assert.ok(check({ ...flight, nights: 3 }).nights)
  assert.ok(check({ ...flight, airline: '' }).airline)
  assert.ok(check({ ...flight, tripKind: '' }).tripKind)
  const t = normalizeTrip({ ...okTrip, ...flight, hotel: 'no debería' })
  assert.equal(t.hotel, null, 'un vuelo no guarda hotel')
  assert.equal(normalizeTrip(okTrip).airline, null, 'un paquete no guarda aerolínea')
})

test('validación de ofertas', () => {
  assert.deepEqual(validateOffer(null, 100), {})
  assert.ok(validateOffer({ type: 'discount', price: 100 }, 100).offerPrice)
  assert.ok(validateOffer({ type: 'discount', price: 99.5 }, 100).offerPrice)
  assert.deepEqual(validateOffer({ type: 'discount', price: 90, until: '2027-01-31' }, 100), {})
  assert.ok(validateOffer({ type: 'promo', label: '' }, 100).offerLabel)
  assert.ok(validateOffer({ type: 'promo', label: 'x'.repeat(17) }, 100).offerLabel)
  assert.deepEqual(validateOffer({ type: 'promo', label: '2x1', note: 'Viajan dos' }, 100), {})
  assert.ok(validateOffer({ type: 'raro' }, 100).offerType)
  assert.ok(check({ offer: 'texto' }).offerType)
  assert.ok(check({ offer: { type: 'discount', price: 5000 } }).offerPrice)
  assert.ok(validateOffer({ type: 'promo', label: '2x1', until: '2027-13-01' }, 100).offerUntil)
})

test('fechas', () => {
  assert.equal(isDate('2028-02-29'), true)
  assert.equal(isDate('2027-02-29'), false)
  assert.equal(isDate('2027-2-1'), false)
  assert.equal(isDate(20270101), false)
})

test('validación de destinos e imágenes', () => {
  const v = (b) => validateDestination(normalizeDestination(b))
  const base = { name: 'Kioto', country: 'Japón', scope: 'internacional', images: [] }
  assert.deepEqual(v(base), {})
  assert.deepEqual(v({ ...base, images: ['https://res.cloudinary.com/x/a.jpg'] }), {})
  assert.ok(v({ ...base, images: ['http://inseguro.com/a.jpg'] }).images, 'solo https')
  assert.ok(v({ ...base, images: ['data:image/png;base64,AAAA'] }).images, 'sin data URLs')
  assert.ok(v({ ...base, images: ['javascript:alert(1)'] }).images)
  assert.ok(v({ ...base, images: Array.from({ length: 21 }, (_, i) => `https://a.com/${i}.jpg`) }).images)
  assert.ok(v({ ...base, images: 'https://a.com/a.jpg' }).images)
  assert.ok(v({ ...base, name: 'K' }).name)
  assert.ok(v({ ...base, scope: 'luna' }).scope)
  assert.ok(v({ ...base, country: '' }).country)
  assert.deepEqual(normalizeDestination({ ...base, images: ['https://a.com/1.jpg', 'https://a.com/1.jpg', 'https://a.com/2.jpg'] }).images, ['https://a.com/1.jpg', 'https://a.com/2.jpg'])
})

test('validación de consultas', () => {
  const v = (b) => validateInquiry(normalizeInquiry(b))
  assert.deepEqual(v({ name: 'Ana', email: 'ana@x.com', message: 'Hola' }), {})
  assert.deepEqual(v({ name: 'Ana', phone: '+54 9 11 5555-5555', message: 'Hola' }), {})
  assert.ok(v({ name: '', message: '' }).name)
  assert.ok(v({ name: 'Ana', message: 'Hola' }).contact)
  assert.ok(v({ name: 'Ana', email: 'no-mail', message: 'Hola' }).email)
  assert.ok(v({ name: 'Ana', phone: 'abc', message: 'Hola' }).phone)
  assert.ok(v({ name: 'Ana', email: 'a@b.com', message: 'x'.repeat(4001) }).message)
  const n = normalizeInquiry({ name: 'A', source: 'hack', channel: 'paloma', tripId: '5' })
  assert.equal(n.source, 'web'); assert.equal(n.channel, 'formulario'); assert.equal(n.tripId, null)
  assert.equal(hasErrors({}), false)
})
