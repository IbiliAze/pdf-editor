/**
 * Every link from the editor to the parent site goes through here, so each
 * placement is tagged and shows up as its own campaign in eightmile.co.uk's
 * analytics. That is the whole of the funnel measurement: no tracking script
 * is added to the editor.
 */
export const EIGHTMILE_HOME = 'https://eightmile.co.uk'
export const EIGHTMILE_SAAS = 'https://eightmile.co.uk/saas'

export type Placement = 'brand' | 'header' | 'empty-state' | 'help' | 'post-download' | 'account'

export function eightmileUrl(placement: Placement, base: string = EIGHTMILE_SAAS): string {
  const url = new URL(base)
  url.searchParams.set('utm_source', 'pdf-editor')
  url.searchParams.set('utm_medium', 'app')
  url.searchParams.set('utm_campaign', placement)
  return url.toString()
}

/** Shared attributes for outbound links so the open document is never lost. */
export const outbound = { target: '_blank', rel: 'noopener' } as const
