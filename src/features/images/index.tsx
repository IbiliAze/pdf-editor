import { registerFeature } from '../registry'
import { registerExportPlugin } from '../../lib/export/buildPdf'
import { store } from '../../store'
import { nid } from '../../lib/ids'
import { importImage } from './import'
import type { ElementKind, RenderCtx, ToolBehaviour } from '../../types'
import type { ImageElement } from './types'

function ImageView({ el, ctx }: { el: ImageElement; ctx: RenderCtx }) {
  const asset = store.get().assets[el.assetId]
  return (
    <div
      className={`el-image${ctx.selected ? ' selected' : ''}`}
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: el.w * ctx.zoom,
        height: el.h * ctx.zoom,
        opacity: el.opacity ?? 1,
      }}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    >
      {asset && <img src={asset.url} alt="" draggable={false} />}
    </div>
  )
}

const imageKind: ElementKind<ImageElement> = {
  type: 'image',
  layer: 22,
  render: (el, ctx) => <ImageView el={el} ctx={ctx} />,
  draw: async (el, ctx) => {
    const img = await ctx.embedImage(el.assetId)
    if (!img) return
    ctx.page.drawImage(img, {
      ...ctx.rectToPdf(el.x, el.y, el.w, el.h),
      opacity: el.opacity ?? 1,
    })
  },
  bounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  resize: (el, r) => ({ ...el, ...r }),
  rotatePage: (el, t) => {
    const a = t({ x: el.x, y: el.y })
    const b = t({ x: el.x + el.w, y: el.y + el.h })
    return {
      ...el,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    }
  },
}

/** Place an image at a point, sized to a sensible default width. */
export function placeImage(
  assetId: string,
  pageId: string,
  at: { x: number; y: number },
  kind: 'image' | 'signature' = 'image',
  targetWidth = kind === 'signature' ? 160 : 240,
): void {
  const asset = store.get().assets[assetId]
  if (!asset) return
  const w = Math.min(targetWidth, asset.width)
  const h = (w * asset.height) / Math.max(1, asset.width)
  const el: ImageElement = {
    id: nid(),
    type: 'image',
    pageId,
    x: at.x,
    y: at.y,
    w,
    h,
    assetId,
    kind,
  }
  store.get().addElement(el)
}

const imageTool: ToolBehaviour = {
  cursor: 'copy',
  pointerDown: ({ page, point, event }) => {
    event.preventDefault()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/bmp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const asset = await importImage(file)
        placeImage(asset.id, page.id, point)
      } catch (err) {
        store.get().setStatus({
          type: 'error',
          msg: `Could not add that image: ${(err as Error)?.message ?? err}`,
        })
      }
    }
    input.click()
  },
}

registerExportPlugin({
  embedImage: async (doc, assetId) => {
    const asset = store.get().assets[assetId]
    if (!asset) return null
    try {
      return asset.mime === 'image/png'
        ? await doc.embedPng(asset.bytes)
        : await doc.embedJpg(asset.bytes)
    } catch {
      return null
    }
  },
})

registerFeature({
  name: 'images',
  elements: [imageKind],
  tools: [
    {
      id: 'image',
      label: 'Image',
      icon: '🖼',
      group: 'insert',
      order: 21,
      behaviour: imageTool,
      hint: 'Click where the image should go, then choose a PNG or JPEG. Drag its handles to resize.',
    },
  ],
})

export * from './types'
export { importImage, importDataUrl } from './import'
