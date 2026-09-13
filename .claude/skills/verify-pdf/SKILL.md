---
name: verify-pdf
description: End-to-end check of Eight Mile PDF in real Chrome. Use after changing text editing, rendering, fonts, page operations, images, forms, redaction, decorations or the export pipeline, or whenever unit tests can't show the downloaded PDF is right. Generates fixture PDFs, runs the editor and API, seeds a confirmed account, drives the editor with Playwright, and inspects the output with poppler.
---

# Verify a change end to end

Unit tests prove the maths. This proves the file: a real browser edits a real
PDF, the download passes through the account gate, and the result is read back
by poppler, a PDF implementation that did not write it.

Work in the session scratchpad (`$SCRATCH` below), never in the repo. Nothing
this produces is committed. Run the commands from the repo root unless a step
says otherwise.

## 1. Tools

- Google Chrome at `/Applications/Google Chrome.app`, or set `CHROME` to another
  Chromium binary.
- poppler: `pdfinfo`, `pdftotext`, `pdftoppm`, `pdffonts` (`brew install poppler`).
- Playwright, installed once in the scratchpad. It drives the system Chrome, so
  no browser download is needed:

  ```sh
  (cd $SCRATCH && npm init -y >/dev/null && npm i playwright)
  ```

## 2. Fixtures

```sh
node .claude/skills/verify-pdf/scripts/fixtures.mjs $SCRATCH
```

| File | What it exercises |
|---|---|
| `sample.pdf` | Three pages, the last landscape. Heading, four-line paragraph, table, a run rotated 90°, and a 9pt footnote on a tinted box |
| `embedded.pdf` | Non-standard TrueType faces embedded without subsetting, for font reuse and partial edits |
| `form.pdf` | Text, multiline, checkbox, radio group and dropdown fields, plus words to find and redact |
| `logo.png` | 200×200 with a transparent background, for placing images |

## 3. Run the API and the editor

Start both in the background against a throwaway database. First check the
ports are free with `lsof -i :3000 -i :5199`: another project's dev server is
often sitting on 3000. Never stop a process you did not start. Pick other ports
instead. `APP_ORIGIN` must match the editor's URL exactly, or the API refuses
writes with 403, and `API_PROXY_TARGET` points the editor's `/api` proxy at the
API.

```sh
API_PORT=3000 APP_PORT=5199
(cd server && PORT=$API_PORT DATABASE_PATH=$SCRATCH/verify.db \
  APP_ORIGIN=http://localhost:$APP_PORT SECURE_COOKIES=false MAIL_TRANSPORT=json \
  npx tsx src/index.ts > $SCRATCH/api.log 2>&1) &
API_PROXY_TARGET=http://localhost:$API_PORT \
  npx vite --port $APP_PORT --strictPort > $SCRATCH/vite.log 2>&1 &
```

Carry on once `curl -s localhost:$API_PORT/api/health` returns `{"ok":true}`
and `curl -s localhost:$APP_PORT` returns HTML. If either never does, read its
log.

## 4. A confirmed account

```sh
node .claude/skills/verify-pdf/scripts/seed-account.mjs $SCRATCH/verify.db > $SCRATCH/session.json
```

This writes a confirmed user and a live session straight into the database and
prints the session cookie, the email and the password. The API must have
started once against that file so the schema exists. Signing in through the UI
instead spends the login rate limit of 10 per 15 minutes, and a run of 429s
looks exactly like a broken app.

## 5. Drive the editor

`scripts/drive-example.mjs` opens a PDF, rewrites its first line and downloads
the result through the export dialog. Copy it into the scratchpad, extend it for
the change under test, and run it from there so it finds Playwright:

```sh
cp .claude/skills/verify-pdf/scripts/drive-example.mjs $SCRATCH/drive.mjs
(cd $SCRATCH && APP=http://localhost:$APP_PORT PDF=sample.pdf OUT=out.pdf node drive.mjs)
```

It exits non-zero on any page or console error and saves screenshots beside the
output. Open them and look.

Worth knowing when extending it:

- Open a file with `setInputFiles('input[type=file]', ...)`. A page has rendered
  once `.page-wrap canvas` exists. Text is editable once `.line-hit` elements
  exist, which takes a moment longer.
- Tool buttons are titled with their label, as in `getByTitle('Edit paragraph')`.
  Paragraph targets are `.line-hit.block-hit`, and the open line editor is
  `.line-editor`.
- **Download PDF** only opens the export dialog. The file comes from the
  dialog's **Download** button, so start `page.waitForEvent('download')` before
  clicking it.
- On macOS, select all is `Meta+A`, not `Control+A`, and `End` does not collapse
  a selection.
- Some labels appear on more than one button (`Open`, for one). Use
  `exact: true` or scope the locator to a container.

## 6. Read the output back

```sh
pdfinfo out.pdf                       # page count and size; complains about a broken xref
pdftotext -layout out.pdf - | head -40
pdffonts out.pdf
pdftoppm -r 72 -png out.pdf page      # then look at page-1.png
```

| Change | Evidence it worked |
|---|---|
| Text edit | The render shows the new text on the original baseline at the same size, with no trace of the old text. `pdftotext` finds the new text. It also still finds the old text, which is expected: covering is not removing. In `-layout` mode the two can come out interleaved on one line |
| Font reuse | For output from `embedded.pdf`, `pdffonts` lists the document's own font for the replacement text |
| Rotation | Edit the rotated run, and a run on a rotated page. The render shows each replacement at its run's angle |
| Pages | `pdfinfo -f 1 -l 99 out.pdf` lists every page's size and rotation, in the new order |
| Forms | Values appear in the render. Reloaded with pdf-lib, `getForm().getFields()` holds them. A flattened file has no fields and still reads cleanly |
| Redaction | `pdftotext` output has no match for the redacted words, and that page renders as a single image |
| Password | `pdftotext out.pdf -` refuses to open it, and `pdftotext -upw <password> out.pdf -` succeeds |
| Notes and links | Reloaded with pdf-lib, the page's `/Annots` contain `/Text` and `/Link` subtypes |

Treat any `Syntax Error` or `Invalid XRef` line from a poppler tool as a failure,
even when it exits 0.

## 7. Clean up

Stop the servers you started with `lsof -t -i :$API_PORT -i :$APP_PORT -sTCP:LISTEN | xargs kill`.
Delete `$SCRATCH/verify.db` when you want a fresh account next time.
