/**
 * Pair AI Widget SDK
 *
 * Based on Chatwoot's architecture:
 * - TWO separate fixed elements: bubble (button) and widget holder (panel iframe)
 * - Bubble button rendered by SDK directly (not in iframe)
 * - Panel iframe hidden/shown with CSS classes
 */

;(function (window, document) {
  'use strict'

  // Element IDs
  var BUBBLE_HOLDER_ID = 'pair-ai-bubble-holder'
  var WIDGET_HOLDER_ID = 'pair-ai-widget-holder'
  var WIDGET_IFRAME_ID = 'pair-ai-widget-iframe'

  // State
  var isOpen = false
  var widgetLoaded = false
  var widgetIframe = null
  var bubbleHolder = null
  var widgetHolder = null
  var config = {}
  var unreadCount = 0
  var badgeElement = null

  // SVG icons - matching lucide-react icons used in widget
  // MessageCircle icon (size-6 = 24px) - exact lucide-react path
  var chatIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'
  // X (close) icon (size-6 = 24px) - exact lucide-react path
  var closeIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

  // Get CSS file URL - detect from script tag or use baseUrl
  function getCSSUrl() {
    // Try to find the script tag that loaded this SDK
    var scripts = document.getElementsByTagName('script')
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src
      if (src && src.indexOf('sdk.js') !== -1) {
        // Replace sdk.js with sdk.css
        return src.replace('sdk.js', 'sdk.css')
      }
    }
    // Fallback: use baseUrl if available, otherwise default
    var baseUrl = config.baseUrl || 'https://pair-ai-widget-69d50.web.app'
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '')
    return baseUrl + '/sdk.css'
  }

  // Inject CSS file
  function injectCSS(initialColor, callback) {
    if (document.getElementById('pair-ai-widget-css')) {
      if (callback) callback()
      return
    }

    var primaryColor = initialColor || '#1f93ff' // Use provided color or default

    // Inject CSS file as link tag
    var link = document.createElement('link')
    link.id = 'pair-ai-widget-css'
    link.rel = 'stylesheet'
    link.type = 'text/css'
    link.href = getCSSUrl()

    // Handle CSS load
    if (callback) {
      link.onload = callback
      link.onerror = callback // Fallback
    }

    document.head.appendChild(link)

    // Set initial bubble color if provided
    if (primaryColor && primaryColor !== '#1f93ff') {
      updateBubbleColor(primaryColor)
    }

    // Fallback timeout if onload doesn't fire
    if (callback) {
      setTimeout(callback, 200)
    }
  }

  // Create bubble button
  function createBubble() {
    if (document.getElementById(BUBBLE_HOLDER_ID)) return

    bubbleHolder = document.createElement('div')
    bubbleHolder.id = BUBBLE_HOLDER_ID

    var position = config.position || 'right'
    if (position === 'right') {
      bubbleHolder.style.right = '20px'
    } else {
      bubbleHolder.style.left = '20px'
    }

    // Hide initially until CSS loads (prevent unstyled flash)
    bubbleHolder.style.opacity = '0'
    bubbleHolder.style.visibility = 'hidden'
    bubbleHolder.style.pointerEvents = 'none'

    var bubble = document.createElement('button')
    bubble.className = 'pair-ai-bubble'
    if (config.type === 'expanded_bubble') {
      bubble.className += ' pair-ai-bubble--expanded'
    }
    bubble.setAttribute('aria-label', config.launcherTitle || 'Open chat')
    bubble.setAttribute('title', config.launcherTitle || 'Open chat')

    // Add icon
    bubble.innerHTML = chatIcon

    // Add text for expanded bubble
    if (config.type === 'expanded_bubble' && config.launcherTitle) {
      bubble.innerHTML = chatIcon + '<span>' + config.launcherTitle + '</span>'
    }

    // Create badge element (initially hidden)
    badgeElement = document.createElement('div')
    badgeElement.className = 'pair-ai-bubble-badge'
    badgeElement.textContent = '0'
    badgeElement.setAttribute('data-count', '0')

    bubble.appendChild(badgeElement)

    // Click handler
    bubble.addEventListener('click', function () {
      toggleWidget()
    })

    bubbleHolder.appendChild(bubble)
    document.body.appendChild(bubbleHolder)
  }

  // Show bubble after CSS is loaded
  function showBubble() {
    if (!bubbleHolder) return
    bubbleHolder.style.opacity = ''
    bubbleHolder.style.visibility = ''
    bubbleHolder.style.pointerEvents = ''
  }

  // Update unread badge
  function updateUnreadBadge(count) {
    unreadCount = count || 0
    if (!badgeElement) return

    if (unreadCount > 0) {
      badgeElement.classList.add('pair-ai-badge--visible')
      var displayText = unreadCount > 99 ? '99+' : unreadCount.toString()
      badgeElement.textContent = displayText
      badgeElement.setAttribute('data-count', unreadCount.toString())
    } else {
      badgeElement.classList.remove('pair-ai-badge--visible')
      badgeElement.textContent = '0'
      badgeElement.setAttribute('data-count', '0')
    }
  }

  // Create widget holder with iframe
  function createWidgetHolder() {
    if (document.getElementById(WIDGET_HOLDER_ID)) return

    var position = config.position || 'right'
    widgetHolder = document.createElement('div')
    widgetHolder.id = WIDGET_HOLDER_ID
    widgetHolder.className = 'pair-ai-widget-holder pair-ai-position-' + position + ' pair-ai--hide' // Start hidden

    // Hide immediately with inline styles (before CSS loads) to prevent flash
    widgetHolder.style.opacity = '0'
    widgetHolder.style.visibility = 'hidden'
    widgetHolder.style.pointerEvents = 'none'
    widgetHolder.style.transform = 'translateY(20px)'

    // Create iframe
    widgetIframe = document.createElement('iframe')
    widgetIframe.id = WIDGET_IFRAME_ID

    // Build URL with settings
    var widgetUrl = config.baseUrl || 'https://pair-ai-widget-69d50.web.app'
    var params = []

    if (config.widgetId) params.push('widgetId=' + encodeURIComponent(config.widgetId))
    if (config.position) params.push('position=' + encodeURIComponent(config.position))
    if (config.type) params.push('type=' + encodeURIComponent(config.type))
    if (config.launcherTitle) params.push('launcherTitle=' + encodeURIComponent(config.launcherTitle))
    // Pass beBaseUrl as URL parameter so widget can set it in its window.PairAiWidgetSettings
    if (config.beBaseUrl) params.push('beBaseUrl=' + encodeURIComponent(config.beBaseUrl))
    // Pass sdkMode=true so widget knows it's embedded and doesn't render bubble
    params.push('sdkMode=true')

    if (params.length > 0) {
      widgetUrl += '?' + params.join('&')
    }

    widgetIframe.src = widgetUrl
    widgetIframe.setAttribute('allow', 'microphone; camera')

    widgetHolder.appendChild(widgetIframe)
    document.body.appendChild(widgetHolder)
  }

  // Toggle widget visibility with smooth icon animation
  function toggleWidget(forceState) {
    var newIsOpen = forceState !== undefined ? forceState : !isOpen
    if (newIsOpen === isOpen) return

    isOpen = newIsOpen

    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    if (!bubble) return

    // Animate icon change
    bubble.classList.add('pair-ai-bubble--icon-changing')

    setTimeout(function () {
      if (isOpen) {
        // Show widget
        widgetHolder.classList.remove('pair-ai--hide')
        // Remove inline styles (CSS will handle it now)
        widgetHolder.style.opacity = ''
        widgetHolder.style.visibility = ''
        widgetHolder.style.pointerEvents = ''
        widgetHolder.style.transform = ''
        // Change bubble to close icon (preserve badge)
        var existingBadge = bubble.querySelector('.pair-ai-bubble-badge')
        var badgeHTML = existingBadge ? existingBadge.outerHTML : ''
        if (config.type === 'expanded_bubble') {
          bubble.innerHTML = closeIcon + badgeHTML
          bubble.classList.remove('pair-ai-bubble--expanded')
        } else {
          bubble.innerHTML = closeIcon + badgeHTML
        }
        // Re-reference badge element after innerHTML change
        badgeElement = bubble.querySelector('.pair-ai-bubble-badge')
        // Hide bubble on mobile
        bubble.classList.add('pair-ai--hide-mobile')
        // Notify widget
        sendMessageToWidget('sdk:opened', {})
        console.log('[PairAI SDK] Widget opened')
      } else {
        // Hide widget
        widgetHolder.classList.add('pair-ai--hide')
        // Change bubble to chat icon (preserve badge)
        var existingBadge = bubble.querySelector('.pair-ai-bubble-badge')
        var badgeHTML = existingBadge ? existingBadge.outerHTML : ''
        if (config.type === 'expanded_bubble') {
          bubble.innerHTML = chatIcon + '<span>' + (config.launcherTitle || 'Chat with us!') + '</span>' + badgeHTML
          bubble.classList.add('pair-ai-bubble--expanded')
        } else {
          bubble.innerHTML = chatIcon + badgeHTML
        }
        // Re-reference badge element after innerHTML change
        badgeElement = bubble.querySelector('.pair-ai-bubble-badge')
        // Show bubble on mobile
        bubble.classList.remove('pair-ai--hide-mobile')
        // Notify widget
        sendMessageToWidget('sdk:closed', {})
        console.log('[PairAI SDK] Widget closed')
      }

      // Remove animation class after icon change
      setTimeout(function () {
        bubble.classList.remove('pair-ai-bubble--icon-changing')
      }, 50)
    }, 100) // Half of transition duration
  }

  // Setup message listener
  function setupMessageListener() {
    window.addEventListener('message', function (event) {
      // Only process messages that look like widget messages
      if (!event.data || typeof event.data !== 'object') return
      if (!event.data.type || !event.data.type.startsWith('widget:')) return

      switch (event.data.type) {
        case 'widget:ready':
          console.log('[PairAI SDK] Widget is ready')
          // Inject CSS now (widget is ready, will receive color soon)
          injectCSS(null, function () {
            showBubble()
          })
          // Send config to widget
          sendMessageToWidget('sdk:config', config)
          break
        case 'widget:close':
          // Widget requested to close
          toggleWidget(false)
          break
        case 'widget:setColor':
          // Update bubble color
          if (event.data.color) {
            // Inject CSS if not already injected (in case color comes before ready)
            injectCSS(event.data.color, function () {
              showBubble()
            })
            updateBubbleColor(event.data.color)
          }
          break
        case 'widget:unreadCount':
          // Update unread badge
          if (event.data.count !== undefined) {
            updateUnreadBadge(event.data.count)
          }
          break
        default:
          break
      }
    })
  }

  // Send message to widget
  function sendMessageToWidget(type, data) {
    if (!widgetIframe || !widgetIframe.contentWindow) return

    widgetIframe.contentWindow.postMessage({ type: type, data: data }, '*')
  }

  // Update bubble color
  function updateBubbleColor(color) {
    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    if (bubble) {
      bubble.style.background = color
    }
  }

  // Set user information
  function setUser(userData) {
    sendMessageToWidget('sdk:setUser', userData)
  }

  // Initialize SDK
  function init(options) {
    if (widgetLoaded) {
      console.log('[PairAI SDK] Widget already loaded')
      return
    }

    if (!options || !options.widgetId) {
      console.error('[PairAI SDK] widgetId is required')
      return
    }

    // Get settings
    var settings = window.PairAiWidgetSettings || {}

    // Merge config
    config = {
      widgetId: options.widgetId,
      baseUrl: options.baseUrl || 'https://pair-ai-widget-69d50.web.app',
      beBaseUrl: settings.beBaseUrl, // Read from parent's window.PairAiWidgetSettings
      position: settings.position || 'right',
      type: settings.type || 'standard',
      launcherTitle: settings.launcherTitle || 'Chat with us!',
      user: options.user,
    }

    console.log('[PairAI SDK] Initializing with config:', config)

    // Setup
    // Don't inject CSS yet - wait for color from widget to avoid blue flash
    setupMessageListener()
    createBubble()
    createWidgetHolder()

    widgetLoaded = true

    // Set user if provided
    if (config.user) {
      setTimeout(function () {
        setUser(config.user)
      }, 1000)
    }
  }

  // Public API
  window.PairAiWidgetSDK = {
    run: init,
    toggle: function (show) {
      toggleWidget(show)
    },
    show: function () {
      toggleWidget(true)
    },
    hide: function () {
      toggleWidget(false)
    },
    setUser: setUser,
    isOpen: function () {
      return isOpen
    },
  }

  // Backward compatibility
  window.widgetSDK = window.PairAiWidgetSDK

  console.log('[PairAI SDK] SDK loaded successfully')
})(window, document)
