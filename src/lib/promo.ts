const KEY = 'em-pdf-promo-dismissed'
const QUIET_DAYS = 14

/** Whether the post-download card may be shown in this browser right now. */
export function promoAllowed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0)
    return !at || now - at > QUIET_DAYS * 86400_000
  } catch {
    return true
  }
}

/** Quieten the card, whether it was dismissed or followed. */
export function promoSeen(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, String(now))
  } catch {
    // storage blocked; the card just shows again next time
  }
}
