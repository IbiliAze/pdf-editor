import { useStore, useShallow } from '../store'
import { useCanRedo, useCanUndo, useHasDoc } from '../store/selectors'
import { allTools } from '../features/registry'
import { FAMILIES, familyLabel } from '../lib/fonts'
import { clamp } from '../lib/colors'
import { EIGHTMILE_HOME, eightmileUrl, outbound } from '../lib/eightmile'
import { applyStyle, shownStyleFrom } from '../actions/style'
import { commitSession } from '../features/text-edit/session'
import type { FontFamily, ToolDef } from '../types'

interface Props {
  onOpen: () => void
  onExport: () => void
  onHelp: () => void
  right?: React.ReactNode
}

const GROUP_ORDER: ToolDef['group'][] = ['text', 'insert', 'annotate', 'page']

export default function Toolbar({ onOpen, onExport, onHelp, right }: Props) {
  const hasDoc = useHasDoc()
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const zoom = useStore((s) => s.zoom)
  const zoomStep = useStore((s) => s.zoomStep)
  const setFitMode = useStore((s) => s.setFitMode)
  const fitMode = useStore((s) => s.fitMode)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  // Shallow compare: the derived object is rebuilt on every store change.
  const style = useStore(useShallow(shownStyleFrom))

  const tools = allTools().filter((t) => !t.hidden)
  const groups = new Map<ToolDef['group'], ToolDef[]>()
  for (const t of tools) {
    const list = groups.get(t.group)
    if (list) list.push(t)
    else groups.set(t.group, [t])
  }

  const selectTool = (id: string) => {
    commitSession()
    setTool(id)
  }

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <a className="brand" href={eightmileUrl('brand', EIGHTMILE_HOME)} {...outbound}>
          <span className="brand-mark">
            <img src="/eight-mile-pdf-logo.png" alt="" />
          </span>
          <span className="brand-name">
            Eight Mile <span>PDF</span>
          </span>
        </a>
        <a className="brand-by" href={eightmileUrl('header')} {...outbound}>
          by Eight Mile · websites &amp; web apps
        </a>

        <button className="btn" onClick={onOpen}>
          Open
        </button>
        <button
          className={`btn${sidebarOpen ? ' active' : ''}`}
          disabled={!hasDoc}
          title="Page thumbnails"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          Pages
        </button>

        <div className="divider" />

        {GROUP_ORDER.map((group) =>
          groups.get(group)?.length ? (
            <div className="group" key={group}>
              {groups.get(group)!.map((t) => (
                <button
                  key={t.id}
                  className={`btn tool${tool === t.id ? ' active' : ''}`}
                  disabled={!hasDoc}
                  title={t.label}
                  onClick={() => selectTool(t.id)}
                >
                  <span className="tool-icon">{t.icon}</span>
                  <span className="tool-label">{t.label}</span>
                </button>
              ))}
            </div>
          ) : null,
        )}

      </div>

      <div className="toolbar-row secondary">
        <div className="group">
          <select
            value={style.family}
            disabled={!hasDoc}
            title="Font"
            onChange={(e) => applyStyle({ family: e.target.value as FontFamily })}
          >
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {familyLabel(f)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={4}
            max={400}
            title="Font size"
            value={style.size}
            disabled={!hasDoc}
            onChange={(e) => applyStyle({ size: clamp(Number(e.target.value) || 12, 4, 400) })}
          />
          <button
            className={`btn toggle${style.bold ? ' active' : ''}`}
            disabled={!hasDoc}
            title="Bold"
            // preventDefault keeps focus (and the open inline editor) intact
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyStyle({ bold: !style.bold })}
          >
            <b>B</b>
          </button>
          <button
            className={`btn toggle${style.italic ? ' active' : ''}`}
            disabled={!hasDoc}
            title="Italic"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyStyle({ italic: !style.italic })}
          >
            <i>I</i>
          </button>
          <input
            type="color"
            title="Colour"
            value={style.color}
            disabled={!hasDoc}
            onChange={(e) => applyStyle({ color: e.target.value })}
          />
        </div>

        <div className="divider" />

        <div className="group">
          <button className="btn" onClick={() => undo()} disabled={!canUndo} title="Undo">
            Undo
          </button>
          <button className="btn" onClick={() => redo()} disabled={!canRedo} title="Redo">
            Redo
          </button>
        </div>

        <div className="group">
          <button className="btn" onClick={() => zoomStep(-1)} disabled={!hasDoc} title="Zoom out">
            −
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => zoomStep(1)} disabled={!hasDoc} title="Zoom in">
            +
          </button>
          <button
            className={`btn${fitMode === 'width' ? ' active' : ''}`}
            disabled={!hasDoc}
            title="Fit the page to the window"
            onClick={() => setFitMode(fitMode === 'width' ? 'none' : 'width')}
          >
            Fit
          </button>
        </div>

        <div className="divider" />

        <div className="group">
          <button
            className={`btn${panel === 'search' ? ' active' : ''}`}
            disabled={!hasDoc}
            title="Find text (Cmd/Ctrl+F)"
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
          >
            Find
          </button>
          <button
            className={`btn${panel === 'document' ? ' active' : ''}`}
            disabled={!hasDoc}
            title="Watermark, page numbers, header and footer"
            onClick={() => setPanel(panel === 'document' ? null : 'document')}
          >
            Document
          </button>
        </div>

        <button className="btn" onClick={onHelp} title="Keyboard shortcuts and tips">
          Help
        </button>

        <div className="spacer" />

        {right}
        <button className="btn primary" onClick={onExport} disabled={!hasDoc}>
          Download PDF
        </button>
      </div>
    </header>
  )
}
