<p align="center">
  <img src="public/eight-mile-pdf-logo.png" alt="Eight Mile PDF logo" width="112" />
</p>

# Eight Mile PDF

Browser-based PDF editor. Everything runs locally — no file ever leaves the browser.

## Run

```sh
npm install
npm run dev
```

## Deploy

The GitLab pipeline builds the Vite app, copies `dist/` to
`/opt/pdf-editor/dist` on the manager, deploys the `pdf-editor` swarm stack, and
installs `pdf-editor.conf` into the shared nginx proxy.

- **URL:** https://pdf-editor.eightmile.co.uk
- **Network:** joins the shared `monitoring-network` overlay so the proxy can
  reach it by name (`pdf-editor:80`).

## Features

- **Edit text** (the core feature): click any text on the page, type the replacement, press Enter. Works on any PDF regardless of how its fonts are encoded — the original run is covered with a rectangle in the sampled background color and the replacement is drawn at the exact original baseline with a matched standard font (family/bold/italic detected from the PDF font name). Clear the box to erase a line entirely. Edited lines can be restyled (family, size, bold/italic, color) via the toolbar, live while editing or with the committed edit selected.
- **Fonts**: 9 families — Helvetica/Times/Courier (built-in standard fonts) plus Roboto, Open Sans, Lato, Montserrat, Merriweather, and Playfair Display (TTFs in `public/fonts/`, subset-embedded into the PDF at export via `@pdf-lib/fontkit`).
- **Add text**: click to place a new text box (font, size, bold/italic, color configurable; drag to move, handle to resize width).
- **Whiteout**: drag to cover content.
- **Highlight**: drag to highlight (multiply blend, matches export).
- **Pen**: freehand drawing.
- **Select**: move/restyle/delete anything you added (Del key), including reverting a text edit to the original.
- Undo/redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), zoom 50–300%, drag & drop to open.

## Project structure

TypeScript throughout. Types are the map: start at `src/types.ts`.

```
src/
  main.tsx               entry point
  App.tsx                state orchestration: tools, zoom, selection, edit
                         sessions, drag/draw handlers, keyboard, export wiring
  types.ts               ALL shared types: elements union (EditElement,
                         TextElement, Whiteout/Highlight/Path), Line, PageInfo,
                         EditingSession, ToolId, PageHandlers
  constants.ts           TOOLS list (labels/hints), font families, zoom levels
  styles.css             all styling
  hooks/
    useElements.ts       elements list + undo/redo history (state + refs)
    usePdfDocument.ts    open/load PDF, page + text-line extraction, byte refs
  lib/
    pdfjs.ts             pdf.js worker setup + type re-exports
    textLayer.ts         text extraction: grouping items into editable line
                         runs; canvas color sampling (bg + text color)
    exportPdf.ts         writes the edited PDF (cover rects + replacement
                         text at original baselines); WinAnsi sanitizing
    fonts.ts             PDF font name → standard-14 font match; css
                         approximation; text measuring
    colors.ts            hex/rgb conversion, clamps
    utils.ts             element ids, download, rect normalization
  components/
    Toolbar.tsx          top bar: tools, text style controls, undo/zoom/export
    PageView.tsx         one page: canvas render + overlay, line hit targets
    ElementView.tsx      renders one committed element (all five types)
    LineEditor.tsx       inline input over a native text line
```

Where to make common changes:

- Text extraction wrong (lines split/merged badly) → `lib/textLayer.ts` (`groupIntoLines`)
- Replacement text looks wrong in the exported file → `lib/exportPdf.ts` (edit branch) or `lib/fonts.ts` (font matching)
- Wrong colors on covers → `lib/textLayer.ts` (`sampleLineColors`)
- Editing interaction (click/commit/cancel) → `App.tsx` (`startLineEdit`/`commitLineEdit`) and `components/LineEditor.tsx`
- New tool or element type → add to `types.ts` + `constants.ts`, render in `ElementView.tsx`, handle in `App.tsx`, export in `lib/exportPdf.ts`

## How text editing works

1. `pdf.js` renders each page and `getTextContent()` yields every text item with its exact transform.
2. Items are grouped into per-line editable runs (`src/lib/textLayer.js`); big gaps and font-size jumps split runs so table columns stay independent.
3. Clicking a run samples the rendered canvas for the background and text color, then opens an inline input styled with the matched font.
4. On export (`src/lib/exportPdf.js`), `pdf-lib` draws a cover rectangle in the sampled background color over the original run and draws the replacement text at the run's original PDF-space baseline (`Tm` origin), so placement is exact. Characters outside WinAnsi are mapped to lookalikes or dropped.

This deliberately avoids rewriting PDF content streams (the approach that fails on subsetted/CID fonts) — cover-and-replace works on every document.
