export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createUploadSignature, isConfigured } from '../../../../lib/cloudinary.js'
import { HttpError, json, route } from '../../../../lib/http.js'

// El navegador pide una firma y sube la imagen directo a Cloudinary (el archivo no pasa por este servidor).
export const POST = route(async () => {
  if (!isConfigured()) throw new HttpError(503, 'Cloudinary no está configurado en el servidor.')
  return json(createUploadSignature())
}, { auth: true })
