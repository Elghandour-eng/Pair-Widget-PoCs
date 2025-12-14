const SCROLL_BOTTOM_THRESHOLD = 20 // 20px threshold for "at bottom" detection
const SCROLL_TOP_THRESHOLD = 70 // 70px threshold for "at top" detection

/**
 * Check if user is at bottom (within threshold)
 */
export function checkIfAtBottom(container: HTMLElement | null): boolean {
  if (!container) return false

  const { scrollTop, scrollHeight, clientHeight } = container
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  return distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD
}

/**
 * Auto-scroll to bottom
 */
export function scrollToBottom(container: HTMLElement | null, behavior: ScrollBehavior = 'smooth'): void {
  if (!container) return

  if (behavior === 'instant') {
    container.scrollTop = container.scrollHeight
  } else {
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
  }
}

/**
 * Check if user is at top (within threshold)
 */
export function checkIfAtTop(container: HTMLElement | null): boolean {
  if (!container) return false

  const { scrollTop } = container
  return scrollTop <= SCROLL_TOP_THRESHOLD
}

export { SCROLL_BOTTOM_THRESHOLD, SCROLL_TOP_THRESHOLD }
