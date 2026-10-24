// CORS: solo los orígenes de ALLOWED_ORIGINS pueden llamar a la API desde el navegador (con cookies).
export function isAllowedOrigin(origin, allowed) {
  return Boolean(origin) && allowed.includes(origin.replace(/\/+$/, ''))
}

export function buildCorsHeaders(origin, allowed) {
  const headers = { Vary: 'Origin' }
  if (isAllowedOrigin(origin, allowed)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    headers['Access-Control-Max-Age'] = '600'
  }
  return headers
}
