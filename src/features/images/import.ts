import { store } from '../../store'
import { sid } from '../../lib/ids'
import type { ImageAsset } from '../../store/types'

const MAX_EDGE = 2400
const JPEG_QUALITY = 0.9

/**
 * Normalise any image the browser can decode into PNG or JPEG bytes pdf-lib
 * will accept. Going through a canvas also applies EXIF orientation and
 * rules out the exotic PNG colour types pdf-lib cannot embed.
 */
export async function importImage(file: Blob): Promise<ImageAsset> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read that image.')
    ctx.drawImage(bitmap, 0, 0, width, height)

    // Photographs compress far better as JPEG, but anything with transparency
    // has to stay PNG or the background turns black.
    const mime: ImageAsset['mime'] = hasAlpha(ctx, width, height) ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, JPEG_QUALITY),
    )
    if (!blob) throw new Error('Could not read that image.')

    const asset: ImageAsset = {
      id: sid('img'),
      bytes: await blob.arrayBuffer(),
      mime,
      url: URL.createObjectURL(blob),
      width,
      height,
    }
    store.get().addAsset(asset)
    return asset
  } finally {
    bitmap.close?.()
  }
}

function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Sampling a grid is enough: a fully opaque image has no transparent pixel
  // anywhere, and a cut-out signature has many.
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64))
  const data = ctx.getImageData(0, 0, w, h).data
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 250) return true
    }
  }
  return false
}

/** Turn a data URL (a drawn or typed signature) into an asset. */
export async function importDataUrl(dataUrl: string): Promise<ImageAsset> {
  const res = await fetch(dataUrl)
  return importImage(await res.blob())
}
