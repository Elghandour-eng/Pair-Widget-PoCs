/**
 * Formats the Welcome Title by injecting the welcome_title_var into the {{1}} placeholder.
 *
 * Acceptance criteria:
 * - Supports adding a variable to Welcome Title using the {{1}} placeholder.
 * - Only one variable can be used in Welcome Title.
 * - The variable value must be provided from the frontend JavaScript using: welcome_title_var
 * - The variable value must have a maximum length of 35 characters.
 * - When welcome_title_var is provided, its value should be injected into the Welcome Title in place of {{1}}.
 * - If more than one variable value is provided, only the first variable should be processed
 *   and additional variables should be ignored and displayed as normal text.
 * - If welcome_title_var is not provided, the Welcome Title should still be displayed normally,
 *   but the {{1}} placeholder must not be displayed to the user.
 * - The {{1}} placeholder should never be visible to the end user.
 * - Existing Welcome Title functionality should continue to work when no variable is configured.
 */
export function formatWelcomeTitle(title?: string | null, welcomeTitleVar?: string | null): string {
  if (!title) return ''
  if (!title.includes('{{1}}')) return title

  let resolvedVar = ''

  if (welcomeTitleVar !== undefined && welcomeTitleVar !== null) {
    resolvedVar = String(welcomeTitleVar).trim()
  }

  // Maximum length of 35 characters
  if (resolvedVar.length > 35) {
    resolvedVar = resolvedVar.slice(0, 35)
  }

  if (resolvedVar) {
    // Replace first {{1}} with resolvedVar, and remove any leftover {{1}} so {{1}} is never visible
    return title.replace('{{1}}', resolvedVar).replaceAll('{{1}}', '')
  }

  // If welcome_title_var is not provided, {{1}} placeholder must not be displayed to the user
  return title.replaceAll('{{1}}', '')
}
