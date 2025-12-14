// Query keys for widget config
export const WIDGET_CONFIG_QUERY_KEYS = {
  CONFIG: () => ['widget-config'] as const,
} as const

// Export alias for consistency with naming
export const widgetConfigKeys = WIDGET_CONFIG_QUERY_KEYS
