import { createElement } from 'react'
import { registerFeature } from '../registry'
import { drawBlockEdit, drawEdit } from './draw'
import { BlockEditCover, EditCover } from './views'
import type { ElementKind } from '../../types'
import type { BlockEditElement, EditElement } from './types'

const editKind: ElementKind<EditElement> = {
  type: 'edit',
  pinned: true,
  layer: 10,
  render: (el, ctx) => createElement(EditCover, { el, ctx }),
  draw: drawEdit,
  bounds: (el, ctx) => {
    const line = ctx.linesById[el.lineId]
    return line ? { x: line.x, y: line.top, w: line.width, h: line.height } : null
  },
}

const blockEditKind: ElementKind<BlockEditElement> = {
  type: 'blockedit',
  pinned: true,
  layer: 10,
  render: (el, ctx) => createElement(BlockEditCover, { el, ctx }),
  draw: drawBlockEdit,
  bounds: (el, ctx) => {
    const block = ctx.blocksById[el.blockId]
    return block ? { x: block.x, y: block.top, w: block.width, h: block.height } : null
  },
}

registerFeature({
  name: 'text-edit',
  elements: [editKind, blockEditKind],
  tools: [
    {
      id: 'edittext',
      label: 'Edit text',
      icon: 'T',
      group: 'text',
      order: 10,
      behaviour: { cursor: 'text', showLineHits: 'line' },
      hint: 'Click any line to rewrite it. Enter applies, Esc cancels, an empty box erases the line. Double-click to edit the whole paragraph.',
    },
    {
      id: 'editpara',
      label: 'Edit paragraph',
      icon: '¶',
      group: 'text',
      order: 11,
      behaviour: { cursor: 'text', showLineHits: 'block' },
      hint: 'Click a paragraph to edit it as one block. The text re-wraps inside the original column width. Cmd/Ctrl+Enter applies.',
    },
  ],
})

export * from './types'
export * from './session'
export { LineEditor, BlockEditor } from './views'
