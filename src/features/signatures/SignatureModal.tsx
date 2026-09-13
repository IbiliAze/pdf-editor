import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../../components/Modal'
import { removeWhiteBackground, renderTypedSignature, strokePath, trimTransparent } from './render'
import { loadSignatures, removeSignature, saveSignature } from './storage'
import type { Point } from '../../types'

type Tab = 'draw' | 'type' | 'upload'

const SCRIPT_FONTS = [
  { label: 'Great Vibes', css: "'Great Vibes', cursive" },
  { label: 'Playfair Display', css: "'Playfair Display', serif" },
  { label: 'Merriweather', css: "'Merriweather', serif" },
]

const INKS = ['#111827', '#1d4ed8', '#b91c1c']

interface Props {
  onClose: () => void
  onPick: (dataUrl: string) => void
}

export default function SignatureModal({ onClose, onPick }: Props) {
  const [tab, setTab] = useState<Tab>('draw')
  const [ink, setInk] = useState(INKS[0])
  const [typed, setTyped] = useState('')
  const [fontIndex, setFontIndex] = useState(0)
  const [saved, setSaved] = useState<string[]>(() => loadSignatures())
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Point[][]>([])
  const currentRef = useRef<Point[] | null>(null)

  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current
    for (const stroke of all) strokePath(ctx, stroke, 3.2, ink)
  }, [ink])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1)
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    ctx?.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
    repaint()
  }, [tab, repaint])

  useEffect(() => {
    repaint()
  }, [ink, repaint])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const commit = async () => {
    let dataUrl: string | null = null
    if (tab === 'draw') {
      const canvas = canvasRef.current
      if (!canvas || !strokesRef.current.length) return
      dataUrl = trimTransparent(canvas).toDataURL('image/png')
    } else if (tab === 'type') {
      if (!typed.trim()) return
      const c = await renderTypedSignature(typed, SCRIPT_FONTS[fontIndex].css, ink)
      dataUrl = c.toDataURL('image/png')
    } else if (uploaded) {
      dataUrl = uploaded
    }
    if (!dataUrl) return
    setSaved(saveSignature(dataUrl))
    onPick(dataUrl)
  }

  const onUpload = async (file: File) => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    setUploaded(removeWhiteBackground(canvas).toDataURL('image/png'))
  }

  return (
    <Modal
      title="Add a signature"
      width={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={tab === 'draw' ? !dirty : tab === 'type' ? !typed.trim() : !uploaded}
            onClick={() => void commit()}
          >
            Place signature
          </button>
        </>
      }
    >
      <div className="tabs">
        {(['draw', 'type', 'upload'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'draw' ? 'Draw' : t === 'type' ? 'Type' : 'Upload'}
          </button>
        ))}
      </div>

      {tab === 'draw' && (
        <>
          <canvas
            ref={canvasRef}
            className="sig-pad"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              currentRef.current = [point(e)]
              repaint()
            }}
            onPointerMove={(e) => {
              if (!currentRef.current) return
              currentRef.current.push(point(e))
              repaint()
            }}
            onPointerUp={() => {
              if (currentRef.current && currentRef.current.length) {
                strokesRef.current.push(currentRef.current)
                setDirty(true)
              }
              currentRef.current = null
              repaint()
            }}
          />
          <div className="sig-row">
            <InkPicker ink={ink} setInk={setInk} />
            <button
              className="btn"
              onClick={() => {
                strokesRef.current = []
                currentRef.current = null
                setDirty(false)
                repaint()
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {tab === 'type' && (
        <>
          <div className="auth-form">
            <label>
              Your name
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Alex Morgan"
              />
            </label>
          </div>
          <div className="sig-styles">
            {SCRIPT_FONTS.map((f, i) => (
              <button
                key={f.label}
                className={`sig-style${fontIndex === i ? ' active' : ''}`}
                style={{ fontFamily: f.css, color: ink }}
                onClick={() => setFontIndex(i)}
              >
                {typed || 'Your name'}
              </button>
            ))}
          </div>
          <div className="sig-row">
            <InkPicker ink={ink} setInk={setInk} />
          </div>
        </>
      )}

      {tab === 'upload' && (
        <div className="sig-upload">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f)
            }}
          />
          <p className="hint">
            A photo or scan works. The background is removed so the signature sits on the page
            rather than in a white box.
          </p>
          {uploaded && <img className="sig-preview" src={uploaded} alt="" />}
        </div>
      )}

      {!!saved.length && (
        <div className="sig-saved">
          <h4>Saved in this browser</h4>
          <div className="sig-saved-list">
            {saved.map((s) => (
              <div key={s} className="sig-saved-item">
                <button onClick={() => onPick(s)} title="Place this signature">
                  <img src={s} alt="" />
                </button>
                <button
                  className="sig-remove"
                  title="Forget this signature"
                  onClick={() => setSaved(removeSignature(s))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function InkPicker({ ink, setInk }: { ink: string; setInk: (v: string) => void }) {
  return (
    <div className="ink-picker">
      {INKS.map((c) => (
        <button
          key={c}
          className={`ink${ink === c ? ' active' : ''}`}
          style={{ background: c }}
          onClick={() => setInk(c)}
          aria-label={`Ink ${c}`}
        />
      ))}
    </div>
  )
}
