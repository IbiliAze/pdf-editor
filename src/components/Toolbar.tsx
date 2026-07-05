import { FAMILIES, TOOLS } from '../constants'
import { clamp } from '../lib/colors'
import type { FontFamily, TextStyle, ToolId } from '../types'

interface ToolbarProps {
  hasDoc: boolean
  tool: ToolId
  onSelectTool: (id: ToolId) => void
  /** style shown in the controls: the selected text element's, or the default */
  style: TextStyle
  onStyle: (patch: Partial<TextStyle>) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomStep: (dir: 1 | -1) => void
  docLabel: string | null
  onOpen: () => void
  onExport: () => void
}

export default function Toolbar({
  hasDoc,
  tool,
  onSelectTool,
  style,
  onStyle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomStep,
  docLabel,
  onOpen,
  onExport,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="brand">
        <img src="/logo-inverted-removebg-preview.png" alt="Eight Mile logo" />
        Eight Mile
      </div>

      <button className="btn" onClick={onOpen}>
        Open
      </button>

      <div className="divider" />

      <div className="group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`btn tool${tool === t.id ? ' active' : ''}`}
            disabled={!hasDoc}
            title={t.label}
            onClick={() => onSelectTool(t.id)}
          >
            <span className="tool-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="group">
        <select
          value={style.family}
          disabled={!hasDoc}
          onChange={(e) => onStyle({ family: e.target.value as FontFamily })}
        >
          {FAMILIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <input
          type="number"
          min={4}
          max={200}
          value={style.size}
          disabled={!hasDoc}
          onChange={(e) => onStyle({ size: clamp(Number(e.target.value) || 12, 4, 200) })}
        />
        <button
          className={`btn toggle${style.bold ? ' active' : ''}`}
          disabled={!hasDoc}
          onClick={() => onStyle({ bold: !style.bold })}
        >
          <b>B</b>
        </button>
        <button
          className={`btn toggle${style.italic ? ' active' : ''}`}
          disabled={!hasDoc}
          onClick={() => onStyle({ italic: !style.italic })}
        >
          <i>I</i>
        </button>
        <input
          type="color"
          value={style.color}
          disabled={!hasDoc}
          onChange={(e) => onStyle({ color: e.target.value })}
        />
      </div>

      <div className="divider" />

      <div className="group">
        <button className="btn" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button className="btn" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </div>

      <div className="group">
        <button className="btn" onClick={() => onZoomStep(-1)} disabled={!hasDoc}>
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="btn" onClick={() => onZoomStep(1)} disabled={!hasDoc}>
          +
        </button>
      </div>

      <div className="spacer" />

      {docLabel && <span className="doc-label">{docLabel}</span>}
      <button className="btn primary" onClick={onExport} disabled={!hasDoc}>
        Export PDF
      </button>
    </header>
  )
}
