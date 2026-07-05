export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)))

export function hexToRgb01(hex) {
  let s = String(hex || '').replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  const n = parseInt(s, 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
