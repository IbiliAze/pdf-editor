// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { captureAttribution, signupSource } from '../attribution'

beforeEach(() => sessionStorage.clear())

describe('attribution', () => {
  it('keeps the campaign tags and the referring host', () => {
    captureAttribution('?utm_source=newsletter&utm_campaign=sept&x=1', 'https://eightmile.co.uk/blog')
    expect(signupSource()).toBe('source:newsletter|campaign:sept|ref:eightmile.co.uk')
  })

  it('is unknown without any signal', () => {
    captureAttribution('', '')
    expect(signupSource()).toBeUndefined()
  })

  it('keeps the first touch for the tab', () => {
    captureAttribution('?utm_campaign=first', '')
    captureAttribution('?utm_campaign=second', '')
    expect(signupSource()).toBe('campaign:first')
  })

  it('ignores a referrer on our own host', () => {
    captureAttribution('', `http://${window.location.hostname}/verify`)
    expect(signupSource()).toBeUndefined()
  })
})
