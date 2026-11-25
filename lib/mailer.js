// Envío de mails por la API HTTPS de Resend (sin dependencias).
// Se usa HTTPS y no SMTP porque Render (plan free) bloquea los puertos SMTP (25/465/587).
// sendMail NUNCA lanza error: devuelve { ok, error } para que un mail caído no tire abajo la solicitud.
import { config } from './config.js'

let override = null
// Solo para pruebas: reemplaza el envío real.
export const setMailImpl = (fn) => {
  override = fn
}

export const mailConfigured = () => Boolean(override || config().mail.apiKey)

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim()

export async function sendMail({ to, subject, text, html, replyTo }) {
  const msg = { to, subject: oneLine(subject), text, html, replyTo }
  if (override) {
    try {
      return await override(msg)
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  }
  const { apiKey, from } = config().mail
  if (!apiKey) return { ok: false, error: 'Falta RESEND_API_KEY: el mail no se envió.' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: msg.subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false, error: `Resend respondió ${res.status}: ${(await res.text()).slice(0, 300)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
