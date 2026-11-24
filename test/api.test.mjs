// Pruebas de punta a punta: llaman a los route.js reales contra un PostgreSQL real.
import { call, cookieFrom, resetDatabase } from './helpers/setup.mjs'
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { hashPassword } from '../lib/password.js'
import { upsertAdmin } from '../lib/repo/admins.js'
import { seedCatalog } from '../lib/seed.js'
import { psqlQuery } from './helpers/psql-adapter.mjs'

const r = {
  health: (await import('../app/api/health/route.js')),
  login: (await import('../app/api/auth/login/route.js')),
  logout: (await import('../app/api/auth/logout/route.js')),
  me: (await import('../app/api/auth/me/route.js')),
  catalogo: (await import('../app/api/catalogo/route.js')),
  viajes: (await import('../app/api/viajes/route.js')),
  viaje: (await import('../app/api/viajes/[id]/route.js')),
  estado: (await import('../app/api/viajes/[id]/estado/route.js')),
  oferta: (await import('../app/api/viajes/[id]/oferta/route.js')),
  duplicar: (await import('../app/api/viajes/[id]/duplicar/route.js')),
  destinos: (await import('../app/api/destinos/route.js')),
  destino: (await import('../app/api/destinos/[id]/route.js')),
  ajustes: (await import('../app/api/ajustes/route.js')),
  firma: (await import('../app/api/imagenes/firma/route.js')),
  consultas: (await import('../app/api/consultas/route.js')),
  consulta: (await import('../app/api/consultas/[id]/route.js')),
  stats: (await import('../app/api/estadisticas/route.js')),
  evento: (await import('../app/api/estadisticas/evento/route.js')),
  compartir: (await import('../app/api/compartir/[id]/route.js')),
  sitemap: (await import('../app/api/sitemap/route.js')),
  disponibilidad: (await import('../app/api/viajes/[id]/disponibilidad/route.js')),
  pagina: (await import('../app/api/pagina/viaje/[id]/route.js')),
}

const EMAIL = 'karen@viajesconkaren.com'
const PASS = 'Clave-Segura-123'
let cookie

const validTrip = (over = {}) => ({
  category: 'paquete', destinationId: 1, title: 'Prueba Caribe', summary: 'Un viaje de prueba largo.', currency: 'USD', price: 1000,
  nights: 5, departure: '2027-05-01', from: 'Buenos Aires', includes: ['Traslados'], hotel: null, offer: null, active: true, ...over,
})
const as = (extra = {}) => ({ cookie, ...extra })

before(async () => {
  resetDatabase()
  await seedCatalog()
  await upsertAdmin({ email: EMAIL, name: 'Karen', passwordHash: await hashPassword(PASS) })
})

describe('base y datos de ejemplo', () => {
  test('health', async () => {
    const res = await call(r.health.GET)
    assert.equal(res.status, 200)
    assert.deepEqual(res.data, { ok: true })
  })
  test('el seed cargó 18 destinos y 22 viajes y no se repite', async () => {
    const [{ d, t }] = await psqlQuery('SELECT (SELECT count(*) FROM destinations)::int AS d, (SELECT count(*) FROM trips)::int AS t')
    assert.equal(d, 18); assert.equal(t, 22)
    assert.deepEqual(await seedCatalog(), { skipped: true })
  })
})

describe('sesión', () => {
  test('rutas protegidas sin sesión dan 401', async () => {
    for (const [h, opts] of [
      [r.me.GET, {}], [r.viajes.POST, { method: 'POST', body: validTrip() }], [r.destinos.GET, {}], [r.consultas.GET, {}],
      [r.firma.POST, { method: 'POST', body: {} }], [r.estado.PATCH, { method: 'PATCH', body: { active: false }, params: { id: '1' } }],
      [r.destino.DELETE, { method: 'DELETE', params: { id: '1' } }],
    ]) {
      const res = await call(h, opts)
      assert.equal(res.status, 401, JSON.stringify(opts).slice(0, 60))
    }
  })

  test('login incorrecto: mismo mensaje con e-mail inexistente o clave mala', async () => {
    const a = await call(r.login.POST, { method: 'POST', body: { email: EMAIL, password: 'mala-mala-mala' }, ip: '1.1.1.1' })
    const b = await call(r.login.POST, { method: 'POST', body: { email: 'nadie@x.com', password: 'mala-mala-mala' }, ip: '1.1.1.2' })
    assert.equal(a.status, 401); assert.equal(b.status, 401)
    assert.equal(a.data.error, b.data.error)
    assert.match(a.data.error, /incorrectos/)
  })

  test('login correcto: cookie httpOnly y /me', async () => {
    const res = await call(r.login.POST, { method: 'POST', body: { email: ` ${EMAIL.toUpperCase()} `, password: PASS }, ip: '1.1.1.3' })
    assert.equal(res.status, 200)
    assert.deepEqual(res.data, { email: EMAIL, name: 'Karen' })
    const setCookie = res.headers.get('set-cookie')
    assert.match(setCookie, /^vck_session=/)
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Lax/)
    assert.match(setCookie, /Max-Age=604800/)
    assert.doesNotMatch(JSON.stringify(res.data), /hash|password/i)
    cookie = cookieFrom(res)
    const me = await call(r.me.GET, as())
    assert.equal(me.status, 200); assert.equal(me.data.email, EMAIL)
  })

  test('una cookie falsificada no sirve', async () => {
    const res = await call(r.me.GET, { cookie: 'vck_session=aaa.bbb.ccc' })
    assert.equal(res.status, 401)
  })

  test('freno de fuerza bruta: 429 tras varios intentos fallidos (con Retry-After)', async () => {
    let last
    for (let i = 0; i < 10; i++) last = await call(r.login.POST, { method: 'POST', body: { email: EMAIL, password: `mala-${i}-mala` }, ip: '9.9.9.9' })
    assert.equal(last.status, 429)
    assert.ok(Number(last.headers.get('retry-after')) > 0)
    // aun con la clave correcta, desde esa IP queda bloqueado
    const blocked = await call(r.login.POST, { method: 'POST', body: { email: EMAIL, password: PASS }, ip: '9.9.9.9' })
    assert.equal(blocked.status, 429)
  })

  test('seguridad de pedidos: origen no permitido (403) y body que no es JSON (415/400)', async () => {
    const evil = await call(r.viajes.POST, as({ method: 'POST', body: validTrip(), origin: 'https://malo.com' }))
    assert.equal(evil.status, 403)
    const form = await call(r.viajes.POST, as({ method: 'POST', body: 'a=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
    assert.equal(form.status, 415)
    const broken = await call(r.viajes.POST, as({ method: 'POST', body: '{no es json' }))
    assert.equal(broken.status, 400)
    const arr = await call(r.viajes.POST, as({ method: 'POST', body: '[1,2]' }))
    assert.equal(arr.status, 400)
    const huge = await call(r.viajes.POST, as({ method: 'POST', body: JSON.stringify({ title: 'x'.repeat(200_000) }) }))
    assert.equal(huge.status, 413)
    // sin Origin (curl/servidor) sí se acepta mientras haya sesión
    const noOrigin = await call(r.me.GET, as({ origin: null }))
    assert.equal(noOrigin.status, 200)
  })
})

describe('token Bearer (alternativa a la cookie)', () => {
  const creds = { email: EMAIL, password: PASS }
  test('por defecto está desactivado: el login no devuelve token y el header se ignora', async () => {
    const res = await call(r.login.POST, { method: 'POST', body: creds, ip: '5.5.5.1' })
    assert.equal(res.data.token, undefined)
    const me = await call(r.me.GET, { headers: { authorization: 'Bearer ' + cookie.split('=')[1] } })
    assert.equal(me.status, 401)
  })
  test('con ALLOW_BEARER_TOKEN=true el login devuelve token y sirve sin cookie', async () => {
    process.env.ALLOW_BEARER_TOKEN = 'true'
    try {
      const res = await call(r.login.POST, { method: 'POST', body: creds, ip: '5.5.5.2' })
      assert.match(res.data.token, /^[\w-]+\.[\w-]+\.[\w-]+$/)
      assert.match(res.headers.get('set-cookie'), /^vck_session=/, 'la cookie se sigue enviando')
      const me = await call(r.me.GET, { headers: { authorization: `Bearer ${res.data.token}` } })
      assert.equal(me.status, 200); assert.equal(me.data.email, EMAIL)
      assert.equal((await call(r.me.GET, { headers: { authorization: 'Bearer basura.basura.basura' } })).status, 401)
      assert.equal((await call(r.me.GET, { headers: { authorization: 'Basic abc' } })).status, 401)
    } finally {
      delete process.env.ALLOW_BEARER_TOKEN
    }
  })
})

describe('catálogo público y de admin', () => {
  test('el público solo ve viajes activos; el admin ve todo', async () => {
    const created = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Oculto', active: false }) }))
    assert.equal(created.status, 201)
    const pub = await call(r.catalogo.GET)
    assert.equal(pub.status, 200)
    assert.ok(!pub.data.trips.some((t) => t.title === 'Oculto'))
    assert.equal(pub.data.trips.length, 22)
    assert.match(pub.headers.get('cache-control'), /s-maxage/)
    const adm = await call(r.catalogo.GET, as())
    assert.ok(adm.data.trips.some((t) => t.title === 'Oculto'))
    assert.equal(adm.data.trips.length, 23)
    assert.equal(adm.data.destinations.length, 18)
    assert.match(adm.headers.get('cache-control'), /no-store/)
  })

  test('el formato de los viajes es el que espera el front', async () => {
    const { data } = await call(r.catalogo.GET)
    const flight = data.trips.find((t) => t.category === 'vuelo')
    assert.equal(flight.nights, null)
    assert.equal(typeof flight.airline, 'string'); assert.equal(typeof flight.tripKind, 'string')
    assert.match(flight.departure, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(flight.createdAt, /^\d{4}-\d{2}-\d{2}T.*Z$/)
    const pkg = data.trips.find((t) => t.category === 'paquete')
    assert.equal('airline' in pkg, false)
    assert.ok(Array.isArray(pkg.includes) && typeof pkg.from === 'string' && typeof pkg.destinationId === 'number')
    const withOffer = data.trips.find((t) => t.offer?.type === 'discount')
    assert.equal(typeof withOffer.offer.price, 'number')
    assert.ok(data.destinations.every((d) => Array.isArray(d.images) && d.scope))
  })
})

describe('viajes', () => {
  let id
  test('crear: válido (201), con id nuevo continuando el seed', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip() }))
    assert.equal(res.status, 201)
    assert.equal(res.data.id, 24)
    assert.equal(res.data.active, true); assert.equal(res.data.offer, null); assert.equal(res.data.from, 'Buenos Aires')
    id = res.data.id
  })
  test('crear: errores por campo (422)', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: '', price: -1, destinationId: 999, offer: { type: 'discount', price: 5000 }, includes: [] }) }))
    assert.equal(res.status, 422)
    for (const k of ['title', 'price', 'destinationId', 'includes', 'offerPrice']) assert.ok(res.data.fields[k], k)
  })
  test('crear vuelo: sin aerolínea falla, con datos completos funciona y no guarda noches', async () => {
    const bad = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ category: 'vuelo', nights: null }) }))
    assert.ok(bad.data.fields.airline && bad.data.fields.tripKind)
    const ok = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ category: 'vuelo', nights: null, airline: 'SKY', tripKind: 'Ida y vuelta', title: 'Vuelo prueba' }) }))
    assert.equal(ok.status, 201); assert.equal(ok.data.nights, null); assert.equal(ok.data.airline, 'SKY')
  })
  test('editar conserva createdAt y cambia updatedAt', async () => {
    const before = await call(r.viaje.GET, as({ params: { id: String(id) } }))
    await new Promise((res) => setTimeout(res, 20))
    const res = await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(id) }, body: validTrip({ title: 'Editado', price: 1500 }) }))
    assert.equal(res.status, 200)
    assert.equal(res.data.title, 'Editado'); assert.equal(res.data.price, 1500)
    assert.equal(res.data.createdAt, before.data.createdAt)
    assert.notEqual(res.data.updatedAt, before.data.updatedAt)
  })
  test('editar: viaje inexistente 404; id inválido 404; validación 422', async () => {
    assert.equal((await call(r.viaje.PUT, as({ method: 'PUT', params: { id: '99999' }, body: validTrip() }))).status, 404)
    assert.equal((await call(r.viaje.PUT, as({ method: 'PUT', params: { id: 'abc' }, body: validTrip() }))).status, 404)
    assert.equal((await call(r.viaje.PUT, as({ method: 'PUT', params: { id: "1; DROP TABLE trips" }, body: validTrip() }))).status, 404)
    assert.equal((await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(id) }, body: validTrip({ title: 'x' }) }))).status, 422)
  })
  test('desactivar y reactivar (no se borra)', async () => {
    const off = await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: String(id) }, body: { active: false } }))
    assert.equal(off.data.active, false)
    const pub = await call(r.catalogo.GET)
    assert.ok(!pub.data.trips.some((t) => t.id === id))
    const on = await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: String(id) }, body: { active: true } }))
    assert.equal(on.data.active, true)
    assert.equal((await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: String(id) }, body: { active: 'si' } }))).status, 422)
    assert.equal((await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: '99999' }, body: { active: true } }))).status, 404)
  })
  test('ofertas: descuento, promo, inválidas y quitar', async () => {
    const p = { id: String(id) }
    const d = await call(r.oferta.PUT, as({ method: 'PUT', params: p, body: { type: 'discount', price: 1200, until: '2027-01-31' } }))
    assert.equal(d.status, 200); assert.deepEqual(d.data.offer, { type: 'discount', price: 1200, until: '2027-01-31' })
    const pr = await call(r.oferta.PUT, as({ method: 'PUT', params: p, body: { type: 'promo', label: '2x1', note: 'Viajan dos' } }))
    assert.deepEqual(pr.data.offer, { type: 'promo', label: '2x1', note: 'Viajan dos' })
    const bad = await call(r.oferta.PUT, as({ method: 'PUT', params: p, body: { type: 'discount', price: 1600 } }))
    assert.equal(bad.status, 422); assert.ok(bad.data.fields.offerPrice)
    assert.ok((await call(r.oferta.PUT, as({ method: 'PUT', params: p, body: { type: 'promo', label: '' } }))).data.fields.offerLabel)
    assert.equal((await call(r.oferta.PUT, as({ method: 'PUT', params: { id: '99999' }, body: { type: 'promo', label: '2x1' } }))).status, 404)
    const wrapped = await call(r.oferta.PUT, as({ method: 'PUT', params: p, body: { offer: { type: 'promo', label: '3x2' } } }))
    assert.equal(wrapped.data.offer.label, '3x2')
    const off = await call(r.oferta.DELETE, as({ method: 'DELETE', params: p }))
    assert.equal(off.data.offer, null)
  })
  test('duplicar: copia desactivada, sin oferta y con "(copia)"', async () => {
    await call(r.oferta.PUT, as({ method: 'PUT', params: { id: String(id) }, body: { type: 'promo', label: '3x2' } }))
    const res = await call(r.duplicar.POST, as({ method: 'POST', params: { id: String(id) } }))
    assert.equal(res.status, 201)
    assert.equal(res.data.active, false); assert.equal(res.data.offer, null)
    assert.match(res.data.title, /\(copia\)$/)
    assert.notEqual(res.data.id, id)
    assert.equal((await call(r.duplicar.POST, as({ method: 'POST', params: { id: '99999' } }))).status, 404)
  })
  test('las comillas y caracteres raros se guardan tal cual (consultas parametrizadas)', async () => {
    const title = `Ushuaia "Fin del Mundo" — O'Brien; DROP TABLE trips; --`
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title, includes: ['Comida "gourmet"', "Guía d'élite", 'Ñandú \\ barra'] }) }))
    assert.equal(res.status, 201)
    assert.equal(res.data.title, title)
    assert.deepEqual(res.data.includes, ['Comida "gourmet"', "Guía d'élite", 'Ñandú \\ barra'])
    const [{ n }] = await psqlQuery('SELECT count(*)::int AS n FROM trips')
    assert.ok(n > 22)
  })
})

describe('viaje en el día (0 noches)', () => {
  test('crear y editar con 0 noches; -1 se rechaza', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Excursión de un día', nights: 0 }) }))
    assert.equal(res.status, 201); assert.strictEqual(res.data.nights, 0)
    const upd = await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(res.data.id) }, body: validTrip({ title: 'Excursión de un día', nights: 0, price: 50 }) }))
    assert.strictEqual(upd.data.nights, 0)
    assert.equal((await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ nights: -1 }) }))).status, 422)
    const pub = (await call(r.catalogo.GET)).data.trips.find((t) => t.id === res.data.id)
    assert.strictEqual(pub.nights, 0)
  })
  test('el esquema acepta 0 pero no negativos', async () => {
    await assert.rejects(psqlQuery(`INSERT INTO trips (category, destination_id, title, summary, currency, price, nights, departure, origin)
      VALUES ('paquete', 1, 'xxx', 'resumen largo ok', 'USD', 10, -1, '2027-01-01', 'BA') RETURNING id`), (e) => e.code === '23514')
  })
})

describe('ajustes (viajes por página)', () => {
  test('el catálogo público trae el valor por defecto (20)', async () => {
    const res = await call(r.catalogo.GET)
    assert.deepEqual(res.data.settings, { tripsPerPage: 20 })
  })
  test('solo el admin lo lee y lo cambia', async () => {
    assert.equal((await call(r.ajustes.GET)).status, 401)
    assert.equal((await call(r.ajustes.PUT, { method: 'PUT', body: { tripsPerPage: 8 } })).status, 401)
  })
  test('cambiar: se guarda y el catálogo público lo refleja', async () => {
    const res = await call(r.ajustes.PUT, as({ method: 'PUT', body: { tripsPerPage: 8 } }))
    assert.deepEqual(res.data, { tripsPerPage: 8 })
    assert.equal((await call(r.catalogo.GET)).data.settings.tripsPerPage, 8)
    assert.equal((await call(r.ajustes.GET, as())).data.tripsPerPage, 8)
  })
  test('valores inválidos dan 422 y no cambian nada', async () => {
    for (const bad of [0, 3, 101, 12.5, '20', null, undefined, -5]) {
      const res = await call(r.ajustes.PUT, as({ method: 'PUT', body: { tripsPerPage: bad } }))
      assert.equal(res.status, 422, String(bad)); assert.ok(res.data.fields.tripsPerPage)
    }
    assert.equal((await call(r.catalogo.GET)).data.settings.tripsPerPage, 8)
    for (const ok of [4, 100]) assert.equal((await call(r.ajustes.PUT, as({ method: 'PUT', body: { tripsPerPage: ok } }))).status, 200)
    await call(r.ajustes.PUT, as({ method: 'PUT', body: { tripsPerPage: 20 } }))
  })
})

describe('hotel y tour', () => {
  const img = (n) => `https://res.cloudinary.com/micloud/image/upload/v1/viajes-con-karen/${n}.jpg`
  let id
  test('crear con fotos de hotel y tour: se guardan en orden y vuelven en el catálogo', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Con hotel y tour', hotel: 'Hotel 4★ frente al mar', hotelImages: [img('h2'), img('h1')], tour: 'City tour de medio día', tourImages: [img('t1')] }) }))
    assert.equal(res.status, 201)
    assert.deepEqual(res.data.hotelImages, [img('h2'), img('h1')])
    assert.equal(res.data.tour, 'City tour de medio día'); assert.deepEqual(res.data.tourImages, [img('t1')])
    id = res.data.id
    const pub = await call(r.catalogo.GET)
    const t = pub.data.trips.find((x) => x.id === id)
    assert.deepEqual(t.hotelImages, [img('h2'), img('h1')]); assert.equal(t.hotel, 'Hotel 4★ frente al mar')
  })
  test('los viajes del seed (anteriores a esto) tienen listas vacías y sin tour', async () => {
    const t = (await call(r.catalogo.GET)).data.trips.find((x) => x.id === 1)
    assert.deepEqual(t.hotelImages, []); assert.deepEqual(t.tourImages, []); assert.equal(t.tour, null)
  })
  test('editar: agregar, reordenar y quitar fotos; el tour se puede vaciar', async () => {
    const res = await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(id) }, body: validTrip({ title: 'Con hotel y tour', hotel: 'Hotel', hotelImages: [img('h1')], tour: '', tourImages: [] }) }))
    assert.equal(res.status, 200)
    assert.deepEqual(res.data.hotelImages, [img('h1')]); assert.equal(res.data.tour, null); assert.deepEqual(res.data.tourImages, [])
  })
  test('validación: links no https, más de 10 y tour muy largo dan 422 por campo', async () => {
    const bad = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ hotelImages: ['http://x.com/a.jpg'], tourImages: Array.from({ length: 11 }, (_, i) => img(i)), tour: 'x'.repeat(2001) }) }))
    assert.equal(bad.status, 422)
    for (const k of ['hotelImages', 'tourImages', 'tour']) assert.ok(bad.data.fields[k], k)
  })
  test('un vuelo ignora hotel y tour', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ category: 'vuelo', nights: null, airline: 'SKY', tripKind: 'Solo ida', title: 'Vuelo sin extras', hotel: 'no', hotelImages: [img('x')], tour: 'no', tourImages: [img('y')] }) }))
    assert.equal(res.status, 201)
    assert.equal(res.data.hotel, null); assert.equal(res.data.tour, null); assert.deepEqual([res.data.hotelImages, res.data.tourImages], [[], []])
  })
  test('el esquema también impide un vuelo con hotel o tour', async () => {
    await assert.rejects(
      psqlQuery(`INSERT INTO trips (category, destination_id, title, summary, currency, price, departure, origin, airline, trip_kind, tour)
                 VALUES ('vuelo', 1, 'xxx', 'resumen largo ok', 'USD', 10, '2027-01-01', 'BA', 'SKY', 'Solo ida', 'tour') RETURNING id`),
      (e) => e.code === '23514'
    )
  })
  test('duplicar copia las fotos del hotel y del tour', async () => {
    await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(id) }, body: validTrip({ title: 'Con hotel y tour', hotelImages: [img('h1')], tour: 'Tour', tourImages: [img('t1'), img('t2')] }) }))
    const copy = await call(r.duplicar.POST, as({ method: 'POST', params: { id: String(id) } }))
    assert.deepEqual(copy.data.hotelImages, [img('h1')]); assert.equal(copy.data.tour, 'Tour'); assert.deepEqual(copy.data.tourImages, [img('t1'), img('t2')])
  })
  test('limpieza en Cloudinary (activada): borra solo lo que ya nadie usa', async () => {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'micloud', CLOUDINARY_API_KEY: '1', CLOUDINARY_API_SECRET: 's', CLOUDINARY_DELETE_ORPHANS: 'true' })
    const realFetch = globalThis.fetch
    const deleted = []
    globalThis.fetch = async (url, init) => { deleted.push(new URLSearchParams(init.body).get('public_id')); return { ok: true } }
    try {
      const dest = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Limpieza', country: 'X', scope: 'nacional', images: [img('d1'), img('shared')] } }))
      const trip = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: dest.data.id, title: 'Viaje de limpieza', hotelImages: [img('shared'), img('h9')], tourImages: [img('t9')] }) }))
      // se saca h9 del hotel y t9 del tour; "shared" sigue en uso por el destino
      await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(trip.data.id) }, body: validTrip({ destinationId: dest.data.id, title: 'Viaje de limpieza', hotelImages: [img('shared')], tourImages: [] }) }))
      assert.deepEqual(deleted.sort(), ['viajes-con-karen/h9', 'viajes-con-karen/t9'])
      deleted.length = 0
      // al sacar "shared" y "d1" del destino: d1 se borra; shared NO (la usa el hotel del viaje)
      await call(r.destino.PUT, as({ method: 'PUT', params: { id: String(dest.data.id) }, body: { name: 'Limpieza', country: 'X', scope: 'nacional', images: [] } }))
      assert.deepEqual(deleted, ['viajes-con-karen/d1'])
    } finally {
      globalThis.fetch = realFetch
      for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_DELETE_ORPHANS']) delete process.env[k]
    }
  })
})

describe('destinos', () => {
  let id
  test('crear y rechazar nombre repetido (sin importar mayúsculas)', async () => {
    const res = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Kioto', country: 'Japón', scope: 'internacional', images: ['https://res.cloudinary.com/x/a.jpg'] } }))
    assert.equal(res.status, 201); id = res.data.id
    assert.deepEqual(res.data.images, ['https://res.cloudinary.com/x/a.jpg'])
    const dup = await call(r.destinos.POST, as({ method: 'POST', body: { name: ' kioto ', country: 'Japón', scope: 'internacional' } }))
    assert.equal(dup.status, 422); assert.ok(dup.data.fields.name)
  })
  test('imágenes: se rechazan links no https, data URLs y scripts', async () => {
    for (const bad of ['http://x.com/a.jpg', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'no-es-link']) {
      const res = await call(r.destino.PUT, as({ method: 'PUT', params: { id: String(id) }, body: { name: 'Kioto', country: 'Japón', scope: 'internacional', images: [bad] } }))
      assert.equal(res.status, 422, bad); assert.ok(res.data.fields.images)
    }
  })
  test('editar: el orden de las imágenes se conserva (la primera es la portada)', async () => {
    const imgs = ['https://a.com/2.jpg', 'https://a.com/1.jpg', 'https://a.com/3.jpg']
    const res = await call(r.destino.PUT, as({ method: 'PUT', params: { id: String(id) }, body: { name: 'Kioto', country: 'Japón', scope: 'internacional', images: imgs } }))
    assert.equal(res.status, 200); assert.deepEqual(res.data.images, imgs)
    const dup = await call(r.destino.PUT, as({ method: 'PUT', params: { id: String(id) }, body: { name: 'Tokio', country: 'Japón', scope: 'internacional', images: [] } }))
    assert.equal(dup.status, 422)
    assert.equal((await call(r.destino.PUT, as({ method: 'PUT', params: { id: '99999' }, body: { name: 'Nuevo', country: 'X', scope: 'nacional', images: [] } }))).status, 404)
  })
  test('dos viajes comparten las imágenes de su destino', async () => {
    const t1 = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: id, title: 'Kioto paquete' }) }))
    const t2 = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: id, title: 'Kioto hotel', category: 'hotel' }) }))
    assert.equal(t1.status, 201); assert.equal(t2.status, 201)
    const cat = await call(r.catalogo.GET)
    assert.equal(cat.data.trips.filter((t) => t.destinationId === id).length, 2)
    assert.equal(cat.data.destinations.find((d) => d.id === id).images.length, 3)
  })
  test('no se elimina un destino con viajes (409), aunque estén desactivados', async () => {
    const res = await call(r.destino.DELETE, as({ method: 'DELETE', params: { id: String(id) } }))
    assert.equal(res.status, 409); assert.match(res.data.error, /viajes asociados/)
    const viajes = (await call(r.catalogo.GET, as())).data.trips.filter((t) => t.destinationId === id)
    for (const t of viajes) await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: String(t.id) }, body: { active: false } }))
    assert.equal((await call(r.destino.DELETE, as({ method: 'DELETE', params: { id: String(id) } }))).status, 409)
  })
  test('el destino sin viajes activos no aparece en el catálogo público', async () => {
    const pub = await call(r.catalogo.GET)
    assert.ok(!pub.data.destinations.some((d) => d.id === id))
  })
  test('un destino sin viajes sí se elimina; uno inexistente da 404', async () => {
    const nuevo = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Temporal', country: 'X', scope: 'nacional' } }))
    assert.deepEqual((await call(r.destino.DELETE, as({ method: 'DELETE', params: { id: String(nuevo.data.id) } }))).data, { id: nuevo.data.id })
    assert.equal((await call(r.destino.DELETE, as({ method: 'DELETE', params: { id: String(nuevo.data.id) } }))).status, 404)
  })
  test('listar destinos (admin)', async () => {
    const res = await call(r.destinos.GET, as())
    assert.ok(res.data.length >= 19)
  })
})

describe('imágenes (Cloudinary)', () => {
  test('sin configurar: 503', async () => {
    const res = await call(r.firma.POST, as({ method: 'POST', body: {} }))
    assert.equal(res.status, 503)
  })
  test('configurado: devuelve firma y nunca el secreto', async () => {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'micloud', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 'super-secreto' })
    const res = await call(r.firma.POST, as({ method: 'POST', body: {} }))
    assert.equal(res.status, 200)
    assert.equal(res.data.folder, 'viajes-con-karen'); assert.match(res.data.signature, /^[0-9a-f]{40}$/)
    assert.doesNotMatch(JSON.stringify(res.data), /super-secreto/)
    for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[k]
  })
})

describe('consultas', () => {
  let id
  const body = (over = {}) => ({ name: 'Ana Pérez', email: 'ana@x.com', phone: '', message: 'Quiero info del viaje', source: 'detalle', channel: 'formulario', tripId: 1, ...over })

  test('público: se puede enviar sin sesión; el título del viaje sale de la base', async () => {
    const res = await call(r.consultas.POST, { method: 'POST', body: body({ tripTitle: 'TÍTULO FALSO' }), ip: '2.2.2.2', cookie: undefined })
    assert.equal(res.status, 201)
    assert.equal(res.data.status, 'nueva')
    assert.equal(res.data.tripId, 1)
    assert.notEqual(res.data.tripTitle, 'TÍTULO FALSO'); assert.ok(res.data.tripTitle)
    id = res.data.id
  })
  test('un viaje inexistente se ignora (no rompe)', async () => {
    const res = await call(r.consultas.POST, { method: 'POST', body: body({ tripId: 99999 }), ip: '2.2.2.3' })
    assert.equal(res.status, 201); assert.equal(res.data.tripId, null); assert.equal(res.data.tripTitle, null)
  })
  test('validación (422) y consulta de modal sin viaje', async () => {
    const bad = await call(r.consultas.POST, { method: 'POST', body: { name: '', message: '' }, ip: '2.2.2.4' })
    assert.equal(bad.status, 422); assert.ok(bad.data.fields.name && bad.data.fields.message)
    const noContact = await call(r.consultas.POST, { method: 'POST', body: { name: 'Ana', message: 'Hola' }, ip: '2.2.2.4' })
    assert.ok(noContact.data.fields.contact)
    const modal = await call(r.consultas.POST, { method: 'POST', body: { name: 'Beto', phone: '+54 9 11 5555-5555', message: 'Luna de miel', subject: 'Japón', source: 'modal', channel: 'whatsapp' }, ip: '2.2.2.4' })
    assert.equal(modal.status, 201); assert.equal(modal.data.channel, 'whatsapp'); assert.equal(modal.data.subject, 'Japón')
  })
  test('antispam: máximo 6 por IP en 10 minutos', async () => {
    let last
    for (let i = 0; i < 8; i++) last = await call(r.consultas.POST, { method: 'POST', body: body(), ip: '3.3.3.3' })
    assert.equal(last.status, 429)
    assert.ok(Number(last.headers.get('retry-after')) > 0)
  })
  test('solo el admin las lista, cambia de estado y borra', async () => {
    assert.equal((await call(r.consultas.GET)).status, 401)
    assert.equal((await call(r.consulta.PATCH, { method: 'PATCH', params: { id: String(id) }, body: { status: 'atendida' } })).status, 401)
    const list = await call(r.consultas.GET, as())
    assert.ok(list.data.length >= 3)
    assert.ok(list.data[0].createdAt >= list.data[list.data.length - 1].createdAt, 'más nuevas primero')
    const upd = await call(r.consulta.PATCH, as({ method: 'PATCH', params: { id: String(id) }, body: { status: 'atendida' } }))
    assert.equal(upd.data.status, 'atendida')
    assert.equal((await call(r.consulta.PATCH, as({ method: 'PATCH', params: { id: String(id) }, body: { status: 'otro' } }))).status, 422)
    assert.equal((await call(r.consulta.PATCH, as({ method: 'PATCH', params: { id: '99999' }, body: { status: 'nueva' } }))).status, 404)
    assert.deepEqual((await call(r.consulta.DELETE, as({ method: 'DELETE', params: { id: String(id) } }))).data, { id })
    assert.equal((await call(r.consulta.DELETE, as({ method: 'DELETE', params: { id: String(id) } }))).status, 404)
  })
  test('si se borra el viaje de la consulta, la consulta queda (FK SET NULL)', async () => {
    const res = await call(r.consultas.POST, { method: 'POST', body: body({ tripId: 2 }), ip: '4.4.4.4' })
    await psqlQuery('DELETE FROM trips WHERE id = $1 RETURNING id', [2])
    const list = await call(r.consultas.GET, as())
    const found = list.data.find((x) => x.id === res.data.id)
    assert.equal(found.tripId, null); assert.ok(found.tripTitle)
  })
})


describe('varias fechas de salida y viajes vencidos', () => {
  let multiId, expiredId
  test('crear con varias fechas: se ordenan, sin repetidos, y "departure" es la primera', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Multi fecha', departure: undefined, departures: ['2027-09-10', '2027-03-05', '2027-03-05', '2027-06-01'] }) }))
    assert.equal(res.status, 201)
    assert.deepEqual(res.data.departures, ['2027-03-05', '2027-06-01', '2027-09-10'])
    assert.equal(res.data.departure, '2027-03-05')
    multiId = res.data.id
  })
  test('compatibilidad: solo "departure" = una sola fecha', async () => {
    const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Una fecha', departure: '2027-07-07' }) }))
    assert.equal(res.status, 201)
    assert.deepEqual(res.data.departures, ['2027-07-07'])
  })
  test('validación: sin fechas, inválidas, demasiadas o no-lista', async () => {
    for (const departures of [[], ['2027-02-30'], ['hoy'], Array.from({ length: 25 }, (_, i) => `2027-01-${String(i + 1).padStart(2, '0')}`), 'x']) {
      const res = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ departure: undefined, departures }) }))
      assert.equal(res.status, 422, JSON.stringify(departures))
      assert.ok(res.data.fields.departures)
    }
  })
  test('editar reemplaza las fechas', async () => {
    const res = await call(r.viaje.PUT, as({ method: 'PUT', params: { id: String(multiId) }, body: validTrip({ title: 'Multi fecha', departure: undefined, departures: ['2027-12-24'] }) }))
    assert.equal(res.status, 200)
    assert.deepEqual(res.data.departures, ['2027-12-24'])
    assert.equal(res.data.departure, '2027-12-24')
  })
  test('duplicar copia las fechas', async () => {
    const res = await call(r.duplicar.POST, as({ method: 'POST', params: { id: String(multiId) }, body: {} }))
    assert.deepEqual(res.data.departures, ['2027-12-24'])
  })
  test('el público no ve fechas pasadas; el viaje sin fechas futuras desaparece; el panel lo sigue viendo', async () => {
    const mixed = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Mixto', departure: undefined, departures: ['2020-01-01', '2027-02-02'] }) }))
    const old = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Solo pasado', departure: undefined, departures: ['2020-01-01', '2021-05-05'] }) }))
    expiredId = old.data.id
    const pub = await call(r.catalogo.GET)
    const m = pub.data.trips.find((t) => t.id === mixed.data.id)
    assert.deepEqual(m.departures, ['2027-02-02'])
    assert.equal(m.departure, '2027-02-02')
    assert.equal(pub.data.trips.find((t) => t.id === expiredId), undefined, 'vencido oculto al público')
    const adm = await call(r.catalogo.GET, as())
    assert.deepEqual(adm.data.trips.find((t) => t.id === mixed.data.id).departures, ['2020-01-01', '2027-02-02'])
    assert.ok(adm.data.trips.find((t) => t.id === expiredId), 'el panel lo ve')
  })
  test('un destino que solo tenía viajes vencidos deja de aparecer al público', async () => {
    const dest = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Solo vencido', country: 'Chile', scope: 'internacional', images: [] } }))
    await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: dest.data.id, title: 'Vencido del destino', departure: undefined, departures: ['2020-03-03'] }) }))
    const pub = await call(r.catalogo.GET)
    assert.equal(pub.data.destinations.find((d) => d.id === dest.data.id), undefined)
  })
  test('la salida de hoy sigue vigente (zona horaria de Argentina)', async () => {
    const { publicTrips, todayAR } = await import('../lib/repo/trips.js')
    // 22:30 en Argentina del 10/05 ya es 01:30 UTC del 11/05: igual es "hoy" el 10/05
    assert.equal(todayAR(new Date('2027-05-11T01:30:00Z')), '2027-05-10')
    const out = publicTrips([{ departures: ['2027-05-10'] }, { departures: ['2027-05-09'] }], '2027-05-10')
    assert.equal(out.length, 1)
  })
  test('migración: el esquema completa "departures" si falta y la limita a 1-24', async () => {
    const rows = await psqlQuery(`INSERT INTO trips (category, destination_id, title, summary, currency, price, nights, departure, origin)
                 VALUES ('paquete', 1, 'sin array', 'resumen largo ok', 'USD', 10, 3, '2027-01-01', 'BA') RETURNING departures`)
    assert.equal(rows.length, 1)
    await assert.rejects(
      psqlQuery(`UPDATE trips SET departures = ARRAY[]::date[] WHERE id = $1 RETURNING id`, [multiId]).then((x) => { if (!x.length) throw new Error('x'); return x }).then(async () => {
        const [row] = await psqlQuery('SELECT cardinality(departures)::int AS n FROM trips WHERE id = $1', [multiId])
        if (row.n < 1) throw Object.assign(new Error('vacío'), { code: '23514' })
        throw Object.assign(new Error('ok'), { code: 'OK' })
      }),
      (e) => e.code === 'OK'
    )
  })
})

describe('estadísticas', () => {
  const ev = (body, extra = {}) => call(r.evento.POST, { method: 'POST', body, ip: '7.7.7.7', headers: { 'user-agent': 'Mozilla/5.0 (X11) Chrome' }, ...extra })
  test('cuenta vistas y WhatsApp de un viaje activo', async () => {
    assert.equal((await ev({ tripId: 1, kind: 'view' })).data.counted, true)
    assert.equal((await ev({ tripId: 1, kind: 'view' })).data.counted, true)
    assert.equal((await ev({ tripId: 1, kind: 'whatsapp' })).data.counted, true)
  })
  test('no cuenta: robots, administración, viaje inexistente o desactivado', async () => {
    assert.equal((await ev({ tripId: 1, kind: 'view' }, { headers: { 'user-agent': 'Googlebot/2.1' } })).data.counted, false)
    assert.equal((await ev({ tripId: 1, kind: 'view' }, { cookie })).data.counted, false)
    assert.equal((await ev({ tripId: 99999, kind: 'view' })).data.counted, false)
    const off = await call(r.estado.PATCH, as({ method: 'PATCH', params: { id: '3' }, body: { active: false } }))
    assert.equal(off.status, 200)
    assert.equal((await ev({ tripId: 3, kind: 'view' })).data.counted, false)
  })
  test('rechaza eventos inválidos', async () => {
    for (const b of [{}, { tripId: 'a', kind: 'view' }, { tripId: 1, kind: 'otro' }, { tripId: -1, kind: 'view' }, { tripId: 1.5, kind: 'view' }]) {
      assert.equal((await ev(b)).status, 422, JSON.stringify(b))
    }
  })
  test('límite por IP', async () => {
    let last
    for (let i = 0; i < 125; i++) last = await ev({ tripId: 1, kind: 'view' }, { ip: '8.8.8.8' })
    assert.equal(last.status, 429)
  })
  test('el resumen requiere sesión y suma bien', async () => {
    assert.equal((await call(r.stats.GET)).status, 401)
    await call(r.consultas.POST, { method: 'POST', body: { name: 'Ana', email: 'a@b.com', phone: '', subject: '', message: 'hola', tripId: 1, source: 'detalle', channel: 'formulario' }, ip: '9.9.9.9' })
    const res = await call(r.stats.GET, as({ url: 'http://localhost:3000/api/estadisticas?dias=7' }))
    assert.equal(res.status, 200)
    assert.equal(res.data.days, 7)
    assert.equal(res.data.series.length, 7)
    assert.equal(res.data.totals.views, 122, '2 de antes + 120 que dejó pasar el límite')
    assert.equal(res.data.totals.whatsapp, 1)
    assert.ok(res.data.totals.inquiries >= 1)
    const t1 = res.data.trips.find((t) => t.tripId === 1)
    assert.equal(t1.views, 122); assert.equal(t1.whatsapp, 1); assert.ok(t1.inquiries >= 1)
    assert.equal(res.data.inquiriesByMonth.length, 12)
    assert.ok(res.data.inquiriesByMonth.at(-1).count >= 1)
    assert.equal(JSON.stringify(res.data).includes('7.7.7.7'), false, 'no se guarda ni se devuelve la IP')
    const bad = await call(r.stats.GET, as({ url: 'http://localhost:3000/api/estadisticas?dias=5' }))
    assert.equal(bad.data.days, 30, 'período inválido -> 30')
  })
  test('al borrar el viaje se borran sus contadores', async () => {
    await psqlQuery('DELETE FROM trips WHERE id = $1 RETURNING id', [1])
    const [{ n }] = await psqlQuery('SELECT count(*)::int AS n FROM trip_stats_daily WHERE trip_id = 1')
    assert.equal(n, 0)
  })
})


describe('compartir (vista previa) y sitemap', () => {
  const share = (id) => call(r.compartir.GET, { url: `http://localhost:3000/api/compartir/${id}`, params: { id: String(id) }, origin: null })
  let destId, tripId
  test('la página de un viaje trae sus etiquetas Open Graph y redirige a la web', async () => {
    const dest = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Destino Share', country: 'Chile', scope: 'internacional', images: ['https://res.cloudinary.com/demo/image/upload/v1/viajes/foto.jpg'] } }))
    destId = dest.data.id
    const t = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: destId, title: 'Chile "<b>mágico</b>" & más', summary: 'Resumen del viaje para compartir.', departure: undefined, departures: ['2027-04-01', '2027-08-01'], price: 1500 }) }))
    tripId = t.data.id
    const res = await share(tripId)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/html/)
    const body = res.data
    assert.match(body, /<meta property="og:title" content="Chile &quot;&lt;b&gt;mágico&lt;\/b&gt;&quot; &amp; más – Destino Share, Chile \| Viajes con Karen">/)
    assert.match(body, /og:description" content="[^"]*2 fechas de salida \(próxima 01\/04\/2027\)[^"]*Desde USD 1\.500/)
    assert.match(body, /og:image" content="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/c_fill,g_auto,w_1200,h_630,q_auto:good,f_jpg\/v1\/viajes\/foto\.jpg"/)
    assert.match(body, /og:image:width" content="1200"/)
    assert.match(body, new RegExp(`og:url" content="http://localhost:3000/api/compartir/${tripId}"`))
    assert.match(body, new RegExp(`window\\.location\\.replace\\("http://localhost:5173/viaje/${tripId}"\\)`))
    assert.match(body, /twitter:card" content="summary_large_image"/)
    assert.doesNotMatch(body, /<b>mágico<\/b>/, 'el texto del viaje va escapado')
    assert.match(res.headers.get('cache-control'), /s-maxage/)
  })
  test('sin foto usa la imagen por defecto; oferta y promo se reflejan en el texto', async () => {
    const dest = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Sin Foto', country: 'Perú', scope: 'internacional', images: [] } }))
    const t = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: dest.data.id, title: 'Perú oferta', offer: { type: 'discount', price: 800 }, price: 1000 }) }))
    const body = (await share(t.data.id)).data
    assert.match(body, /og:image" content="http:\/\/localhost:5173\/og-default\.jpg"/)
    assert.match(body, /Oferta USD 800 \(antes USD 1\.000\)/)
    const p = await call(r.oferta.PUT, as({ method: 'PUT', params: { id: String(t.data.id) }, body: { type: 'promo', label: '2x1' } }))
    assert.equal(p.status, 200)
    assert.match((await share(t.data.id)).data, /Promo 2x1 · desde USD 1\.000/)
  })
  test('viaje inexistente, id inválido, desactivado o vencido: tarjeta general de la agencia', async () => {
    const off = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Apagado', active: false }) }))
    const old = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Viejo', departure: undefined, departures: ['2020-01-01'] }) }))
    for (const id of [999999, 'abc', off.data.id, old.data.id]) {
      const res = await share(id)
      assert.equal(res.status, 200)
      assert.match(res.data, /og:title" content="Viajes con Karen \|/)
      assert.match(res.data, /replace\("http:\/\/localhost:5173\/"\)/)
      assert.doesNotMatch(res.data, /Apagado|Viejo/)
    }
  })
  test('sitemap: portada y viajes publicados (sin desactivados ni vencidos)', async () => {
    const res = await call(r.sitemap.GET, { origin: null })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /application\/xml/)
    assert.match(res.data, /<loc>http:\/\/localhost:5173\/<\/loc>/)
    assert.match(res.data, new RegExp(`<loc>http://localhost:5173/viaje/${tripId}</loc><lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`))
    const adm = await call(r.catalogo.GET, as())
    const hidden = adm.data.trips.filter((t) => !t.active || t.departures.every((d) => d < '2026-01-01'))
    assert.ok(hidden.length >= 2)
    for (const t of hidden) assert.doesNotMatch(res.data, new RegExp(`/viaje/${t.id}<`))
  })
})


describe('disponibilidad y página del viaje con vista previa en la dirección de la web', () => {
  const SHELL = `<!doctype html><html lang="es-AR"><head><meta charset="UTF-8" />
<title>Viajes con Karen | General</title>
<meta name="description" content="general" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://x.y/" />
<meta property="og:title" content="general" />
<meta property="og:image" content="https://x.y/og-default.jpg" />
<meta name="twitter:title" content="general" />
<script type="module" crossorigin src="/assets/index-abc123.js"></script></head>
<body><div id="root"></div></body></html>`
  const avail = (id) => call(r.disponibilidad.GET, { params: { id: String(id) }, origin: null })
  const page = (id) => call(r.pagina.GET, { params: { id: String(id) }, origin: null })
  let okId, offId, oldId, shareId
  const realFetch = globalThis.fetch
  let fetchCalls = 0
  test('estados: ok, vencido (con título), desactivado y no existe (sin revelar nada)', async () => {
    const dest = await call(r.destinos.POST, as({ method: 'POST', body: { name: 'Destino Pagina', country: 'Chile', scope: 'internacional', images: ['https://res.cloudinary.com/demo/image/upload/v1/viajes/foto.jpg'] } }))
    shareId = (await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ destinationId: dest.data.id, title: 'Chile "<b>mágico</b>" & más', summary: 'Resumen del viaje para compartir.' }) }))).data.id
    okId = (await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Disponible OK' }) }))).data.id
    oldId = (await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Cartel Vencido', departure: undefined, departures: ['2020-02-02'] }) }))).data.id
    offId = (await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Secreto Apagado', active: false }) }))).data.id
    assert.deepEqual((await avail(okId)).data, { status: 'ok' })
    assert.deepEqual((await avail(oldId)).data, { status: 'expired', title: 'Cartel Vencido' })
    assert.deepEqual((await avail(offId)).data, { status: 'inactive' })
    assert.deepEqual((await avail(999999)).data, { status: 'missing' })
    assert.deepEqual((await avail('abc')).data, { status: 'missing' })
    // un viaje desactivado Y vencido sigue siendo "desactivado"
    const both = await call(r.viajes.POST, as({ method: 'POST', body: validTrip({ title: 'Doble', active: false, departure: undefined, departures: ['2020-01-01'] }) }))
    assert.deepEqual((await avail(both.data.id)).data, { status: 'inactive' })
  })
  test('la página inyecta las etiquetas del viaje en el index.html de la web', async () => {
    const { resetShellCache } = await import('../lib/share.js')
    resetShellCache()
    globalThis.fetch = async (url) => { fetchCalls += 1; assert.equal(url, 'http://localhost:5173/index.html'); return new Response(SHELL, { status: 200 }) }
    try {
      const res = await page(shareId)
      assert.equal(res.status, 200)
      const body = res.data
      assert.equal((body.match(/og:title/g) || []).length, 1, 'no quedan etiquetas duplicadas')
      assert.equal((body.match(/<title>/g) || []).length, 1)
      assert.doesNotMatch(body, /general/)
      assert.match(body, /<title>Chile &quot;&lt;b&gt;mágico&lt;\/b&gt;&quot; &amp; más – Destino Pagina, Chile \| Viajes con Karen<\/title>/)
      assert.match(body, new RegExp(`og:url" content="http://localhost:5173/viaje/${shareId}"`))
      assert.match(body, new RegExp(`rel="canonical" href="http://localhost:5173/viaje/${shareId}"`))
      assert.match(body, /og:image" content="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/c_fill/)
      assert.match(body, /content="index, follow, max-image-preview:large"/)
      assert.match(body, /<script type="module" crossorigin src="\/assets\/index-abc123\.js">/, 'los scripts de la web no se tocan')
      assert.match(body, /<div id="root"><\/div>/)
      // segunda visita: usa la copia guardada (no vuelve a pedir el index.html)
      const before = fetchCalls
      await page(shareId)
      assert.equal(fetchCalls, before)
    } finally { globalThis.fetch = realFetch }
  })
  test('vencido, desactivado, inexistente o id inválido: etiquetas generales + noindex', async () => {
    const { resetShellCache } = await import('../lib/share.js')
    resetShellCache()
    globalThis.fetch = async () => new Response(SHELL, { status: 200 })
    try {
      const old = (await page(oldId)).data
      assert.match(old, /<title>Viaje no disponible \| Viajes con Karen<\/title>/)
      assert.match(old, /noindex/); assert.doesNotMatch(old, /Cartel Vencido/)
      for (const id of [offId, 999999, 'abc']) {
        const b = (await page(id)).data
        assert.match(b, /<title>Viajes con Karen \| /); assert.match(b, /noindex/); assert.doesNotMatch(b, /Secreto Apagado/)
      }
    } finally { globalThis.fetch = realFetch }
  })
  test('si la web no responde usa la última copia; si nunca la tuvo, 503', async () => {
    const { resetShellCache } = await import('../lib/share.js')
    globalThis.fetch = async () => new Response(SHELL, { status: 200 })
    resetShellCache(); await page(shareId)
    globalThis.fetch = async () => { throw new Error('caída') }
    try {
      // la copia sigue vigente (30 s): responde igual
      assert.equal((await page(shareId)).status, 200)
      resetShellCache()
      const res = await page(shareId)
      assert.equal(res.status, 503)
      globalThis.fetch = async () => new Response('<html>no es la web</html>', { status: 200 })
      assert.equal((await page(shareId)).status, 503, 'un HTML que no es la app no se usa')
    } finally { globalThis.fetch = realFetch }
  })
})

describe('logout y cierre', () => {
  test('logout limpia la cookie', async () => {
    const res = await call(r.logout.POST, as({ method: 'POST', body: {} }))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/)
  })
  test('el esquema impide datos incoherentes aunque se salte la API', async () => {
    await assert.rejects(
      psqlQuery(`INSERT INTO trips (category, destination_id, title, summary, currency, price, nights, departure, origin)
                 VALUES ('vuelo', 1, 'xxx', 'resumen largo ok', 'USD', 10, 3, '2027-01-01', 'BA') RETURNING id`),
      (e) => e.code === '23514'
    )
  })
  test('seed --force vacía y recarga', async () => {
    const res = await seedCatalog({ force: true })
    assert.equal(res.trips, 22)
    const [{ t, s }] = await psqlQuery('SELECT (SELECT count(*) FROM trips)::int AS t, (SELECT count(*) FROM inquiries)::int AS s')
    assert.equal(t, 22); assert.equal(s, 0)
    const next = await psqlQuery(`SELECT nextval(pg_get_serial_sequence('trips','id')) AS n`)
    assert.equal(Number(next[0].n), 23)
  })
})
