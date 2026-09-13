import { describe, expect, it } from 'vitest'
import { PAGES, pageByPath } from '../pages'
import { headHtml, landingHtml, renderPage, sitemapXml } from '../render'

const STUB = `<!doctype html>
<html lang="en">
  <head>
    <!--seo:head-->
  </head>
  <body>
    <div id="root"></div>
    <!--seo:landing-->
  </body>
</html>`

describe('seo pages', () => {
  it('gives every page a unique title, description and canonical', () => {
    const titles = new Set(PAGES.map((p) => p.title))
    const descriptions = new Set(PAGES.map((p) => p.description))
    expect(titles.size).toBe(PAGES.length)
    expect(descriptions.size).toBe(PAGES.length)
    for (const page of PAGES) {
      const head = headHtml(page)
      expect(head).toContain(`<link rel="canonical" href="https://pdf-editor.eightmile.co.uk${page.path === '/' ? '/' : page.path}" />`)
      expect(page.title.length).toBeLessThanOrEqual(70)
      expect(page.description.length).toBeLessThanOrEqual(160)
    }
  })

  it('renders the copy as plain HTML a crawler can read', () => {
    const html = renderPage(STUB, pageByPath('/redact-pdf')!)
    expect(html).toContain('<h1>Redact a PDF so the content is actually gone</h1>')
    expect(html).toContain('<html lang="en" data-tool="redact" data-heading="Open a PDF to redact it">')
    expect(html).toContain('"@type":"FAQPage"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).not.toContain('<!--seo:')
    // links to every other page, never to itself
    expect(html).toContain('<a href="/edit-pdf-text">')
    expect(html).not.toContain('<a href="/redact-pdf">')
  })

  it('keeps the software listing on the home page only', () => {
    expect(headHtml(pageByPath('/')!)).toContain('"@type":"SoftwareApplication"')
    expect(headHtml(pageByPath('/sign-pdf')!)).not.toContain('"@type":"SoftwareApplication"')
  })

  it('escapes what it prints', () => {
    const page = { ...pageByPath('/')!, h1: 'Tom & "Jerry" <b>', faq: [] }
    const out = landingHtml(page)
    expect(out).toContain('Tom &amp; &quot;Jerry&quot; &lt;b&gt;')
  })

  it('lists every page in the sitemap', () => {
    const xml = sitemapXml()
    for (const page of PAGES) expect(xml).toContain(`<loc>https://pdf-editor.eightmile.co.uk${page.path === '/' ? '/' : page.path}</loc>`)
  })
})
