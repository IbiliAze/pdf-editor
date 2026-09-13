import { normRect } from '../../lib/geometry'
import type { RenderCtx } from '../../types'
import type { ShapeElement } from './types'

/** Shapes draw as inline SVG so strokes and fills match the export. */
export function ShapeView({ el, ctx }: { el: ShapeElement; ctx: RenderCtx }) {
  const z = ctx.zoom
  const pad = Math.max(2, el.strokeWidth * 3)
  const box = normRect({ x: el.x, y: el.y, w: el.w, h: el.h })
  const left = box.x - pad
  const top = box.y - pad
  const width = box.w + pad * 2
  const height = box.h + pad * 2
  const ox = (el.x - left) * z
  const oy = (el.y - top) * z

  const common = {
    stroke: el.color,
    strokeWidth: Math.max(0.5, el.strokeWidth * z),
    fill: el.fill ?? 'none',
    opacity: el.opacity,
    strokeLinecap: 'round' as const,
  }

  return (
    <svg
      className={`el-shape${ctx.selected ? ' selected' : ''}`}
      style={{ left: left * z, top: top * z, width: width * z, height: height * z }}
      width={width * z}
      height={height * z}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    >
      {el.shape === 'rect' && (
        <rect
          x={(box.x - left) * z}
          y={(box.y - top) * z}
          width={box.w * z}
          height={box.h * z}
          {...common}
        />
      )}
      {el.shape === 'ellipse' && (
        <ellipse
          cx={(box.x - left + box.w / 2) * z}
          cy={(box.y - top + box.h / 2) * z}
          rx={(box.w / 2) * z}
          ry={(box.h / 2) * z}
          {...common}
        />
      )}
      {(el.shape === 'line' || el.shape === 'arrow') && (
        <>
          <line x1={ox} y1={oy} x2={ox + el.w * z} y2={oy + el.h * z} {...common} fill="none" />
          {el.shape === 'arrow' && <ArrowHead el={el} zoom={z} ox={ox} oy={oy} />}
        </>
      )}
    </svg>
  )
}

function ArrowHead({
  el,
  zoom,
  ox,
  oy,
}: {
  el: ShapeElement
  zoom: number
  ox: number
  oy: number
}) {
  const dx = el.w * zoom
  const dy = el.h * zoom
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const ux = dx / len
  const uy = dy / len
  const size = Math.max(4, el.strokeWidth * 3.2) * zoom
  const tipX = ox + dx
  const tipY = oy + dy
  const wing = (sign: number) => ({
    x: tipX - ux * size - sign * uy * size * 0.55,
    y: tipY - uy * size + sign * ux * size * 0.55,
  })
  const a = wing(1)
  const b = wing(-1)
  return (
    <>
      <line
        x1={tipX}
        y1={tipY}
        x2={a.x}
        y2={a.y}
        stroke={el.color}
        strokeWidth={Math.max(0.5, el.strokeWidth * zoom)}
        strokeLinecap="round"
        opacity={el.opacity}
      />
      <line
        x1={tipX}
        y1={tipY}
        x2={b.x}
        y2={b.y}
        stroke={el.color}
        strokeWidth={Math.max(0.5, el.strokeWidth * zoom)}
        strokeLinecap="round"
        opacity={el.opacity}
      />
    </>
  )
}
