import { basename, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { PAGES, pageByFile, pageByPath } from './pages'
import { renderPage, sitemapXml } from './render'

/**
 * One editor, several pages. Every stub HTML file in the repo root is a Vite
 * entry; this fills in its head and landing copy from `pages.ts`, serves the
 * clean URLs in development (nginx does `$uri.html` in production) and writes
 * the sitemap.
 */
export function seoPages(): Plugin {
  return {
    name: 'eightmile-seo-pages',

    config(userConfig) {
      const root = userConfig.root ?? process.cwd()
      const input = Object.fromEntries(
        PAGES.map((p) => [p.file.replace(/\.html$/, ''), resolve(root, p.file)]),
      )
      return { build: { rollupOptions: { input } } }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = pageByFile(basename(ctx.filename))
        return page ? renderPage(html, page) : html
      },
    },

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0].replace(/\/+$/, '')
        const page = path && pageByPath(path)
        if (page) req.url = `/${page.file}${req.url?.slice(path.length) ?? ''}`
        next()
      })
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() })
    },
  }
}
