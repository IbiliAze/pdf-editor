import { useStore } from '../../store'
import { FAMILIES, familyLabel } from '../../lib/fonts'
import { defaultFont } from './decorations'
import type { FontFamily, NumberPosition } from '../../types'

const POSITIONS: [NumberPosition, string][] = [
  ['tl', 'Top left'],
  ['tc', 'Top centre'],
  ['tr', 'Top right'],
  ['bl', 'Bottom left'],
  ['bc', 'Bottom centre'],
  ['br', 'Bottom right'],
]

/** Watermark, page numbers, header and footer, previewed live on every page. */
export default function DecorationsPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const decorations = useStore((s) => s.decorations)
  const setDecorations = useStore((s) => s.setDecorations)
  const showFormFields = useStore((s) => s.showFormFields)
  const setShowFormFields = useStore((s) => s.setShowFormFields)

  if (panel !== 'document') return null
  const { watermark, pageNumbers, header, footer } = decorations

  return (
    <aside className="panel">
      <header className="sidebar-head">
        <strong>Document</strong>
        <button className="modal-close" onClick={() => setPanel(null)} aria-label="Close">
          ×
        </button>
      </header>
      <div className="panel-body">
        <section className="panel-section">
          <label className="checkline">
            <input
              type="checkbox"
              checked={showFormFields}
              onChange={(e) => setShowFormFields(e.target.checked)}
            />
            <strong>Show form fields</strong>
          </label>
          <span className="hint">
            Fillable fields are outlined on the page while this is on.
          </span>
        </section>

        <section className="panel-section">
          <label className="checkline">
            <input
              type="checkbox"
              checked={!!watermark}
              onChange={(e) =>
                setDecorations({
                  watermark: e.target.checked
                    ? {
                        text: 'DRAFT',
                        font: { ...defaultFont, bold: true },
                        size: 72,
                        color: '#9ca3af',
                        opacity: 0.25,
                        angle: 45,
                        pages: 'all',
                      }
                    : undefined,
                })
              }
            />
            <strong>Watermark</strong>
          </label>
          {watermark && (
            <div className="panel-fields">
              <input
                value={watermark.text}
                onChange={(e) => setDecorations({ watermark: { ...watermark, text: e.target.value } })}
              />
              <div className="panel-row">
                <label className="mini">
                  Size
                  <input
                    type="number"
                    min={8}
                    max={300}
                    value={watermark.size}
                    onChange={(e) =>
                      setDecorations({ watermark: { ...watermark, size: Number(e.target.value) || 72 } })
                    }
                  />
                </label>
                <label className="mini">
                  Angle
                  <input
                    type="number"
                    min={-90}
                    max={90}
                    value={watermark.angle}
                    onChange={(e) =>
                      setDecorations({ watermark: { ...watermark, angle: Number(e.target.value) || 0 } })
                    }
                  />
                </label>
                <label className="mini">
                  Colour
                  <input
                    type="color"
                    value={watermark.color}
                    onChange={(e) =>
                      setDecorations({ watermark: { ...watermark, color: e.target.value } })
                    }
                  />
                </label>
              </div>
              <label className="rangeline">
                Opacity
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(watermark.opacity * 100)}
                  onChange={(e) =>
                    setDecorations({ watermark: { ...watermark, opacity: Number(e.target.value) / 100 } })
                  }
                />
              </label>
              <label className="mini">
                Pages
                <input
                  value={watermark.pages}
                  onChange={(e) =>
                    setDecorations({ watermark: { ...watermark, pages: e.target.value } })
                  }
                />
              </label>
            </div>
          )}
        </section>

        <section className="panel-section">
          <label className="checkline">
            <input
              type="checkbox"
              checked={!!pageNumbers}
              onChange={(e) =>
                setDecorations({
                  pageNumbers: e.target.checked
                    ? {
                        template: 'Page {n} of {N}',
                        position: 'bc',
                        font: defaultFont,
                        size: 9,
                        color: '#6b7280',
                        margin: 28,
                        startAt: 1,
                        pages: 'all',
                      }
                    : undefined,
                })
              }
            />
            <strong>Page numbers</strong>
          </label>
          {pageNumbers && (
            <div className="panel-fields">
              <input
                value={pageNumbers.template}
                onChange={(e) =>
                  setDecorations({ pageNumbers: { ...pageNumbers, template: e.target.value } })
                }
              />
              <span className="hint">{'{n} is the page, {N} the last one.'}</span>
              <select
                value={pageNumbers.position}
                onChange={(e) =>
                  setDecorations({
                    pageNumbers: { ...pageNumbers, position: e.target.value as NumberPosition },
                  })
                }
              >
                {POSITIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="panel-row">
                <label className="mini">
                  Size
                  <input
                    type="number"
                    min={5}
                    max={48}
                    value={pageNumbers.size}
                    onChange={(e) =>
                      setDecorations({
                        pageNumbers: { ...pageNumbers, size: Number(e.target.value) || 9 },
                      })
                    }
                  />
                </label>
                <label className="mini">
                  Starts at
                  <input
                    type="number"
                    min={1}
                    value={pageNumbers.startAt}
                    onChange={(e) =>
                      setDecorations({
                        pageNumbers: { ...pageNumbers, startAt: Number(e.target.value) || 1 },
                      })
                    }
                  />
                </label>
                <label className="mini">
                  Colour
                  <input
                    type="color"
                    value={pageNumbers.color}
                    onChange={(e) =>
                      setDecorations({ pageNumbers: { ...pageNumbers, color: e.target.value } })
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        {(['header', 'footer'] as const).map((which) => {
          const band = which === 'header' ? header : footer
          return (
            <section className="panel-section" key={which}>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={!!band}
                  onChange={(e) =>
                    setDecorations({
                      [which]: e.target.checked
                        ? {
                            left: '',
                            center: which === 'header' ? '{filename}' : '',
                            right: '',
                            font: defaultFont,
                            size: 9,
                            color: '#6b7280',
                            margin: 28,
                            pages: 'all',
                          }
                        : undefined,
                    })
                  }
                />
                <strong>{which === 'header' ? 'Header' : 'Footer'}</strong>
              </label>
              {band && (
                <div className="panel-fields">
                  {(['left', 'center', 'right'] as const).map((slot) => (
                    <input
                      key={slot}
                      placeholder={slot}
                      value={band[slot]}
                      onChange={(e) =>
                        setDecorations({ [which]: { ...band, [slot]: e.target.value } })
                      }
                    />
                  ))}
                  <div className="panel-row">
                    <label className="mini grow">
                      Font
                      <select
                        value={band.font.family}
                      onChange={(e) =>
                        setDecorations({
                          [which]: { ...band, font: { ...band.font, family: e.target.value as FontFamily } },
                        })
                      }
                    >
                        {FAMILIES.map((f) => (
                          <option key={f} value={f}>
                            {familyLabel(f)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mini">
                      Size
                      <input
                        type="number"
                        min={5}
                        max={48}
                        value={band.size}
                        onChange={(e) =>
                          setDecorations({ [which]: { ...band, size: Number(e.target.value) || 9 } })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
