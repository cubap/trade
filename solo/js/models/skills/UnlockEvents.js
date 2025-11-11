// Lightweight pub-sub for unlock notifications to avoid coupling models to UI
let listener = null

export function setUnlockListener(fn) {
  listener = typeof fn === 'function' ? fn : null
}

export function emitUnlocks(payload) {
  try {
    if (listener) listener(payload)
  } catch (e) {
    // Swallow UI errors to avoid breaking simulation
    // eslint-disable-next-line no-console
    console.warn('Unlock listener error:', e)
  }
}
