/**
 * Debug logger utility
 * Logs with format: [DEBUG] [Feature] Function: Description
 */

function getFeatureName(filePath: string): string {
  // Extract feature name from path like:
  // - src/features/pre-chat-form/apis/pre-chat.ts -> pre-chat-form
  // - src/config/apis/widget-config.ts -> config
  // - src/pusher/utils/pusher-client.ts -> pusher
  // - src/utils/token-storage.ts -> utils
  // - src/core/http.ts -> core

  // First, check for features folder
  const featuresMatch = filePath.match(/features\/([^/]+)/)
  if (featuresMatch) {
    return featuresMatch[1]
  }

  // Then check for known root folders (after 'src/')
  // These are the root-level folders in the src directory
  const rootFolders = [
    'config',
    'pusher',
    'core',
    'components',
    'contexts',
    'lib',
    'routes',
    'types',
    'utils',
    'constant',
  ]

  for (const folder of rootFolders) {
    // Match pattern like: src/{folder}/... or just {folder}/...
    const pattern = new RegExp(`(?:src/)?${folder}(?:/|$)`)
    if (pattern.test(filePath)) {
      return folder
    }
  }

  // For other files, use the parent directory
  const parts = filePath.split('/')
  if (parts.length >= 2) {
    return parts[parts.length - 2]
  }

  return 'app'
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1] || filePath
  // Remove extension
  return fileName.replace(/\.(ts|tsx|js|jsx)$/, '')
}

/**
 * Creates a debug logger for a specific file
 * @param filePath - The file path (use import.meta.url or __filename)
 */
export function createDebugLogger(filePath: string) {
  const featureName = getFeatureName(filePath)
  const fileName = getFileName(filePath)

  return {
    /**
     * Logs a debug message
     * @param functionName - Name of the function
     * @param description - Description of what's happening
     * @param data - Optional data to log
     */
    debug: (functionName: string, description: string, data?: unknown) => {
      const prefix = `[DEBUG] [${featureName}] ${fileName}.${functionName}`
      if (data !== undefined) {
        console.debug(`${prefix}: ${description}`, data)
      } else {
        console.debug(`${prefix}: ${description}`)
      }
    },
  }
}

/**
 * Helper to get file path from import.meta.url
 * Note: In browser environments, this will be the URL, so we extract the path
 */
export function getFilePathFromUrl(url: string): string {
  // Convert URL to file path
  // In Vite, import.meta.url will be like: http://localhost:3000/src/utils/logger.ts
  // We want: src/utils/logger.ts
  try {
    const urlObj = new URL(url)
    // Remove leading slash and return pathname
    return urlObj.pathname.replace(/^\//, '')
  } catch {
    // If it's already a path (not a valid URL), return it as-is
    // This handles cases where import.meta.url might already be a path
    return url
  }
}
