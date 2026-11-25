export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { config } from '../../../lib/config.js'
import { withdrawalLimiter } from '../../../lib/limiters.js'
import { sendMail } from '../../../lib/mailer.js'
import { createWithdrawal, listWithdrawals, setWithdrawalMailStatus } from '../../../lib/repo/withdrawals.js'
import { HttpError, json, readJson, route } from '../../../lib/http.js'
import { escapeHtml } from '../../../lib/share.js'
import { hasErrors, normalizeWithdrawal, validateWithdrawal } from '../../../lib/validation.js'

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'long', timeStyle: 'short' })

function agencyMail(w) {
  const rows = [
    ['Solicitud Nº', w.id],
    ['Fecha', fmtDate(w.createdAt)],
    ['Nombre', `${w.firstName} ${w.lastName}`],
    ['DNI', w.dni],
    ['E-mail', w.email],
    ['Teléfono', w.phone],
    ['Código de reserva', w.bookingCode],
  ]
  return {
    subject: `Botón de arrepentimiento #${w.id}: ${w.firstName} ${w.lastName} (reserva ${w.bookingCode})`,
    text: ['Nueva solicitud de arrepentimiento:', '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n'),
    html: `<h2>Nueva solicitud de arrepentimiento</h2><table cellpadding="6" style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(String(v))}</td></tr>`)
      .join('')}</table>`,
  }
}

function customerMail(w) {
  const text = [
    `Hola ${w.firstName}!`,
    '',
    `Recibimos tu solicitud de arrepentimiento (Nº ${w.id}) el ${fmtDate(w.createdAt)} para la reserva ${w.bookingCode}.`,
    'Nos vamos a comunicar con vos a la brevedad para continuar con el trámite.',
    '',
    'Viajes con Karen',
  ].join('\n')
  return {
    subject: `Recibimos tu solicitud de arrepentimiento Nº ${w.id}`,
    text,
    html: `<p>Hola ${escapeHtml(w.firstName)}!</p><p>Recibimos tu solicitud de arrepentimiento (<b>Nº ${w.id}</b>) el ${escapeHtml(
      fmtDate(w.createdAt)
    )} para la reserva <b>${escapeHtml(w.bookingCode)}</b>.</p><p>Nos vamos a comunicar con vos a la brevedad para continuar con el trámite.</p><p>Viajes con Karen</p>`,
  }
}

// Público: lo usa el "Botón de arrepentimiento" del footer.
export const POST = route(async ({ request, ip }) => {
  const rl = withdrawalLimiter.hit(ip)
  if (!rl.ok) {
    throw new HttpError(429, 'Enviaste muchas solicitudes seguidas. Probá de nuevo en unos minutos.', null, { 'Retry-After': String(rl.retryAfterSec) })
  }
  const body = await readJson(request)
  // Campo trampa: las personas no lo ven; los bots lo completan. Se responde "ok" sin guardar nada.
  if (typeof body.website === 'string' && body.website.trim()) return json({ id: 0, ok: true }, 201)

  const data = normalizeWithdrawal(body)
  const errors = validateWithdrawal(data)
  if (hasErrors(errors)) throw new HttpError(422, 'Revisá los datos del formulario.', errors)

  const saved = await createWithdrawal(data)

  const toAgency = await sendMail({ to: config().mail.to, replyTo: saved.email, ...agencyMail(saved) })
  if (!toAgency.ok) console.error('[arrepentimiento] no se pudo enviar el mail a la agencia:', toAgency.error)
  await setWithdrawalMailStatus(saved.id, toAgency.ok ? 'enviado' : 'fallido')

  // Constancia para quien la pidió (si falla no importa: la solicitud ya quedó guardada y avisada).
  const toCustomer = await sendMail({ to: saved.email, ...customerMail(saved) })
  if (!toCustomer.ok) console.error('[arrepentimiento] no se pudo enviar la constancia al cliente:', toCustomer.error)

  return json({ id: saved.id, createdAt: saved.createdAt, ok: true }, 201)
})

// Solo panel: ver las solicitudes recibidas (y si el mail salió).
export const GET = route(async () => json(await listWithdrawals()), { auth: true })
