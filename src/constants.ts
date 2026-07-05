import type { FontFamily, ToolId } from './types'

export interface ToolDef {
  id: ToolId
  label: string
  icon: string
  hint: string
}

export const TOOLS: ToolDef[] = [
  { id: 'edittext', label: 'Edit text', icon: 'T', hint: 'Click any text on the page and type the replacement. Press Enter to apply, Esc to cancel. Clear the box to erase the text.' },
  { id: 'text', label: 'Add text', icon: '+T', hint: 'Click anywhere on a page to place a new text box.' },
  { id: 'select', label: 'Select', icon: '↖', hint: 'Click an edit or annotation to move, restyle, or delete it (Del key).' },
  { id: 'whiteout', label: 'Whiteout', icon: '▭', hint: 'Drag over content to cover it with white.' },
  { id: 'highlight', label: 'Highlight', icon: 'H', hint: 'Drag over text to highlight it.' },
  { id: 'pen', label: 'Pen', icon: '✎', hint: 'Draw freehand on the page.' },
]

export const FAMILIES: FontFamily[] = ['Helvetica', 'Times', 'Courier']

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export const HIGHLIGHT_COLOR = '#fde047'

export const HISTORY_LIMIT = 60
