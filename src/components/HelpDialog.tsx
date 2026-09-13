import Modal from './Modal'
import { allTools } from '../features/registry'
import { eightmileUrl, outbound } from '../lib/eightmile'

const SHORTCUTS: [string, string][] = [
  ['Cmd/Ctrl + Z', 'Undo'],
  ['Shift + Cmd/Ctrl + Z', 'Redo'],
  ['Cmd/Ctrl + F', 'Find in document'],
  ['Cmd/Ctrl + S', 'Download'],
  ['Cmd/Ctrl + D', 'Duplicate the selection'],
  ['Cmd/Ctrl + and −', 'Zoom in and out'],
  ['Arrow keys', 'Nudge the selection, Shift for larger steps'],
  ['Delete', 'Remove the selection'],
  ['Esc', 'Finish editing, then clear the selection'],
  ['Enter', 'Apply a line edit'],
  ['Cmd/Ctrl + Enter', 'Apply a paragraph edit'],
  ['Shift while dragging', 'Square, circle, or 45 degree line'],
  ['Shift or Cmd/Ctrl + click', 'Add to the selection'],
]

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Shortcuts and tools" width={560} onClose={onClose}>
      <h4 className="help-heading">Keyboard</h4>
      <table className="help-table">
        <tbody>
          {SHORTCUTS.map(([keys, what]) => (
            <tr key={keys}>
              <th>{keys}</th>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="help-heading">Tools</h4>
      <table className="help-table">
        <tbody>
          {allTools()
            .filter((t) => !t.hidden)
            .map((t) => (
              <tr key={t.id}>
                <th>
                  <span className="tool-icon">{t.icon}</span> {t.label}
                </th>
                <td>{t.hint}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p className="hint">
        Your PDF is opened, edited and written entirely in this browser. Only your email address,
        your news preference and a record of each download reach the server.
      </p>

      <h4 className="help-heading">About</h4>
      <p className="help-about">
        Eight Mile PDF is free, built by Eight Mile. We design websites and build web apps and SaaS
        products for businesses. If you need something built,{' '}
        <a href={eightmileUrl('help')} {...outbound}>
          see what we do
        </a>
        .
      </p>
    </Modal>
  )
}
