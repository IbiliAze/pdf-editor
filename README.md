<p align="center">
  <img src="public/eight-mile-pdf-logo.png" alt="Eight Mile PDF logo" width="112" />
</p>

# Eight Mile PDF

A PDF editor that runs in the browser. Your file is opened, edited and written
locally — it is never uploaded. Downloading requires a confirmed account, and
only your email address, your news preference and a record of each download
reach the server.

- **URL:** https://pdf-editor.eightmile.co.uk

## Run it

```sh
npm install
npm run dev                       # the editor on :5173

cd server && npm install
DATABASE_PATH=./dev.db SECURE_COOKIES=false MAIL_TRANSPORT=json \
  npm run dev                     # the account API on :3000
```

`DATABASE_PATH` defaults to `/data/app.db`, the production volume, which does
not exist on a development machine.

The dev server proxies `/api` to `http://localhost:3000`; set
`API_PROXY_TARGET` to point somewhere else. Without `SMTP_HOST`, or with
`MAIL_TRANSPORT=json`, the API prints confirmation and reset links to its
console instead of sending them.

```sh
npm run lint && npm test && npm run build
cd server && npm run typecheck && npm test
```

## What it does

**Text.** Click any line and rewrite it. Click into the middle of a line and
the caret lands where you clicked, so a single word can be changed and the
untouched leading glyphs are left exactly as they were. Switch to *Edit
paragraph* to edit a whole block, which re-wraps inside the original column
width. Rotated, angled and very small text is editable too.

Replacement text is drawn in the typeface the document actually embedded when
that font can render it, so an edit is usually indistinguishable from the
original. Otherwise it falls back to a bundled family chosen to match: Arimo
for Arial and Helvetica, Tinos for Times, Cousine for Courier, Carlito for
Calibri, Caladea for Cambria. Those substitutes share the originals' advance
widths, so a replacement keeps the length of the run it covers.

**Pages.** A thumbnail rail to reorder by dragging, rotate, duplicate, delete,
insert blank pages, merge another PDF in, extract a selection, or split by page
ranges into separate files.

**Things you add.** Text boxes, images, rectangles, ellipses, lines, arrows,
freehand pen, highlights, whiteout, sticky notes and links. Signatures can be
drawn, typed in a script face, or uploaded as a photo with the background
removed; they are remembered in your browser for reuse.

**Forms.** Fillable fields are detected and overlaid with real inputs. The
export updates the document's own form, so the result is still fillable, or
flattens it if you ask.

**Redaction.** Covering something leaves it in the file, where it is still
selectable and searchable. *Redact* removes it: the page is rendered to an
image with the marked areas painted out and written as a new page, so the
content is not in the file at all. The cost is that text on that page stops
being selectable.

**Find.** Search every page, step through matches, and highlight or redact all
of them at once.

**Document.** Watermark, page numbers, header and footer, each with its own
page range and previewed live. The download dialog adds a page range, form
flattening, and password protection.

Password-protected files can be opened: the password is used in your browser to
decrypt the bytes and is never sent anywhere.

## How text editing works

The PDF's own content streams are never rewritten. That approach fails on
subsetted and CID-encoded fonts, which is most real documents. Instead:

1. pdf.js renders each page. The operator list is built first so the real font
   names — and the font bytes themselves — are available.
2. Text items are projected into the page's display space and grouped into
   editable runs, then runs into paragraphs. Each run keeps its per-item spans,
   its angle, and its raw PDF-space origin.
3. Clicking a run samples the rendered canvas for the background and text
   colour and opens an editor styled to match.
4. On export, pdf-lib paints a rectangle in the sampled background colour over
   the part of the run that changed and draws the replacement at the run's
   exact original baseline, rotated to the run's own angle.

The trade-off: a flat cover rectangle over a gradient or an image will show.

## Project structure

TypeScript throughout. Types are the map: start at `src/types.ts`.

```
src/
  main.tsx              entry; /verify and /reset are served here too
  App.tsx               layout shell and the dialogs
  types.ts              page model, elements, sessions, registry contracts
  store/                zustand slices: document, elements+history, editor, ui, assets
  features/
    registry.ts         element kinds and tools; the extension point
    text-edit/          native text and paragraph editing
    annotate/           text boxes, whiteout, highlight, pen
    pages/              thumbnail rail and page operations
    images/ shapes/ signatures/
    forms/ redaction/ search/
    annotations/        sticky notes and links
    doc-tools/          watermark, page numbers, header/footer, export dialog
    auth/               accounts and the download gate
  lib/
    pdfjs.ts            worker setup
    textLayer.ts        run extraction, paragraph grouping, colour sampling
    pageModel.ts        pure page operations
    geometry.ts         rotation and rectangle maths
    fonts.ts            font matching and the bundled families
    export/
      buildPdf.ts       the export pipeline
      transform.ts      display <-> PDF coordinates
      fonts.ts          font embedding, including reuse of the original
      drawText.ts       text positioned in display space
  components/           Toolbar, Workspace, PageView, ElementLayer, Modal
server/                 the account API
nginx/default.conf      the app container's nginx
```

### Adding a feature

A feature owns its types, its view, its tool behaviour and its export drawer in
one folder, and registers them:

```ts
registerFeature({
  name: 'shapes',
  elements: [shapeKind],   // render, draw, bounds, move, resize, rotatePage
  tools: [{ id: 'rect', label: 'Rectangle', behaviour, ... }],
})
```

Element types join the union by declaration merging, so nothing central needs
editing:

```ts
declare module '../../types' {
  interface ElementMap { shape: ShapeElement }
}
```

Cross-cutting export behaviour — form filling, rasterisation, decorations,
encryption — is installed with `registerExportPlugin`, which keeps
`buildPdf.ts` free of feature imports.

### The page model

Pages carry an id, a source (a page of a loaded PDF, or blank), and their own
rotation. Elements and text runs reference `pageId`, never an index, so
reordering, duplicating and merging are ordinary data changes.

Export picks one of two strategies:

- **In place** when every page comes from one file and nothing needs
  rasterising. The original document object is kept, so its AcroForm, outlines
  and metadata survive.
- **Rebuild** otherwise. `copyPages` does not bring the catalog across, so form
  values are drawn as content instead. A redacted page is never copied at all:
  a fresh page is created for the raster, which is what guarantees the original
  content is gone.

### Where to make common changes

| Symptom | Look at |
|---|---|
| Runs split or merged badly | `lib/textLayer.ts` (`projectLines`, `groupIntoBlocks`) |
| Replacement text looks wrong | `features/text-edit/draw.ts`, `lib/export/fonts.ts` |
| Wrong colour on a cover | `lib/textLayer.ts` (`sampleRectColors`) |
| Editing interaction | `features/text-edit/session.ts`, `views.tsx` |
| Something lands in the wrong place | `lib/export/transform.ts` |
| A new tool or element type | a new folder under `src/features/` |

## Accounts

The API is Fastify with SQLite. Sessions and email tokens are stored as hashes,
so a database leak is not a set of logins. Sign-up and password reset never
reveal whether an address is registered. Auth routes are rate limited per
client address, which is why both nginx hops forward the real one.

Account holders can delete their account from the account menu, confirming with
their password. That deletes the user row, and with it, through `ON DELETE
CASCADE`, every session, email token and download record. A confirmation is
then sent to the address that was removed. Backups of `/opt/pdf-editor/data`
keep a deleted account until they are rotated out.

The download gate is a product decision, not a security boundary: every byte of
the export is produced in the browser, so a determined visitor can always get
their file. It exists to tie downloads to an account, and it steps aside
entirely when the API is unreachable, so an outage there never blocks a
download.

## The funnel to Eight Mile

The tool is free because it introduces people to [Eight Mile](https://eightmile.co.uk),
which designs websites and builds SaaS products. Every link out of the editor
goes through `src/lib/eightmile.ts`, which points at `eightmile.co.uk/saas` and
tags the placement (`utm_campaign=header`, `empty-state`, `help`,
`post-download`, `account`, `brand`); emails use `utm_medium=email`. That
tagging is the only measurement: the editor carries no analytics script, and
attribution is read off the main site's analytics.

Touchpoints: the "by Eight Mile" link in the header, a line under the empty
state, an About section in the help dialog, a dismissible card after a download
(quiet for a fortnight once dismissed, per browser), a footer in every email, a
welcome email on first confirmation, and `Producer`/`Creator` metadata on every
exported PDF.

Signup has an unticked "news from Eight Mile" box. Consent, the time it was
given and the tab's signup source (`utm_*` tags and referring host, captured by
`src/lib/attribution.ts`) are stored on the user row; the account menu lets the
holder switch consent off, through `POST /api/auth/preferences`. To pull the
opted-in, confirmed addresses as CSV for the mailing tool:

```sh
cd server && DATABASE_PATH=./dev.db npm run leads:dev        # development
docker exec $(docker ps -qf name=pdf-editor_pdf-editor-api) npm run leads > leads.csv   # on the manager
```

### Pages for search

`index.html` and the other `*.html` files in the repo root are stubs. At build
time `src/seo/plugin.ts` fills each one from `src/seo/pages.ts`: the title,
description, social tags and structured data go in the head, and a crawlable
section of copy (heading, intro, steps, questions, links to the other pages) is
appended after the app root. The app hides that section as soon as a document
is open and, on a task page, selects the tool the page is about. Clean URLs
(`/redact-pdf`) are served by the plugin in development and by nginx's
`$uri.html` in production. The sitemap is generated from the same list, so a
new page is one entry in `pages.ts` plus a copy of a stub.

`public/robots.txt` and `public/og-image.png` complete the set. The backlink
from eightmile.co.uk to the tool, and the `/saas` page itself, live in that
site's repository. The domain also needs verifying in Google Search Console
with the sitemap submitted before any of this is indexed.

## Deploy

GitLab CI lints and tests both packages, builds the app, then on the manager:
copies `dist/` to `/opt/pdf-editor/dist` and the app nginx config to
`/opt/pdf-editor/nginx.conf`, builds the API image tagged with the commit,
deploys the `pdf-editor` swarm stack, and installs `pdf-editor.conf` into the
shared proxy.

Both services join the shared `monitoring-network` overlay and publish no host
ports; the proxy reaches them as `pdf-editor:80` and `pdf-editor-api:3000`.

The API's configuration comes from one protected CI/CD variable, `PROD_ENV`,
holding the whole environment file (start from `server/api.env.example`; the
required keys are listed at the end of `.gitlab-ci.yml`). The pipeline writes
it to `/opt/pdf-editor/api.env` on the manager, mode 600, where the compose
file mounts it. Change the variable and re-run the pipeline to redeploy: the
image is tagged with the pipeline id, so Swarm always restarts the service.

**Back up `/opt/pdf-editor/data`** — it is the accounts database.
