# Docs for BTQ Action Points Meeting (8-3-2026)

---

## 1. Token & Refresh Strategy

### Overview

- **Token Refresh Buffer**: Refresh the token **30 seconds before expiration**. This avoids edge cases by ensuring sufficient processing time for incoming requests.
- **Refresh Mechanism**: Provide a `refreshFn` callback (or execute a Refresh API using an internal refresh token) within the widget configuration.

### Configuration & SDK Script Example

```html
<script>
  window.PairAiWidgetSettings = {
    position: 'left',
    type: 'standard',
    launcherTitle: 'Chat with us!',
    refreshFn: async () => {
      // Retrieve the current token from your application
      const token = 'PASS_TOKEN_HERE'

      const response = await fetch('/api/widget/token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const { token: newToken } = await response.json()

      return newToken
    },
  }
  ;(function (d, t) {
    var BASE_URL = 'https://widgets-test.trypair.ai'
    var g = d.createElement(t),
      s = d.getElementsByTagName(t)[0]

    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)

    g.onload = function () {
      window.PairAiWidgetSDK.run({
        widgetId: '01KZ3EHCZ73XKZNSQJZFPMV6JH',
        baseUrl: BASE_URL,
      })
    }
  })(document, 'script')
</script>
```

---

## 2. Widget & Host Communication (`postMessage`)

### Overview

Bi-directional communication between the host application and the embedded widget iframe is handled using standard `window.postMessage` events.

---

### A. Host Application Listening for Widget Events

Example usage on the host website (e.g., BTQ Website):

```typescript
window.addEventListener('message', (event) => {
  if (event.origin !== 'WIDGET_DOMAIN') return

  const widgetEvent = event.data as IWidgetEvent

  switch (widgetEvent.event_type) {
    case 'cart:add':
      console.log(widgetEvent.payload.productId)
      console.log(widgetEvent.payload.quantity)

      // Update host cart
      break
  }
})
```

---

### B. Emitting an Event from Widget to Host

```typescript
window.parent.postMessage(
  {
    event_type: 'cart:add',
    payload: {
      productId: '123',
      quantity: 1,
    },
  },
  'BTQ_DOMAIN',
)
```

---

### C. Event Type Definitions & Schema Documentation

```typescript
export interface IAddToCartPayload {
  productId: string
  quantity: number
}

export interface IBrowseItemPayload {
  productId: string
}

export type WidgetEventMap = {
  'cart:add': IAddToCartPayload
  'item:browse': IBrowseItemPayload
}

export type WidgetEventType = keyof WidgetEventMap

export type IWidgetEvent = {
  [K in WidgetEventType]: {
    event_type: K
    payload?: WidgetEventMap[K]
  }
}[WidgetEventType]
```

---

### D. Host → Iframe Communication

#### 1. Host Sending Events to Iframe

```typescript
const iframe = document.getElementById('widget') as HTMLIFrameElement

iframe.contentWindow?.postMessage(
  {
    event_type: 'item:browse',
    payload: {
      productId: '456',
    },
  },
  'https://widget.com',
)
```

#### 2. Iframe Listening for Host Events

```typescript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://host.com') return

  const widgetEvent = event.data as IWidgetEvent

  switch (widgetEvent.event_type) {
    case 'item:browse':
      console.log('Browse product:', widgetEvent.payload.productId)
      break
  }
})
```
