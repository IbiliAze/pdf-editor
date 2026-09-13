import { framePoint } from '../../lib/textLayer'
import { measureText } from '../../lib/fonts'
import type { Line, Rect, SearchMatch } from '../../types'

export type Match = SearchMatch

export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}_]/u.test(ch)

/** Find every occurrence of `query` in a page's runs. */
export function findInLines(
  lines: Line[],
  query: string,
  opts: FindOptions = {},
): Match[] {
  const needle = opts.caseSensitive ? query : query.toLowerCase()
  if (!needle) return []
  const out: Match[] = []

  for (const line of lines) {
    const haystack = opts.caseSensitive ? line.text : line.text.toLowerCase()
    let from = 0
    for (;;) {
      const at = haystack.indexOf(needle, from)
      if (at < 0) break
      from = at + Math.max(1, needle.length)
      const end = at + needle.length
      if (opts.wholeWord && (isWordChar(line.text[at - 1]) || isWordChar(line.text[end]))) {
        continue
      }
      out.push({
        pageId: line.pageId,
        lineId: line.id,
        start: at,
        end,
        rect: rectForRange(line, at, end),
        angle: line.angle,
        text: line.text.slice(at, end),
      })
    }
  }
  return out
}

/**
 * Box around a character range. Widths come from the on-screen font
 * approximation, scaled so the whole run still spans its measured width.
 */
export function rectForRange(line: Line, start: number, end: number): Rect {
  const total = measureText(line.text, line.fontHeight, line.font) || 1
  const scale = line.width / total
  const before = measureText(line.text.slice(0, start), line.fontHeight, line.font) * scale
  const inner = measureText(line.text.slice(start, end), line.fontHeight, line.font) * scale
  const u = line.x + before
  const v = line.top
  if (!line.angle) return { x: u, y: v, w: Math.max(2, inner), h: line.height }

  // Angled runs need the four corners projected before a box can be drawn.
  const pts = [
    framePoint(line, u, v),
    framePoint(line, u + inner, v),
    framePoint(line, u, v + line.height),
    framePoint(line, u + inner, v + line.height),
  ]
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(2, Math.max(...xs) - Math.min(...xs)),
    h: Math.max(2, Math.max(...ys) - Math.min(...ys)),
  }
}
