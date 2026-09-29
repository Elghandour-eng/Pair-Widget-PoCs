import { createElement, type ReactNode } from 'react'

/**
 * Parses markdown text and converts it to React elements
 * Supports: links [Text](url), bold **text**, italic *text*, bold-italic ***text***,
 * strike-through ~~text~~, inline code `code`, bullet points, numbered lists
 */

export function parseMarkdown(text: string): ReactNode[] {
  if (!text) return []

  let keyCounter = 0

  // Split text into lines to handle block-level elements (lists)
  const lines = text.split('\n')

  // Trim leading and trailing empty lines to prevent extra spacing at top/bottom
  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift()
  }
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop()
  }

  if (lines.length === 0) return []

  const processedLines: ReactNode[] = []

  // Process inline markdown patterns
  const processInlineMarkdown = (lineText: string): ReactNode[] => {
    const inlineParts: ReactNode[] = []
    let remaining = lineText

    // Helper to add plain text, auto-linking bare URLs and phone numbers
    const addText = (str: string) => {
      if (!str) return
      // URLs (with or without protocol) and phone numbers (7+ digits, optional +country)
      const linkable =
        /(https?:\/\/[^\s<>()]+|(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}(?:\/[^\s<>()]*)?|[a-z0-9-]+\.(?:com|net|org|kw|io|ai|app)(?:\.[a-z]{2})?(?:\/[^\s<>()]*)?|\+?\d[\d\s-]{5,}\d)/gi
      let last = 0
      for (const m of str.matchAll(linkable)) {
        const idx = m.index ?? 0
        const token = m[0]
        const digits = token.replace(/[\s-]/g, '')
        const isPhone = /^\+?\d{7,15}$/.test(digits)
        const isUrl = !isPhone && /[a-z]/i.test(token)
        if (!isPhone && !isUrl) continue
        if (idx > last) inlineParts.push(str.slice(last, idx))
        const href = isPhone ? `tel:${digits}` : /^https?:\/\//i.test(token) ? token : `https://${token}`
        inlineParts.push(
          createElement(
            'a',
            {
              key: `auto-${keyCounter++}`,
              href,
              ...(isPhone ? {} : { target: '_blank', rel: 'noopener noreferrer' }),
              className: 'underline underline-offset-2 hover:opacity-80',
              dir: 'ltr',
            },
            token,
          ),
        )
        last = idx + token.length
      }
      if (last < str.length) inlineParts.push(str.slice(last))
    }

    interface MatchType {
      start: number
      end: number
      type: string
      data: any
    }

    // Process all patterns - we'll handle them in a single pass
    while (remaining.length > 0) {
      let found = false
      let bestMatch: MatchType | null = null

      // Helper function to check if we should update bestMatch
      const shouldUpdateMatch = (matchStart: number): boolean => {
        if (bestMatch === null) return true
        return matchStart < bestMatch.start
      }

      // Check for links: [Text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch && linkMatch.index !== undefined) {
        const matchStart = linkMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + linkMatch[0].length,
            type: 'link',
            data: { text: linkMatch[1], url: linkMatch[2] },
          }
          found = true
        }
      }

      // Check for inline code: `code` (must come before bold-italic to avoid conflicts)
      const codeMatch = remaining.match(/`([^`]+)`/)
      if (codeMatch && codeMatch.index !== undefined) {
        const matchStart = codeMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + codeMatch[0].length,
            type: 'code',
            data: { text: codeMatch[1] },
          }
          found = true
        }
      }

      // Check for strike-through: ~~text~~
      const strikeMatch = remaining.match(/~~([^~]+)~~/)
      if (strikeMatch && strikeMatch.index !== undefined) {
        const matchStart = strikeMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + strikeMatch[0].length,
            type: 'strike',
            data: { text: strikeMatch[1] },
          }
          found = true
        }
      }

      // Check for bold-italic: ***text*** (must come before bold and italic)
      const boldItalicMatch = remaining.match(/\*\*\*([^*]+)\*\*\*/)
      if (boldItalicMatch && boldItalicMatch.index !== undefined) {
        const matchStart = boldItalicMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + boldItalicMatch[0].length,
            type: 'boldItalic',
            data: { text: boldItalicMatch[1] },
          }
          found = true
        }
      }

      // Check for bold: **text**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
      if (boldMatch && boldMatch.index !== undefined) {
        const matchStart = boldMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + boldMatch[0].length,
            type: 'bold',
            data: { text: boldMatch[1] },
          }
          found = true
        }
      }

      // Check for italic: *text* (but not ***text*** or **text**)
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/)
      if (italicMatch && italicMatch.index !== undefined) {
        const matchStart = italicMatch.index
        if (shouldUpdateMatch(matchStart)) {
          bestMatch = {
            start: matchStart,
            end: matchStart + italicMatch[0].length,
            type: 'italic',
            data: { text: italicMatch[1] },
          }
          found = true
        }
      }

      if (found && bestMatch) {
        // Add text before the match
        if (bestMatch.start > 0) {
          addText(remaining.slice(0, bestMatch.start))
        }

        // Add the matched element
        const key = `md-${keyCounter++}`
        switch (bestMatch.type) {
          case 'link':
            inlineParts.push(
              createElement(
                'a',
                {
                  key,
                  href: bestMatch.data.url,
                  className: 'hover:underline text-blue-600',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                bestMatch.data.text,
              ),
            )
            break
          case 'code':
            inlineParts.push(
              createElement(
                'code',
                {
                  key,
                  className: 'bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-foreground-muted text-sm',
                },
                bestMatch.data.text,
              ),
            )
            break
          case 'strike':
            inlineParts.push(createElement('del', { key, className: 'line-through' }, bestMatch.data.text))
            break
          case 'boldItalic':
            inlineParts.push(createElement('strong', { key, className: 'font-bold italic' }, bestMatch.data.text))
            break
          case 'bold':
            inlineParts.push(createElement('strong', { key, className: 'font-bold' }, bestMatch.data.text))
            break
          case 'italic':
            inlineParts.push(createElement('em', { key, className: 'italic' }, bestMatch.data.text))
            break
        }

        // Continue with remaining text
        remaining = remaining.slice(bestMatch.end)
      } else {
        // No more matches, add remaining text
        addText(remaining)
        break
      }
    }

    return inlineParts.length > 0 ? inlineParts : [lineText]
  }

  // Process lines and group consecutive list items
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Check for bullet point: * Point (at start of line, optionally with leading whitespace)
    const bulletMatch = line.match(/^(\s*)\*\s+(.+)$/)
    if (bulletMatch) {
      const listItems: ReactNode[] = []
      const indent = bulletMatch[1]

      // Collect consecutive bullet points with same indentation
      // Skip empty lines between bullet points
      while (i < lines.length) {
        const currentLine = lines[i]

        // Skip empty lines
        if (!currentLine.trim()) {
          i++
          continue
        }

        const currentBulletMatch = currentLine.match(/^(\s*)\*\s+(.+)$/)
        if (currentBulletMatch && currentBulletMatch[1] === indent) {
          const content = processInlineMarkdown(currentBulletMatch[2])
          listItems.push(createElement('li', { key: `bullet-${keyCounter++}`, dir: 'auto' }, ...content))
          i++
        } else {
          break
        }
      }

      if (listItems.length > 0) {
        processedLines.push(
          createElement('ul', { key: `ul-${keyCounter++}`, className: 'list-disc list-inside ps-3' }, ...listItems),
        )
      }
      continue
    }

    // Check for numbered list: 1. Point, 2. point (at start of line)
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      const listItems: ReactNode[] = []
      const indent = numberedMatch[1]

      // Collect consecutive numbered items with same indentation
      // Skip empty lines between numbered items
      while (i < lines.length) {
        const currentLine = lines[i]

        // Skip empty lines
        if (!currentLine.trim()) {
          i++
          continue
        }

        const currentNumberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.+)$/)
        if (currentNumberedMatch && currentNumberedMatch[1] === indent) {
          const content = processInlineMarkdown(currentNumberedMatch[3])
          listItems.push(createElement('li', { key: `numbered-${keyCounter++}`, dir: 'auto' }, ...content))
          i++
        } else {
          break
        }
      }

      if (listItems.length > 0) {
        processedLines.push(
          createElement('ol', { key: `ol-${keyCounter++}`, className: 'list-decimal list-inside ps-3' }, ...listItems),
        )
      }
      continue
    }

    // Regular line - process inline markdown
    if (line.trim()) {
      const processed = processInlineMarkdown(line)
      processedLines.push(createElement('div', { key: `line-${keyCounter++}`, dir: 'auto' }, ...processed))
    } else {
      // Empty lines are rendered with vertical spacing (h-4) to simulate paragraph breaks
      processedLines.push(createElement('div', { key: `line-${keyCounter++}`, className: 'h-5' }))
    }
    i++
  }

  return processedLines.length > 0 ? processedLines : [text]
}
