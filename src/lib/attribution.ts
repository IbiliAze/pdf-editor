/**
 * Where a visitor came from, remembered for the tab so it can be stored with
 * their account if they sign up. Only the campaign tags in our own URL and
 * the referring host are kept; nothing about the document is involved.
 */
const KEY = 'em-pdf-source'
const MAX = 300

export function captureAttribution(
  search: string = window.location.search,
  referrer: string = document.referrer,
): void {
  const parts: string[] = []
  const params = new URLSearchParams(search)
  for (const name of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(name)
    if (value) parts.push(`${name.slice(4)}:${value}`)
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname
      if (host && host !== window.location.hostname) parts.push(`ref:${host}`)
    } catch {
      // not a URL; ignore
    }
  }
  if (!parts.length) return
  try {
    // First touch wins: a reload with a clean URL must not erase the campaign.
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, parts.join('|').slice(0, MAX))
  } catch {
    // storage blocked; signup source is simply unknown
  }
}

export function signupSource(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}
