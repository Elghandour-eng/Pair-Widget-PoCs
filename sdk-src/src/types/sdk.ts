export interface WidgetSDKConfig {
  websiteToken: string
  baseUrl?: string
  user?: {
    identifier: string
    email?: string
    name?: string
    phone?: string
  }
}

export interface WidgetSDK {
  run: (config: WidgetSDKConfig) => void
  setUser: (user: WidgetSDKConfig['user']) => void
}

declare global {
  interface Window {
    widgetSDK?: WidgetSDK
  }
}
