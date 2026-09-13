import { registerExportPlugin } from '../../lib/export/buildPdf'
import { drawDecorations } from './decorations'
import { encryptBytes } from './encrypt'

registerExportPlugin({
  drawDecorations,
  encrypt: (bytes, password) => encryptBytes(bytes, password),
})

export { default as DecorationsPanel } from './DecorationsPanel'
export { default as DecorationLayer } from './DecorationLayer'
export { default as ExportDialog } from './ExportDialog'
export type { ExportRequest } from './ExportDialog'
export * from './decorations'
