// Utilidades HTTP: respuestas JSON, errores, lectura segura del body y el envoltorio route().
import { config } from './config.js'
import { isAllowedOrigin } from './cors.js'
import { getSession } from './auth.js'

export class HttpError extends Error {
  constructor(status, message, fields = null, headers = null) {
    super(message)
    this.status = status
    this.fields = fields
    this.headers = headers
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })

export function errorResponse(e) {
  if (e instanceof HttpError) {
    return json({ error: e.message, ...(e.fields ? { fields: e.fields } : {}) }, e.status, e.headers || {})
  }
  console.error('[api] error inesperado:', e)
  return json({ error: 'Error interno del servidor.' }, 500)
}

const MAX_BODY = 100 * 1024

// Lee el body JSON. Exige Content-Type: application/json (los formularios "simples" de otros
// sitios no pueden enviar ese tipo sin pasar por CORS, lo que frena ataques CSRF).
export async function readJson(request) {
  const type = request.headers.get('content-type') || ''
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'El contenido debe ser application/json.')
  }
  const text = await request.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'La solicitud es demasiado grande.')
  try {
    const data = JSON.parse(text)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('no es un objeto')
    return data
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud no es un JSON válido.')
  }
}

// Id numérico de la URL (/api/viajes/12). Rechaza cualquier otra cosa.
export function parseId(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) throw new HttpError(404, 'No encontrado.')
  return n
}

export function clientIp(request) {
  if (config().trustProxy) {
    const fwd = request.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()
    const real = request.headers.get('x-real-ip')
    if (real) return real.trim()
  }
  return 'desconocida'
}

// Si el navegador informa un Origin (siempre lo hace en pedidos que modifican datos) tiene que
// ser uno permitido. Sin Origin (curl, servidores) no hay riesgo de CSRF porque no hay cookie de navegador.
function checkOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const origin = request.headers.get('origin')
  if (origin && !isAllowedOrigin(origin, config().allowedOrigins)) throw new HttpError(403, 'Origen no permitido.')
}

// route(handler, { auth }) => función para exportar como GET/POST/... de un route.js
// El handler recibe { request, params, session, ip }.
export function route(handler, { auth = false } = {}) {
  return async (request, context) => {
    try {
      checkOrigin(request)
      const session = await getSession(request)
      if (auth && !session) throw new HttpError(401, 'Tenés que iniciar sesión.')
      const params = context?.params ? await context.params : {}
      return await handler({ request, params, session, ip: clientIp(request) })
    } catch (e) {
      return errorResponse(e)
    }
  }
}
