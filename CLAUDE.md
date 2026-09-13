# Eight Mile PDF

A PDF editor that runs entirely in the browser (React, pdf.js, pdf-lib), plus a
small account API in `server/` (Fastify, SQLite) that gates downloads. The
README covers features, architecture and deploy. This file is what to keep in
mind while changing the code.

## The rule that outranks everything

**A document never leaves the browser.** No bytes, text, form values or images
of a PDF may be sent anywhere. The server only receives account details and
download metadata (file name, page count, byte size) through
`api.recordDownload`. Any change that adds a network call carrying document
content is a bug, whatever the reason.

## Commands

```sh
npm run dev                                    # editor on :5173, proxies /api to :3000
npm run lint && npm test && npm run build      # all must pass
npx vitest run src/lib/__tests__/textLayer.test.ts

cd server
DATABASE_PATH=./dev.db SECURE_COOKIES=false MAIL_TRANSPORT=json npm run dev   # API on :3000
npm run typecheck && npm test                  # all must pass
```

- `DATABASE_PATH` defaults to `/data/app.db`, the production volume. It does not
  exist on a development machine, so the API will not start without the
  override.
- With `MAIL_TRANSPORT=json` the confirmation and reset links are printed to the
  API's console instead of sent.
- `APP_ORIGIN` must be the exact origin the editor is served from (default
  `http://localhost:5173`), or the API refuses every write with 403.
- The API listens on `PORT` (default 3000). Point the editor's `/api` proxy
  somewhere else with `API_PROXY_TARGET`.

## Where things are

Start at `src/types.ts`: the page model, the element union and the export
contracts.

- `src/features/<name>/`: one folder per feature holding its types, views,
  tools and export drawer, installed with `registerFeature`
  (`src/features/registry.ts`). Cross-cutting export steps such as forms,
  rasterising, decorations and encryption use `registerExportPlugin`
  (`src/lib/export/buildPdf.ts`).
- `src/store/`: zustand slices. `src/lib/`: pure logic (text extraction, page
  model, geometry, export).
- `server/src/routes/auth.ts`: signup, login, logout, me, preferences, verify,
  resend-verification, forgot-password, reset-password, delete-account.
  `server/src/routes/downloads.ts`: record and list downloads.
  `server/src/scripts/export-leads.ts`: opted-in addresses as CSV (`npm run leads`).
- `src/lib/eightmile.ts`: every link to eightmile.co.uk, tagged per placement.
  Outbound links open in a new tab so the open document is never lost.

## Conventions

- A new element type joins `ElementMap` by declaration merging inside its own
  feature folder. Never import a feature into `buildPdf.ts`, `ElementLayer` or
  any other central file. Register it instead.
- Elements and text runs reference `pageId`, never a page index, so reordering,
  duplicating and merging stay plain data changes.
- Wrap any zustand selector that builds an object or array in `useShallow`, or
  the component re-renders forever.
- Tests run in node. A component test opts into jsdom with a
  `// @vitest-environment jsdom` docblock, is named `*.dom.test.tsx`, and calls
  `afterEach(cleanup)`.
- Server routes validate bodies with zod, reply with `{ error, message }`, set a
  per-route rate limit, and never reveal whether an email address is registered.
  Session ids and email tokens are stored as sha256 hashes. Migrations in
  `server/src/migrations.ts` are append-only.
- Comments explain why, not what. UI copy is plain, second person, British
  spelling.

## Traps that have already cost time

- **Text editing never rewrites content streams.** It covers the old run with a
  rectangle in the sampled background colour and draws the replacement at the
  run's original baseline and angle (`src/features/text-edit/draw.ts`). The
  covered text is still in the file. Only redaction removes content.
- **pdf-lib writes every object it has loaded**, referenced or not. A redacted
  page must be a fresh page holding a raster in a rebuilt document. Copying the
  original page would leak what was redacted.
- **`copyPages` drops the AcroForm, outlines and metadata.** That is why
  `chooseStrategy` keeps single-source, unredacted exports in place.
- **pdf.js only puts fonts in `page.commonObjs` after `getOperatorList()`**, and
  only keeps their bytes with `fontExtraProperties: true`. Skip either and real
  font names and embedded-font reuse silently disappear.
- `@pdf-lib/fontkit` has only a default export: `import fontkit from '@pdf-lib/fontkit'`.
- `fontUsable` must check every character, spaces included. Subset fonts often
  lack a space glyph and draw `.notdef` boxes.
- pdf.js reports `maxLen: 0` for a text field with no limit. Passed on as
  `maxlength`, it makes the field reject every keystroke.
- pdf.js reports radio widget on-states while pdf-lib selects by `/Opt` label.
  `selectRadio` maps between them by widget order.
- `form.flatten()` leaves xref gaps that poppler rejects. `fillObjectGaps` fills
  them.
- `@cantoo/pdf-lib` (encrypting, opening protected files) is only ever loaded
  with a dynamic `import()`. Everything else uses `pdf-lib`.

## Verifying changes

Unit tests cannot show that an edit lands in the right place in the output. For
anything touching rendering, text editing, fonts, page operations, forms,
redaction or export, use the **verify-pdf** skill (`.claude/skills/verify-pdf/`).
It generates fixture PDFs, runs the real app in Chrome, and inspects the
downloaded file with poppler.

Downloads need a confirmed account. Seed one with the skill's
`seed-account.mjs` instead of signing in over and over: login is limited to 10
attempts per 15 minutes per client address, and a run of 429s looks exactly like
a broken app.

## Deploy

GitLab CI (`.gitlab-ci.yml`) lints, tests, builds and deploys the swarm stack.
Don't run deploy steps from a development machine. The API's environment is
the protected `PROD_ENV` CI/CD variable (the whole env file; keys listed at the
end of `.gitlab-ci.yml`), which the pipeline writes to
`/opt/pdf-editor/api.env` on the manager. `/opt/pdf-editor/data` is the
accounts database.
