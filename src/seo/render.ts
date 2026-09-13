import { PAGES, SITE } from './pages'
import type { PageDef } from './pages'

const EIGHTMILE = 'https://eightmile.co.uk/saas?utm_source=pdf-editor&utm_medium=app&utm_campaign=landing'

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const url = (page: PageDef) => (page.path === '/' ? `${SITE}/` : `${SITE}${page.path}`)

/** Everything that goes in <head>: title, description, social tags, structured data. */
export function headHtml(page: PageDef): string {
  const isHome = page.path === '/'
  const ld: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]
  if (isHome) {
    ld.unshift({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Eight Mile PDF',
      url: url(page),
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern browser',
      description: page.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      publisher: { '@type': 'Organization', name: 'Eight Mile', url: 'https://eightmile.co.uk' },
    })
  } else {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Eight Mile PDF', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: page.label, item: url(page) },
      ],
    })
  }
  const jsonLd = ld
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
    .join('\n    ')

  return `<title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <link rel="canonical" href="${url(page)}" />
    <meta name="theme-color" content="#ffa800" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Eight Mile PDF" />
    <meta property="og:title" content="${esc(page.title)}" />
    <meta property="og:description" content="${esc(page.description)}" />
    <meta property="og:url" content="${url(page)}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(page.title)}" />
    <meta name="twitter:description" content="${esc(page.description)}" />
    <meta name="twitter:image" content="${SITE}/og-image.png" />
    ${jsonLd}`
}

/**
 * The static section below the editor. Plain HTML so a crawler reads it
 * without running the app; the app hides it once a document is open.
 */
export function landingHtml(page: PageDef): string {
  const isHome = page.path === '/'
  const others = PAGES.filter((p) => p !== page)
  const steps = page.steps
    ? isHome
      ? `<ul class="landing-features">${page.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
      : `<h2>How it works</h2><ol class="landing-steps">${page.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
    : ''
  return `<section class="landing" id="about">
      <div class="landing-inner">
        <h1>${esc(page.h1)}</h1>
        <p class="landing-intro">${esc(page.intro)}</p>
        <p><a class="landing-cta" href="#top">Open a PDF</a></p>
        ${steps}
        <h2>Questions</h2>
        ${page.faq
          .map(
            (f) => `<details class="landing-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join('\n        ')}
        <h2>${isHome ? 'By task' : 'More you can do'}</h2>
        <ul class="landing-links">
          ${others.map((p) => `<li><a href="${p.path}">${esc(p.label)}</a></li>`).join('\n          ')}
        </ul>
        <p class="landing-by">
          Eight Mile PDF is free, built by <a href="${EIGHTMILE}" target="_blank" rel="noopener">Eight Mile</a>,
          a studio that designs websites and builds web apps and SaaS products for businesses.
        </p>
      </div>
    </section>`
}

/** Fill the placeholders in a stub page. */
export function renderPage(template: string, page: PageDef): string {
  const attrs = [page.tool ? ` data-tool="${esc(page.tool)}"` : '', page.heading ? ` data-heading="${esc(page.heading)}"` : '']
  return template
    .replace('<html lang="en">', `<html lang="en"${attrs.join('')}>`)
    .replace('<!--seo:head-->', headHtml(page))
    .replace('<!--seo:landing-->', landingHtml(page))
}

export function sitemapXml(): string {
  const entries = PAGES.map(
    (p) => `  <url>\n    <loc>${url(p)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${p.path === '/' ? '1.0' : '0.8'}</priority>\n  </url>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}
