import { useStore } from '../../store'
import { cssFontFor } from '../../lib/fonts'
import { parsePageRange } from '../../lib/pageModel'
import { fillTemplate, numberSlot } from './decorations'
import type { Page, TextBand } from '../../types'

/** Non-interactive preview of the document decorations on one page. */
export default function DecorationLayer({ page, index }: { page: Page; index: number }) {
  const decorations = useStore((s) => s.decorations)
  const zoom = useStore((s) => s.zoom)
  const total = useStore((s) => s.pages.length)
  const fileName = useStore((s) => s.fileName)

  const { watermark, pageNumbers, header, footer } = decorations
  if (!watermark && !pageNumbers && !header && !footer) return null

  const inRange = (expr: string | undefined) =>
    parsePageRange(expr ?? 'all', total).includes(index)

  return (
    <div className="decoration-layer">
      {watermark && inRange(watermark.pages) && (
        <div
          className="deco-watermark"
          style={{
            left: '50%',
            top: '50%',
            fontSize: watermark.size * zoom,
            color: watermark.color,
            opacity: watermark.opacity,
            transform: `translate(-50%, -50%) rotate(${watermark.angle}deg)`,
            ...cssFontFor(watermark.font),
          }}
        >
          {watermark.text}
        </div>
      )}

      {pageNumbers && inRange(pageNumbers.pages) && (
        <Band
          text={fillTemplate(pageNumbers.template, index, total, fileName, pageNumbers.startAt)}
          slot={numberSlot(
            pageNumbers.position,
            page.width,
            page.height,
            pageNumbers.margin,
            pageNumbers.size,
          )}
          size={pageNumbers.size}
          color={pageNumbers.color}
          font={pageNumbers.font}
          zoom={zoom}
        />
      )}

      {([[header, true], [footer, false]] as [TextBand | undefined, boolean][]).map(
        ([band, atTop]) =>
          band && inRange(band.pages)
            ? (['left', 'center', 'right'] as const).map((align) =>
                band[align]?.trim() ? (
                  <Band
                    key={`${atTop}-${align}`}
                    text={fillTemplate(band[align], index, total, fileName)}
                    slot={{
                      x: band.margin,
                      y: atTop ? band.margin : page.height - band.margin - band.size * 1.2,
                      width: page.width - band.margin * 2,
                      align,
                    }}
                    size={band.size}
                    color={band.color}
                    font={band.font}
                    zoom={zoom}
                  />
                ) : null,
              )
            : null,
      )}
    </div>
  )
}

function Band({
  text,
  slot,
  size,
  color,
  font,
  zoom,
}: {
  text: string
  slot: { x: number; y: number; width: number; align: 'left' | 'center' | 'right' }
  size: number
  color: string
  font: import('../../types').FontSpec
  zoom: number
}) {
  return (
    <div
      className="deco-band"
      style={{
        left: slot.x * zoom,
        top: slot.y * zoom,
        width: slot.width * zoom,
        fontSize: size * zoom,
        lineHeight: 1.2,
        textAlign: slot.align,
        color,
        ...cssFontFor(font),
      }}
    >
      {text}
    </div>
  )
}
