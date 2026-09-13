import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { Config } from './config.js'

export interface Mailer {
  sendVerification: (to: string, link: string) => Promise<void>
  sendPasswordReset: (to: string, link: string) => Promise<void>
  sendAlreadyRegistered: (to: string, link: string) => Promise<void>
  /** messages captured in json transport mode; tests read this */
  sent: { to: string; subject: string; text: string }[]
}

const layout = (title: string, body: string, action: string, link: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 20px">${body}</p>
  <p style="margin:0 0 20px">
    <a href="${link}" style="display:inline-block;background:#ffa800;color:#111827;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px">${action}</a>
  </p>
  <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0">
    If the button does not work, paste this address into your browser:<br>
    <span style="word-break:break-all">${link}</span>
  </p>
</div>`

export function createMailer(config: Config): Mailer {
  const sent: Mailer['sent'] = []
  let transporter: Transporter

  const local = config.MAIL_TRANSPORT === 'json' || !config.SMTP_HOST
  if (local) {
    transporter = nodemailer.createTransport({ jsonTransport: true })
  } else {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  }

  const send = async (to: string, subject: string, text: string, html: string) => {
    sent.push({ to, subject, text })
    // Without a real SMTP server the link would be unreachable, so print it.
    if (local) console.log(`[mail] to=${to} subject="${subject}" ${text}`)
    if (sent.length > 50) sent.shift()
    await transporter.sendMail({ from: config.MAIL_FROM, to, subject, text, html })
  }

  return {
    sent,
    sendVerification: (to, link) =>
      send(
        to,
        'Confirm your Eight Mile PDF account',
        `Confirm your email address to download edited PDFs: ${link}`,
        layout(
          'Confirm your email',
          'Confirm your email address and your download will start straight away. The link is good for 24 hours.',
          'Confirm email',
          link,
        ),
      ),
    sendPasswordReset: (to, link) =>
      send(
        to,
        'Reset your Eight Mile PDF password',
        `Reset your password: ${link}`,
        layout(
          'Reset your password',
          'Choose a new password using the link below. It expires in one hour. If you did not ask for this, you can ignore this email.',
          'Choose a new password',
          link,
        ),
      ),
    sendAlreadyRegistered: (to, link) =>
      send(
        to,
        'Your Eight Mile PDF account',
        `You already have an account. Sign in, or reset your password: ${link}`,
        layout(
          'You already have an account',
          'Someone tried to sign up with this address. If it was you, sign in instead. You can reset your password with the link below.',
          'Reset your password',
          link,
        ),
      ),
  }
}
