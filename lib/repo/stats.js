import { query } from '../db.js'
import { todayAR } from './trips.js'

export const STAT_KINDS = ['view', 'whatsapp']

// Suma 1 al contador del día. Solo cuenta viajes que existen y están activos.
export async function recordEvent(tripId, kind, day = todayAR()) {
  const rows = await query(
    `INSERT INTO trip_stats_daily (day, trip_id, kind, count)
     SELECT $1::date, t.id, $3::text, 1 FROM trips t WHERE t.id = $2::integer AND t.active
     ON CONFLICT (day, trip_id, kind) DO UPDATE SET count = trip_stats_daily.count + 1
     RETURNING count`,
    [day, tripId, kind]
  )
  return rows.length > 0
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Resumen para el panel: últimos `days` días (incluido hoy) + consultas por mes (últimos 12 meses).
export async function getStats(days = 30, today = todayAR()) {
  const since = addDays(today, -(days - 1))

  const daily = await query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, sum(count)::int AS n
     FROM trip_stats_daily WHERE day >= $1::date AND day <= $2::date GROUP BY day, kind`,
    [since, today]
  )
  const inqDaily = await query(
    `SELECT to_char((created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS day, count(*)::int AS n
     FROM inquiries
     WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= $1::date
       AND (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= $2::date
     GROUP BY 1`,
    [since, today]
  )
  const series = []
  const idx = {}
  for (let i = 0; i < days; i++) {
    const day = addDays(since, i)
    idx[day] = series.length
    series.push({ day, views: 0, whatsapp: 0, inquiries: 0 })
  }
  for (const r of daily) if (idx[r.day] != null) series[idx[r.day]][r.kind === 'view' ? 'views' : 'whatsapp'] = r.n
  for (const r of inqDaily) if (idx[r.day] != null) series[idx[r.day]].inquiries = r.n

  const perTripStats = await query(
    `SELECT trip_id, kind, sum(count)::int AS n FROM trip_stats_daily
     WHERE day >= $1::date AND day <= $2::date GROUP BY trip_id, kind`,
    [since, today]
  )
  const perTripInq = await query(
    `SELECT trip_id, count(*)::int AS n FROM inquiries
     WHERE trip_id IS NOT NULL
       AND (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= $1::date
       AND (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= $2::date
     GROUP BY trip_id`,
    [since, today]
  )
  const titles = await query('SELECT id, title FROM trips')
  const titleOf = Object.fromEntries(titles.map((t) => [t.id, t.title]))
  const byTrip = {}
  const row = (id) => (byTrip[id] ||= { tripId: id, title: titleOf[id] || 'Viaje eliminado', views: 0, whatsapp: 0, inquiries: 0 })
  for (const r of perTripStats) row(r.trip_id)[r.kind === 'view' ? 'views' : 'whatsapp'] = r.n
  for (const r of perTripInq) row(r.trip_id).inquiries = r.n
  const trips = Object.values(byTrip).sort((a, b) => b.views - a.views || b.inquiries - a.inquiries || a.title.localeCompare(b.title, 'es'))

  const monthStart = addDays(`${today.slice(0, 7)}-01`, 0)
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${monthStart}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }
  const inqMonths = await query(
    `SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') AS month, count(*)::int AS n
     FROM inquiries
     WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= $1::date
     GROUP BY 1`,
    [`${months[0]}-01`]
  )
  const mi = Object.fromEntries(inqMonths.map((r) => [r.month, r.n]))

  const sum = (k) => series.reduce((a, r) => a + r[k], 0)
  return {
    days,
    since,
    until: today,
    totals: { views: sum('views'), whatsapp: sum('whatsapp'), inquiries: sum('inquiries') },
    series,
    trips,
    inquiriesByMonth: months.map((m) => ({ month: m, count: mi[m] || 0 })),
  }
}
