import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'

// The database tests went when the API moved to MySQL: there is no in-memory
// MySQL, and a test server is more machinery than this app is worth. What is
// left is the configuration gate, which is what actually goes wrong on a
// deploy.
const credentials = { DB_USERNAME: 'u', DB_PASSWORD: 'p' } as NodeJS.ProcessEnv

describe('configuration', () => {
  it('defaults the database to the production stack', () => {
    const config = loadConfig(credentials)
    expect(config.DB_HOST).toBe('proxysql')
    expect(config.DB_PORT).toBe(6033)
    expect(config.DB_NAME).toBe('pdf_editor')
  })

  it('refuses to start without database credentials', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DB_USERNAME/)
  })

  it('takes a development server from the environment', () => {
    const config = loadConfig({
      ...credentials,
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_NAME: 'pdf_editor_dev',
    } as NodeJS.ProcessEnv)
    expect(config.DB_HOST).toBe('127.0.0.1')
    expect(config.DB_PORT).toBe(3306)
    expect(config.DB_NAME).toBe('pdf_editor_dev')
  })

  it('reads booleans as words, not truthiness', () => {
    expect(loadConfig({ ...credentials, SECURE_COOKIES: 'false' } as NodeJS.ProcessEnv).SECURE_COOKIES).toBe(false)
    expect(loadConfig(credentials).SECURE_COOKIES).toBe(true)
    expect(() => loadConfig({ ...credentials, SECURE_COOKIES: '0' } as NodeJS.ProcessEnv)).toThrow()
  })
})
