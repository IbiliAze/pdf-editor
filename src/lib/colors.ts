export interface Rgb255 {
  r: number
  g: number
  b: number
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v))

export const clampInt = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(v)))

/** '#rrggbb' or '#rgb' → components in 0..1 (for pdf-lib). */
export function hexToRgb01(hex: string): Rgb255 {
  let s = String(hex || '').replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  const n = parseInt(s, 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

/** Components in 0..255 → '#rrggbb'. */
export function rgbToHex({ r, g, b }: Rgb255): string {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
