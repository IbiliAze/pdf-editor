import type { Point } from '../../types'

/** Trim fully transparent margins so the stamp has no dead space. */
export function trimTransparent(canvas: HTMLCanvasElement, pad = 6): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const { width, height } = canvas
  if (!width || !height) return canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return canvas

  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const w = Math.min(width, maxX + pad + 1) - x0
  const h = Math.min(height, maxY + pad + 1) - y0
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')?.drawImage(canvas, x0, y0, w, h, 0, 0, w, h)
  return out
}

/** Draw a smoothed stroke through the collected points. */
export function strokePath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  color: string,
): void {
  if (points.length < 2) {
    if (points.length === 1) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  // Quadratic segments through the midpoints turn a jittery pointer trail
  // into a smooth line.
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 }
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

/** Render typed text in a script face onto a transparent canvas. */
export async function renderTypedSignature(
  text: string,
  family: string,
  color: string,
): Promise<HTMLCanvasElement> {
  const size = 96
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  try {
    await document.fonts?.load(`${size}px ${family}`)
  } catch {
    // the fallback face still renders
  }
  ctx.font = `${size}px ${family}`
  const metrics = ctx.measureText(text || ' ')
  canvas.width = Math.max(32, Math.ceil(metrics.width) + 48)
  canvas.height = Math.ceil(size * 2)
  const c2 = canvas.getContext('2d')!
  c2.font = `${size}px ${family}`
  c2.fillStyle = color
  c2.textBaseline = 'middle'
  c2.fillText(text, 24, canvas.height / 2)
  return trimTransparent(canvas)
}

/**
 * Make a scanned signature usable over a page: drop pixels close to white and
 * keep the ink, so the stamp does not arrive in a white box.
 */
export function removeWhiteBackground(
  canvas: HTMLCanvasElement,
  threshold = 225,
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luma >= threshold) {
      data[i + 3] = 0
    } else if (luma > threshold - 60) {
      // Feather the edge so the ink does not look cut out.
      data[i + 3] = Math.round(data[i + 3] * (1 - (luma - (threshold - 60)) / 60))
    }
  }
  ctx.putImageData(image, 0, 0)
  return trimTransparent(canvas)
}
