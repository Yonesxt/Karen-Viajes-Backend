// Cloudinary sin SDK: firma de subidas directas desde el navegador y borrado de imágenes.
import { createHash } from 'node:crypto'
import { config } from './config.js'

export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif'

// Firma = sha1( "k1=v1&k2=v2" (ordenado por nombre) + api_secret )
export function signParams(params, apiSecret) {
  const base = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(base + apiSecret).digest('hex')
}

export const isConfigured = () => {
  const c = config().cloudinary
  return Boolean(c.cloudName && c.apiKey && c.apiSecret)
}

// Datos que el navegador necesita para subir una imagen directamente a Cloudinary.
export function createUploadSignature(now = Date.now()) {
  const c = config().cloudinary
  const timestamp = Math.floor(now / 1000)
  const toSign = { allowed_formats: ALLOWED_FORMATS, folder: c.folder, timestamp }
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`,
    apiKey: c.apiKey,
    timestamp,
    folder: c.folder,
    allowedFormats: ALLOWED_FORMATS,
    signature: signParams(toSign, c.apiSecret),
  }
}

// https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<nombre>.jpg  ->  "<folder>/<nombre>"
// Devuelve null si el link no es de NUESTRA cuenta y carpeta (así nunca se borra algo ajeno).
export function publicIdFromUrl(url) {
  const c = config().cloudinary
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+(?:\?.*)?$/.exec(url || '')
  if (!m || m[1] !== c.cloudName) return null
  const publicId = decodeURIComponent(m[2])
  return publicId.startsWith(`${c.folder}/`) && !publicId.includes('..') ? publicId : null
}

export async function deleteImage(url, fetchImpl = fetch) {
  const c = config().cloudinary
  const publicId = publicIdFromUrl(url)
  if (!publicId || !isConfigured()) return false
  const timestamp = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: c.apiKey,
    signature: signParams({ public_id: publicId, timestamp }, c.apiSecret),
  })
  const res = await fetchImpl(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/destroy`, { method: 'POST', body })
  return res.ok
}
