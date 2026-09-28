/**
 * The visitor's own view of the widget: a language and a theme picked from the
 * header controls, kept per widget so they survive reloads.
 *
 * The backend serves a re-translated / re-themed config from
 * `<origin>/pv/<lang|x>/<theme|x>` — the same switch the studio's test page
 * uses — so switching is nothing more than fetching the config again from the
 * right base. `x` keeps that side of the saved design.
 */

export type WidgetLang = 'en' | 'ar'
export type WidgetTheme = 'light' | 'dark'

export interface ViewOverride {
  lang?: WidgetLang
  theme?: WidgetTheme
}

const storageKey = (widgetId: string | null) => `pair_widget_view_${widgetId ?? ''}`

export function getViewOverride(widgetId: string | null): ViewOverride {
  try {
    const raw = localStorage.getItem(storageKey(widgetId))
    if (!raw) return {}
    const v = JSON.parse(raw) as ViewOverride
    return {
      lang: v.lang === 'en' || v.lang === 'ar' ? v.lang : undefined,
      theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : undefined,
    }
  } catch {
    return {}
  }
}

export function setViewOverride(widgetId: string | null, view: ViewOverride): void {
  try {
    if (!view.lang && !view.theme) localStorage.removeItem(storageKey(widgetId))
    else localStorage.setItem(storageKey(widgetId), JSON.stringify(view))
  } catch {
    // Private mode: the choice still applies for this load.
  }
}

/**
 * The config base for a view: the configured base with any /pv/… or /lang/…
 * suffix it already carries stripped, then the view's own /pv segment added.
 * No override at all returns the base untouched, so a backend that has no /pv
 * mount is never asked for one.
 */
export function viewBaseUrl(base: string, view: ViewOverride): string {
  const bare = base.replace(/\/$/, '').replace(/\/(pv\/[^/]+\/[^/]+|lang\/[^/]+)$/, '')
  if (!view.lang && !view.theme) return base
  return `${bare}/pv/${view.lang ?? 'x'}/${view.theme ?? 'x'}`
}
