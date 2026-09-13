import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { Config } from './config.js'

export interface Mailer {
  sendVerification: (to: string, link: string) => Promise<void>
  sendPasswordReset: (to: string, link: string) => Promise<void>
  sendAlreadyRegistered: (to: string, link: string) => Promise<void>
  sendAccountDeleted: (to: string) => Promise<void>
  sendWelcome: (to: string) => Promise<void>
  /** messages captured in json transport mode; tests read this */
  sent: { to: string; subject: string; text: string }[]
}

/**
 * The tool is free because it introduces people to Eight Mile. Every mail
 * says so once, in a footer, tagged so the click shows up as its own campaign
 * on eightmile.co.uk. Kept to two lines so the mails stay transactional.
 */
export const servicesLink = (campaign: string) =>
  `https://eightmile.co.uk/saas?utm_source=pdf-editor&utm_medium=email&utm_campaign=${campaign}`

const FOOTER_TEXT = 'Eight Mile PDF is a free tool from Eight Mile. We design websites and build SaaS products for businesses:'

const footer = (campaign: string) => `
  <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:24px 0 0;padding-top:14px;border-top:1px solid #e5e7eb">
    ${FOOTER_TEXT}
    <a href="${servicesLink(campaign)}" style="color:#b45309">eightmile.co.uk/saas</a>
  </p>`

const textFooter = (campaign: string) => `\n\n${FOOTER_TEXT} ${servicesLink(campaign)}`

const layout = (title: string, body: string, action: string, link: string, campaign: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 20px">${body}</p>
  <p style="margin:0 0 20px">
    <a href="${link}" style="display:inline-block;background:#ffa800;color:#111827;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px">${action}</a>
  </p>
  <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0">
    If the button does not work, paste this address into your browser:<br>
    <span style="word-break:break-all">${link}</span>
  </p>${footer(campaign)}
</div>`

const plain = (title: string, body: string, campaign: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0">${body}</p>${footer(campaign)}
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
        `Confirm your email address to download edited PDFs: ${link}${textFooter('verify')}`,
        layout(
          'Confirm your email',
          'Confirm your email address and your download will start straight away. The link is good for 24 hours.',
          'Confirm email',
          link,
          'verify',
        ),
      ),
    sendPasswordReset: (to, link) =>
      send(
        to,
        'Reset your Eight Mile PDF password',
        `Reset your password: ${link}${textFooter('reset')}`,
        layout(
          'Reset your password',
          'Choose a new password using the link below. It expires in one hour. If you did not ask for this, you can ignore this email.',
          'Choose a new password',
          link,
          'reset',
        ),
      ),
    sendAccountDeleted: (to) =>
      send(
        to,
        'Your Eight Mile PDF account has been deleted',
        `Your Eight Mile PDF account and its download history have been deleted.${textFooter('deleted')}`,
        plain(
          'Your account has been deleted',
          'Your email address and the record of your downloads have been removed from our database, and you can sign up again at any time. Deleting an account requires its password, so if this was not you, change that password wherever else you use it.',
          'deleted',
        ),
      ),
    sendAlreadyRegistered: (to, link) =>
      send(
        to,
        'Your Eight Mile PDF account',
        `You already have an account. Sign in, or reset your password: ${link}${textFooter('already-registered')}`,
        layout(
          'You already have an account',
          'Someone tried to sign up with this address. If it was you, sign in instead. You can reset your password with the link below.',
          'Reset your password',
          link,
          'already-registered',
        ),
      ),
    sendWelcome: (to) =>
      send(
        to,
        'Your Eight Mile PDF account is ready',
        `Your email is confirmed and downloads are unlocked. Edit text, fill forms, sign, redact, reorder pages and merge files, all in your browser: ${config.APP_ORIGIN}${textFooter('welcome')}`,
        layout(
          'Downloads are unlocked',
          'Your email is confirmed. Edit text, fill forms, sign, redact, reorder pages and merge files, all in your browser. Your PDFs never leave it.',
          'Open the editor',
          config.APP_ORIGIN,
          'welcome',
        ),
      ),
  }
}
