// Borra de Cloudinary las imágenes que dejaron de usarse (si CLOUDINARY_DELETE_ORPHANS=true).
// Es "best effort": un error acá nunca debe romper la operación principal.
import { config } from './config.js'
import { deleteImage, publicIdFromUrl } from './cloudinary.js'
import { unusedImages } from './repo/destinations.js'

export async function cleanupImages(removedUrls, exceptDestinationId = 0) {
  try {
    if (!config().cloudinary.deleteOrphans || !removedUrls.length) return
    const candidates = removedUrls.filter((u) => publicIdFromUrl(u))
    for (const url of await unusedImages(candidates, exceptDestinationId)) {
      await deleteImage(url).catch((e) => console.error('[cloudinary] no se pudo borrar', url, e.message))
    }
  } catch (e) {
    console.error('[cloudinary] limpieza de imágenes:', e.message)
  }
}
