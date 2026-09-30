import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface UploadMediaResponse {
  media_url: string
  media_type: string
  file_name: string
  file_size: number
}

export async function uploadMedia(file: File): Promise<UploadMediaResponse> {
  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to upload media')
  }

  const formData = new FormData()
  formData.append('file', file)

  logger.debug('uploadMedia', 'Uploading file', {
    name: file.name,
    size: file.size,
    type: file.type,
  })

  const response = await apiClient.post<UploadMediaResponse>(`/v1/widget/${widgetId}/media/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  logger.debug('uploadMedia', 'File uploaded successfully', { url: response.data.media_url })
  return response.data
}
