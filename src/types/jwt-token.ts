/**
 * Decoded JWT token structure from the widget registration endpoint
 */
export interface DecodedWidgetToken {
  widgetId: string
  contactId: string
  contactSocialAccountId: string
  workspaceId: string
  preChatData: {
    [key: string]: string | undefined
    fullName?: string
    emailAddress?: string
    phoneNumber?: string
  }
  iat: number // Issued at timestamp
  exp: number // Expiration timestamp
}
