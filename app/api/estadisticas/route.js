export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getStats } from '../../../lib/repo/stats.js'
import { json, route } from '../../../lib/http.js'

// Solo administración: ?dias=7|30|90 (por defecto 30).
export const GET = route(async ({ request }) => {
  const raw = Number(new URL(request.url).searchParams.get('dias'))
  const days = [7, 30, 90].includes(raw) ? raw : 30
  return json(await getStats(days))
}, { auth: true })
