// Open a PDF, rewrite its first line of text and download the result through
// the export dialog. A starting point: copy it next to the fixtures and extend
// it for the change under test.
//
//   APP=http://localhost:5199 PDF=sample.pdf OUT=out.pdf SESSION=session.json node drive.mjs
//
// Run it from a directory where `playwright` is installed.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// Resolved from the working directory, so the script runs from wherever
// Playwright was installed rather than needing it in the repo.
const { chromium } = createRequire(join(process.cwd(), 'noop.js'))('playwright')

const APP = process.env.APP ?? 'http://localhost:5199'
const PDF = process.env.PDF ?? 'sample.pdf'
const OUT = process.env.OUT ?? 'out.pdf'
const SESSION = process.env.SESSION ?? 'session.json'
const TEXT = process.env.TEXT ?? 'Edited by verify-pdf'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const shot = (name) => `${OUT.replace(/\.pdf$/, '')}-${name}.png`

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const { cookie } = JSON.parse(readFileSync(SESSION, 'utf8'))
await context.addCookies([{ ...cookie, url: APP }])

const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(APP, { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', PDF)
await page.waitForSelector('.page-wrap canvas', { timeout: 20_000 })
await page.waitForSelector('.line-hit', { timeout: 20_000 })
await page.screenshot({ path: shot('1-open') })

// Rewrite the first run of text on the first page.
await page.locator('.line-hit').first().click({ force: true })
await page.waitForSelector('.line-editor')
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
await page.keyboard.type(TEXT)
await page.keyboard.press('Enter')
await page.screenshot({ path: shot('2-edited') })

// Download PDF opens the export dialog; the file comes from its Download button.
await page.getByRole('button', { name: 'Download PDF' }).click()
const dialog = page.getByRole('dialog')
await dialog.waitFor()
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30_000 }),
  dialog.getByRole('button', { name: 'Download', exact: true }).click(),
])
await download.saveAs(OUT)
console.log(`saved ${OUT}`)

await browser.close()
if (errors.length) {
  console.error(`console errors:\n${errors.join('\n')}`)
  process.exit(1)
}
