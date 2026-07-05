# PDF Editor

Browser-based PDF editor. Everything runs locally — no file ever leaves the browser.

## Run

```sh
npm install
npm run dev
```

## Features

- **Edit text** (the core feature): click any text on the page, type the replacement, press Enter. Works on any PDF regardless of how its fonts are encoded — the original run is covered with a rectangle in the sampled background color and the replacement is drawn at the exact original baseline with a matched standard font (family/bold/italic detected from the PDF font name). Clear the box to erase a line entirely.
- **Add text**: click to place a new text box (font, size, bold/italic, color configurable; drag to move, handle to resize width).
- **Whiteout**: drag to cover content.
- **Highlight**: drag to highlight (multiply blend, matches export).
- **Pen**: freehand drawing.
- **Select**: move/restyle/delete anything you added (Del key), including reverting a text edit to the original.
- Undo/redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), zoom 50–300%, drag & drop to open.

## How text editing works

1. `pdf.js` renders each page and `getTextContent()` yields every text item with its exact transform.
2. Items are grouped into per-line editable runs (`src/lib/textLayer.js`); big gaps and font-size jumps split runs so table columns stay independent.
3. Clicking a run samples the rendered canvas for the background and text color, then opens an inline input styled with the matched font.
4. On export (`src/lib/exportPdf.js`), `pdf-lib` draws a cover rectangle in the sampled background color over the original run and draws the replacement text at the run's original PDF-space baseline (`Tm` origin), so placement is exact. Characters outside WinAnsi are mapped to lookalikes or dropped.

This deliberately avoids rewriting PDF content streams (the approach that fails on subsetted/CID fonts) — cover-and-replace works on every document.
