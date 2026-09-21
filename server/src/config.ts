import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /**
   * MySQL. The defaults are the production stack: proxysql on the shared
   * db-network overlay. A development machine overrides host, port and
   * credentials.
   */
  DB_HOST: z.string().default('proxysql'),
  DB_PORT: z.coerce.number().int().positive().default(6033),
  DB_NAME: z.string().default('pdf_editor'),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  /** the site the app is served from; also the only accepted Origin */
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Secure cookies must be off for plain-http local development */
  SECURE_COOKIES: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** how many proxies sit in front of us (nginx site + app nginx) */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(2),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Eight Mile PDF <no-reply@eightmile.co.uk>'),
  /** writes mails to the log instead of sending them (dev, tests) */
  MAIL_TRANSPORT: z.enum(['smtp', 'json']).default('smtp'),

  LOG_LEVEL: z.string().default('info'),
})

export type Config = z.infer<typeof schema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid configuration: ${detail}`)
  }
  return parsed.data
}
