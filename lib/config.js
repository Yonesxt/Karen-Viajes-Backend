// Lectura de variables de entorno (se evalúa en cada uso para que sea fácil de probar).

const bool = (v, def = false) => (v == null || v === '' ? def : ['1', 'true', 'yes', 'si'].includes(String(v).toLowerCase()))

export function config() {
  const env = process.env
  const sameSite = (env.COOKIE_SAMESITE || 'lax').toLowerCase()
  return {
    isProd: env.NODE_ENV === 'production',
    jwtSecret: env.JWT_SECRET || '',
    sessionDays: Math.max(1, Number(env.SESSION_DAYS) || 7),
    allowedOrigins: (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    cookieSameSite: ['lax', 'strict', 'none'].includes(sameSite) ? sameSite : 'lax',
    cookieDomain: env.COOKIE_DOMAIN || '',
    // Alternativa a la cookie cuando front y API están en dominios distintos y el navegador bloquea cookies de terceros.
    allowBearer: bool(env.ALLOW_BEARER_TOKEN, false),
    trustProxy: bool(env.TRUST_PROXY, true),
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: env.CLOUDINARY_API_KEY || '',
      apiSecret: env.CLOUDINARY_API_SECRET || '',
      folder: (env.CLOUDINARY_FOLDER || 'viajes-con-karen').replace(/^\/+|\/+$/g, ''),
      deleteOrphans: bool(env.CLOUDINARY_DELETE_ORPHANS, false),
    },
  }
}
