export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'error',
    public readonly details?: unknown,
  ) {
    super(message)
  }
}
export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, 'bad_request', d)
export const unauthorized = (m = 'Unauthorized') => new HttpError(401, m, 'unauthorized')
export const forbidden = (m = 'Forbidden') => new HttpError(403, m, 'forbidden')
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found')
export const conflict = (m: string) => new HttpError(409, m, 'conflict')
export const upstream = (m: string, d?: unknown) => new HttpError(502, m, 'upstream_error', d)
