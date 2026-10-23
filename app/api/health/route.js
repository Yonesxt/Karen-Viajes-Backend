export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { query } from '../../../lib/db.js'
import { json, route } from '../../../lib/http.js'

export const GET = route(async () => {
  try {
    await query('SELECT 1 AS ok')
    return json({ ok: true })
  } catch (e) {
    console.error('[health] sin conexión a la base:', e.message)
    return json({ ok: false }, 503)
  }
})
