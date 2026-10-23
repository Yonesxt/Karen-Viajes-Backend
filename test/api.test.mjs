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
  firma: (await import('../app/api/imagenes/firma/route.js')),
  consultas: (await import('../app/api/consultas/route.js')),
  consulta: (await import('../app/api/consultas/[id]/route.js')),
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
