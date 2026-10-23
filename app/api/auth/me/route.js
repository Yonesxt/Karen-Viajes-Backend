export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '../../../../lib/http.js'

export const GET = route(async ({ session }) => json({ email: session.email, name: session.name }), { auth: true })
