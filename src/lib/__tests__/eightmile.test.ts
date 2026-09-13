import { describe, expect, it } from 'vitest'
import { EIGHTMILE_HOME, EIGHTMILE_SAAS, eightmileUrl } from '../eightmile'

describe('eightmileUrl', () => {
  it('points at the services page and names the placement', () => {
    const url = new URL(eightmileUrl('help'))
    expect(url.origin + url.pathname).toBe(EIGHTMILE_SAAS)
    expect(url.searchParams.get('utm_source')).toBe('pdf-editor')
    expect(url.searchParams.get('utm_medium')).toBe('app')
    expect(url.searchParams.get('utm_campaign')).toBe('help')
  })

  it('can target another page on the site', () => {
    const url = new URL(eightmileUrl('brand', EIGHTMILE_HOME))
    expect(url.origin + url.pathname).toBe(EIGHTMILE_HOME + '/')
    expect(url.searchParams.get('utm_campaign')).toBe('brand')
  })

  it('does not double up a query string', () => {
    const url = eightmileUrl('header', 'https://eightmile.co.uk/saas?ref=x')
    expect(url.match(/\?/g)).toHaveLength(1)
    expect(new URL(url).searchParams.get('ref')).toBe('x')
  })
})
