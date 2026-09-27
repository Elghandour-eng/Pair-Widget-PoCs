import { env } from '../config/env.js'

/** True when a local build of the widget SDK is being served at /sdk. */
export const isLocalSdk = (): boolean => !!env.WIDGET_SDK_DIST

/**
 * Where a page should load the widget SDK from.
 *
 * A local build returns the *relative* '/sdk', to be resolved against whatever
 * origin the page itself was served from. Deriving an absolute URL from the
 * request is wrong: the dashboard reaches this server through a proxy that
 * rewrites the Host header, so the page would tell the browser to fetch the
 * SDK from `localhost:4100` — the visitor's own machine, not the server.
 */
export const sdkBaseUrl = (): string => (isLocalSdk() ? '/sdk' : env.WIDGET_SDK_BASE_URL)
