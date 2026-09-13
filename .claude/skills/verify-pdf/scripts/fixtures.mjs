// Fixture files for end-to-end checks, written with the same pdf-lib the app
// uses.
//
//   node fixtures.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

const out = process.argv[2]
if (!out) {
  console.error('usage: node fixtures.mjs <out-dir>')
  process.exit(2)
}
mkdirSync(out, { recursive: true })

const fontFile = (name) => readFileSync(new URL(`../../../../public/fonts/${name}`, import.meta.url))

const save = (name, bytes) => {
  writeFileSync(join(out, name), bytes)
  console.log(`wrote ${join(out, name)}`)
}

/** Three pages: body text, a table, a rotated run, a landscape page. */
async function samplePdf() {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const times = await doc.embedFont(StandardFonts.TimesRoman)

  const p1 = doc.addPage([595, 842])
  p1.drawText('Quarterly Business Review', { x: 60, y: 760, size: 22, font: bold })
  p1.drawText('Prepared by the Operations team', {
    x: 60,
    y: 735,
    size: 11,
    font: helv,
    color: rgb(0.35, 0.35, 0.4),
  })
  const paragraph = [
    'Revenue grew by eleven percent across the quarter, driven mainly by',
    'renewals in the enterprise segment. Churn stayed flat at two percent,',
    'and the support backlog fell from 340 open tickets to 96 by quarter end.',
    'The team shipped fourteen customer-facing changes over the period.',
  ]
  paragraph.forEach((t, i) => p1.drawText(t, { x: 60, y: 680 - i * 16, size: 11, font: times }))

  p1.drawText('Region', { x: 60, y: 580, size: 11, font: bold })
  p1.drawText('Revenue', { x: 260, y: 580, size: 11, font: bold })
  p1.drawText('Growth', { x: 420, y: 580, size: 11, font: bold })
  const rows = [
    ['Europe', '1,204,000', '+11%'],
    ['North America', '2,880,500', '+7%'],
    ['APAC', '640,250', '+19%'],
  ]
  rows.forEach((row, i) => {
    row.forEach((cell, c) => p1.drawText(cell, { x: [60, 260, 420][c], y: 560 - i * 18, size: 11, font: helv }))
  })

  p1.drawText('CONFIDENTIAL', {
    x: 500,
    y: 120,
    size: 26,
    font: bold,
    color: rgb(0.85, 0.85, 0.9),
    rotate: degrees(90),
  })
  p1.drawRectangle({ x: 60, y: 100, width: 475, height: 60, color: rgb(0.94, 0.96, 1) })
  p1.drawText('Footnote: figures are unaudited.', { x: 70, y: 125, size: 9, font: helv })

  const p2 = doc.addPage([595, 842])
  p2.drawText('Appendix A', { x: 60, y: 760, size: 18, font: bold })
  p2.drawText('Detailed regional breakdown follows on the next page.', { x: 60, y: 730, size: 11, font: helv })

  const p3 = doc.addPage([842, 595])
  p3.drawText('Landscape chart page', { x: 60, y: 520, size: 18, font: bold })

  return doc.save()
}

/** Real TrueType faces embedded whole, so the editor has fonts to reuse. */
async function embeddedPdf() {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const body = await doc.embedFont(fontFile('merriweather-regular.ttf'), { subset: false })
  const heading = await doc.embedFont(fontFile('playfair-bold.ttf'), { subset: false })

  const p = doc.addPage([595, 842])
  p.drawText('Embedded Font Heading', { x: 60, y: 760, size: 24, font: heading })
  p.drawText('This body line uses an embedded Merriweather face.', { x: 60, y: 700, size: 13, font: body })
  p.drawText('Second body line for paragraph grouping.', { x: 60, y: 680, size: 13, font: body })
  p.drawText('Third body line so the block is unmistakable.', { x: 60, y: 660, size: 13, font: body })
  p.drawText('Keep this prefix and change the tail', {
    x: 60,
    y: 600,
    size: 13,
    font: body,
    color: rgb(0.1, 0.1, 0.2),
  })
  return doc.save()
}

/** Every AcroForm field type the editor fills, plus text to find and redact. */
async function formPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([595, 842])
  const form = doc.getForm()
  const label = (text, y) => page.drawText(text, { x: 60, y, size: 11, font, color: rgb(0.25, 0.25, 0.3) })

  page.drawText('Membership application', { x: 60, y: 770, size: 20, font: bold })

  label('Full name', 720)
  form.createTextField('applicant.name').addToPage(page, { x: 60, y: 695, width: 300, height: 20 })

  label('Notes', 650)
  const notes = form.createTextField('applicant.notes')
  notes.enableMultiline()
  notes.addToPage(page, { x: 60, y: 580, width: 400, height: 60 })

  label('Newsletter', 540)
  form.createCheckBox('applicant.newsletter').addToPage(page, { x: 60, y: 515, width: 16, height: 16 })

  label('Membership type', 480)
  const tier = form.createRadioGroup('applicant.tier')
  tier.addOptionToPage('standard', page, { x: 60, y: 455, width: 15, height: 15 })
  tier.addOptionToPage('premium', page, { x: 160, y: 455, width: 15, height: 15 })
  page.drawText('Standard', { x: 80, y: 458, size: 10, font })
  page.drawText('Premium', { x: 180, y: 458, size: 10, font })

  label('Country', 420)
  const country = form.createDropdown('applicant.country')
  country.addOptions(['United Kingdom', 'Ireland', 'France', 'Germany'])
  country.addToPage(page, { x: 60, y: 395, width: 200, height: 20 })

  page.drawText('Account number 4915 2200 1187 0031', { x: 60, y: 330, size: 12, font })
  page.drawText('Secret code: HUNTER2', { x: 60, y: 305, size: 12, font })
  page.drawText('The word secret appears here, and secret again.', { x: 60, y: 275, size: 12, font })
  return doc.save()
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes) => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** An RGBA PNG, encoded by hand so the fixtures need nothing beyond pdf-lib. */
function png(width, height, pixel) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * stride + 1 + x * 4)
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(body))
    return Buffer.concat([head, body, tail])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** A ringed disc on a transparent square: alpha has to survive import. */
const logo = png(200, 200, (x, y) => {
  const r = Math.hypot(x - 100, y - 100)
  if (r <= 80) return [255, 168, 0, 255]
  if (r <= 92) return [43, 29, 0, 255]
  return [0, 0, 0, 0]
})

save('sample.pdf', await samplePdf())
save('embedded.pdf', await embeddedPdf())
save('form.pdf', await formPdf())
save('logo.png', logo)
