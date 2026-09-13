// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useStore } from '../../store'
import DownloadDoneCard from '../DownloadDoneCard'

// Node 25 ships a localStorage global of its own that shadows jsdom's and has
// no methods without --localstorage-file, so give the card a real one.
const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memory())
  useStore.setState({ lastDownloadAt: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('post-download card', () => {
  it('stays hidden until a download lands', () => {
    render(<DownloadDoneCard />)
    expect(screen.queryByText(/Your PDF is ready/)).not.toBeInTheDocument()
    act(() => useStore.getState().setLastDownloadAt(Date.now()))
    expect(screen.getByText(/Your PDF is ready/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'See what we build' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('href')).toContain('utm_campaign=post-download')
  })

  it('goes quiet for a fortnight once dismissed', () => {
    render(<DownloadDoneCard />)
    act(() => useStore.getState().setLastDownloadAt(1))
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/Your PDF is ready/)).not.toBeInTheDocument()

    act(() => useStore.getState().setLastDownloadAt(2))
    expect(screen.queryByText(/Your PDF is ready/)).not.toBeInTheDocument()

    localStorage.setItem('em-pdf-promo-dismissed', String(Date.now() - 15 * 86400_000))
    act(() => useStore.getState().setLastDownloadAt(3))
    expect(screen.getByText(/Your PDF is ready/)).toBeInTheDocument()
  })
})
