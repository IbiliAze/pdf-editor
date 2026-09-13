import { buildApp } from './app.js'

const app = await buildApp()

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

try {
  await app.listen({ port: app.config.PORT, host: app.config.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
