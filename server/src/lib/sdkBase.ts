import { existsSync } from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'

/**
 * The widget SDK this deployment serves, and whether it is really there.
 *
 * Two things have to agree: whether /sdk is mounted, and whether pages are told
 * to load the SDK from /sdk. Deciding that separately is what produced the worst
 * class of bug here — a deployment with no local build quietly pointed every
 * embed at a *different*, older SDK origin, so a new config ran against an old
 * program and nothing anywhere reported an error.
 *
 * So the answer is settled once, at startup, from the presence of the bundle's
 * entry file rather than of its directory: an empty or half-copied dist would
 * otherwise pass a directory check and then 404 every request for sdk.js, which
 * to a host page is indistinguishable from "the snippet does not work".
 */
const probe = (): { dir: string; ok: boolean } | null => {
  if (!env.WIDGET_SDK_DIST) return null
  const dir = path.resolve(env.WIDGET_SDK_DIST)
  return { dir, ok: existsSync(path.join(dir, 'sdk.js')) }
}

const local = probe()

/** The directory to serve at /sdk, or null when there is no usable build. */
export const localSdkDist = (): string | null => (local?.ok ? local.dir : null)

/**
 * What to report about the local build. `configured` without `ok` is a
 * misconfiguration, not a mode: it means this deployment intended to ship its
 * own SDK and is instead falling back to a copy it does not control.
 */
export const localSdkStatus = (): { configured: boolean; ok: boolean; dir: string | null } => ({
  configured: !!local,
  ok: !!local?.ok,
  dir: local?.dir ?? null,
})

/** True when a local build of the widget SDK is being served at /sdk. */
export const isLocalSdk = (): boolean => !!local?.ok

/**
 * Where a page should load the widget SDK from.
 *
 * A local build returns the *relative* '/sdk', to be resolved against whatever
 * origin the page itself was served from. Deriving an absolute URL from the
 * request is wrong: the dashboard reaches this server through a proxy that
 * rewrites the Host header, so the page would tell the browser to fetch the
 * SDK from `localhost:4100` — the visitor's own machine, not the server.
 */
export const sdkBaseUrl = (): string => {
  if (isLocalSdk()) return '/sdk'
  // Nothing configured falls back to this origin's own /sdk, which will 404.
  // That is deliberate: a visible failure that points at this deployment beats
  // quietly loading a widget from somewhere else, which is indistinguishable
  // from working until you notice the widget is the wrong version.
  return env.WIDGET_SDK_BASE_URL || '/sdk'
}

/**
 * Checks once, at startup, that the configured SDK origin really serves the
 * widget — and says so loudly when it does not.
 *
 * This exists because the failure it catches is invisible from the server's
 * side: a WIDGET_SDK_BASE_URL pointing at an origin with no sdk.js at its root
 * (the deployment's own origin, say) leaves the server perfectly healthy while
 * every host page refuses the script for being JSON, and the only evidence is
 * in a visitor's browser console. One request at boot moves that evidence into
 * the deployment's own logs.
 *
 * It never blocks or fails startup: a slow or unreachable SDK origin is not a
 * reason to refuse to serve the dashboard.
 */
export const checkSdkOrigin = (log: {
  info: (o: object, m: string) => void
  error: (o: object, m: string) => void
}): void => {
  if (isLocalSdk() || !env.WIDGET_SDK_BASE_URL) return
  const url = `${env.WIDGET_SDK_BASE_URL.replace(/\/$/, '')}/sdk.js`
  const done = (o: object, m: string, bad: boolean) => (bad ? log.error(o, m) : log.info(o, m))
  fetch(url, { signal: AbortSignal.timeout(8000) })
    .then((res) => {
      const type = res.headers.get('content-type') ?? ''
      const ok = res.ok && /javascript|ecmascript/i.test(type)
      done(
        { url, status: res.status, type },
        ok ? 'the configured widget SDK origin serves sdk.js' : 'the configured widget SDK origin does not serve sdk.js; host pages will refuse the script',
        !ok,
      )
    })
    .catch((err: unknown) => {
      log.error({ url, err: (err as Error).message }, 'the configured widget SDK origin could not be reached')
    })
}
