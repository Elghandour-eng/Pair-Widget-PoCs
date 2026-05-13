export const WIDGET_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/webm',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/m4a',
]

// ─── Voice Recording ────────────────────────────────────────────────────────

/** Hard API upload limit */
export const VOICE_MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Raw-bytes threshold that triggers an auto-chunk.
 * We stop the current recorder and start a new one before hitting the 5 MB limit.
 * The MP3 output will be even smaller (compression), so this is conservative.
 */
export const VOICE_CHUNK_SAFETY_THRESHOLD = 4.5 * 1024 * 1024 // 4.5 MB

/** MP3 encoding bitrate (kbps) */
export const VOICE_MP3_BITRATE = 128

/**
 * How often MediaRecorder fires ondataavailable (ms).
 * Smaller = more granular size tracking; 1 s is a good balance.
 */
export const VOICE_RECORDER_TIMESLICE_MS = 1000

/** Soft recording cap in seconds (3 min). Size-based chunking is the real guard. */
export const VOICE_MAX_DURATION_S = 180

/**
 * Maximum file size for widget uploads (5MB)
 */
export const WIDGET_MAX_FILE_SIZE = 5 * 1024 * 1024
