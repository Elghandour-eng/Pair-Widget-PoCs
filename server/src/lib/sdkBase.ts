import { env } from '../config/env.js'

/**
 * Where a page should load the widget SDK from.
 *
 * `WIDGET_SDK_DIST` means a local build is being served at /sdk, and that is
 * what should be used — otherwise a change to the widget itself is invisible
 * until the hosted SDK is redeployed. It has to be decided per request, since
 * the origin is whatever host the page was reached on.
 */
export const sdkBaseUrl = (req: { protocol: string; get: (header: string) => string | undefined }): string =>
  env.WIDGET_SDK_DIST ? `${req.protocol}://${req.get('host')}/sdk` : env.WIDGET_SDK_BASE_URL
