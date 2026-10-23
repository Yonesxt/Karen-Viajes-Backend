export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { clearedCookie } from '../../../../lib/auth.js'
import { json, route } from '../../../../lib/http.js'

export const POST = route(async () => json({ ok: true }, 200, { 'Set-Cookie': clearedCookie() }))
