import { createLimiter } from './rateLimit.js'

// Se definen acá (y no en los route.js) porque Next no permite exportar cosas extra desde una ruta.
export const loginIpLimiter = createLimiter({ max: 30, windowMs: 15 * 60 * 1000 })
export const loginAccountLimiter = createLimiter({ max: 8, windowMs: 15 * 60 * 1000 })
export const inquiryLimiter = createLimiter({ max: 6, windowMs: 10 * 60 * 1000 })
