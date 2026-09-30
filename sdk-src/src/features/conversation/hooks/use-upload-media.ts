import { useMutation } from '@tanstack/react-query'

import { uploadMedia } from '@/features/conversation/apis/upload-media'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function useUploadMedia() {
  return useMutation({
    mutationFn: (file: File) => {
      logger.debug('useUploadMedia', 'Starting upload mutation', { name: file.name })
      return uploadMedia(file)
    },
    onSuccess: (data) => {
      logger.debug('useUploadMedia', 'Upload mutation successful', data)
    },
    onError: (error) => {
      logger.debug('useUploadMedia', 'Upload mutation failed', error)
    },
  })
}
