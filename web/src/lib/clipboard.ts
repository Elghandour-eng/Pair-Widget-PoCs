/**
 * Copying text, on every origin the studio is actually reached on.
 *
 * `navigator.clipboard` exists only in a secure context — HTTPS or localhost. The
 * staging and production deployments are reached over plain HTTP through a
 * proxy, so there the property is simply missing and every copy button silently
 * did nothing (the builder's share button papered over it by opening the link in
 * a new tab instead, which is not what the button says it does). The textarea +
 * `execCommand` path is the one that still works there, so it is the fallback
 * rather than a legacy leftover.
 *
 * Rejects when neither path copied, so the caller can say so instead of claiming
 * a copy that never happened.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* blocked by permissions policy — try the textarea */
    }
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  // Off-screen, but still rendered and focusable: display:none or visibility:hidden
  // make the selection — and therefore the copy — fail.
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
  document.body.appendChild(ta)

  const selection = document.getSelection()
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  ta.select()
  ta.setSelectionRange(0, text.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  ta.remove()
  if (selection && previous) {
    selection.removeAllRanges()
    selection.addRange(previous)
  }

  if (!copied) throw new Error('clipboard_unavailable')
}
