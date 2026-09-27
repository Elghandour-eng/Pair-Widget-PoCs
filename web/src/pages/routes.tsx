import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Every page is its own chunk, loaded on first navigation. `loaders` is kept
 * separate from the lazy components so the Shell can warm a chunk up on hover
 * (see `prefetch`) without rendering anything.
 */
const loaders = {
  '/login': () => import('@/pages/Login'),
  '/widgets': () => import('@/pages/Widgets'),
  '/widgets/:widgetId': () => import('@/pages/WidgetDetail'),
  '/widgets/:widgetId/builder': () => import('@/pages/Builder'),
  '/users': () => import('@/pages/Users'),
  '/logs': () => import('@/pages/Logs'),
  preview: () => import('@/pages/PreviewFrame'),
} as const

type LoaderKey = keyof typeof loaders

const warmed = new Set<LoaderKey>()

/** Starts downloading a page chunk in the background. Safe to call repeatedly. */
export function prefetch(key: string) {
  if (!(key in loaders) || warmed.has(key as LoaderKey)) return
  warmed.add(key as LoaderKey)
  loaders[key as LoaderKey]().catch(() => warmed.delete(key as LoaderKey))
}

function page<M, K extends keyof M>(load: () => Promise<M>, name: K): LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}

export const Login = page(loaders['/login'], 'Login')
export const Widgets = page(loaders['/widgets'], 'Widgets')
export const WidgetDetail = page(loaders['/widgets/:widgetId'], 'WidgetDetail')
export const Builder = page(loaders['/widgets/:widgetId/builder'], 'Builder')
export const Users = page(loaders['/users'], 'Users')
export const Logs = page(loaders['/logs'], 'Logs')
export const PreviewFrame = page(loaders.preview, 'PreviewFrame')
