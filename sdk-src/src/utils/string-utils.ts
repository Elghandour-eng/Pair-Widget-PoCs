/**
 * Generates initials from the first two words of a string
 * @param name - The name string to extract initials from
 * @returns The initials (e.g., "Website Name" -> "WN", "Website Name Good" -> "WN")
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return ''

  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}
