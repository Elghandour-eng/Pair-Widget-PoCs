import { useSyncExternalStore } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { getWidgetId } from '@/utils/widget-id'

/**
 * Whether the visitor has accepted the welcome / consent sheet. The acceptance
 * is kept per widget, per visitor; the sheet and every header read it from
 * here, so a header knows to step aside while the sheet is up.
 */

const consentKey = (widgetId: string | null) => `pair_widget_consent_${widgetId ?? ''}`

// Private mode cannot store the acceptance, so it also holds for this load.
let acceptedThisLoad = false
const listeners = new Set<() => void>()

function hasAccepted(): boolean {
  if (acceptedThisLoad) return true
  try {
    return localStorage.getItem(consentKey(getWidgetId())) === '1'
  } catch {
    return false
  }
}

export function acceptConsent() {
  try {
    localStorage.setItem(consentKey(getWidgetId()), '1')
  } catch {
    // Private mode: the gate stays dismissed for this load.
  }
  acceptedThisLoad = true
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

/** True while the consent sheet is covering the widget. */
export function useConsentPending(): boolean {
  const { widgetConfig } = useWidgetConfigContext()
  const accepted = useSyncExternalStore(subscribe, hasAccepted)
  return !!widgetConfig.consentScreen?.enabled && !accepted
}
