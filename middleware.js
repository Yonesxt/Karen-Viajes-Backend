import { NextResponse } from 'next/server'
import { buildCorsHeaders } from './lib/cors.js'

// Agrega los encabezados CORS a todas las rutas /api y responde los "preflight" (OPTIONS).
export function middleware(request) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  const headers = buildCorsHeaders(request.headers.get('origin'), allowed)

  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers })

  const response = NextResponse.next()
  for (const [k, v] of Object.entries(headers)) {
    if (k === 'Vary') response.headers.append(k, v)
    else response.headers.set(k, v)
  }
  return response
}

export const config = { matcher: '/api/:path*' }
