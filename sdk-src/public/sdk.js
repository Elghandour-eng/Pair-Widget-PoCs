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
  var PREVIEW_HOLDER_ID = 'pair-ai-preview-holder'

  // State
  var isOpen = false
  // The widget has mounted and its CSS is in; before that an open is only remembered.
  var widgetReady = false
  var pendingOpen = null
  var widgetLoaded = false
  var widgetIframe = null
  var bubbleHolder = null
  var widgetHolder = null
  var previewHolder = null
  var previewAutoHide = null
  var config = {}
  var unreadCount = 0
  var badgeElement = null

  // SVG icons - custom bubble chat icon
  var chatIcon =
    '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.75 0C16.6548 0 21.5 4.58906 21.5 10.3174C21.4998 16.0455 16.6547 20.6338 10.75 20.6338C10.0544 20.6347 9.36084 20.5706 8.67773 20.4424C8.44082 20.3978 8.28982 20.3688 8.17773 20.3535C8.12917 20.3468 8.09846 20.3448 8.08203 20.3438C8.06505 20.3503 8.03238 20.364 7.97852 20.3896C7.86403 20.444 7.71093 20.5243 7.47754 20.6484C6.04594 21.4098 4.37561 21.6804 2.76465 21.3809C2.50458 21.3325 2.28858 21.1505 2.19727 20.9023C2.106 20.6539 2.15241 20.3752 2.31934 20.1699C2.78709 19.5945 3.10874 18.9013 3.25098 18.1553C3.28937 17.9501 3.20224 17.6712 2.93457 17.3994C1.12003 15.5566 9.70484e-05 13.0648 0 10.3174C0 4.58917 4.84538 0.000168646 10.75 0ZM8.08008 20.3418C8.07681 20.3423 8.07348 20.3426 8.07129 20.3428C8.06877 20.3431 8.06705 20.3427 8.06641 20.3428C8.06759 20.3428 8.07248 20.3432 8.08203 20.3438L8.09668 20.3379C8.09668 20.3379 8.09048 20.3402 8.08008 20.3418ZM10.75 1.5C5.61048 1.50017 1.5 5.47953 1.5 10.3174C1.5001 12.6463 2.44768 14.7673 4.00391 16.3477C4.47798 16.8292 4.88584 17.5802 4.72461 18.4346V18.4355C4.62072 18.981 4.44451 19.5073 4.20117 19.999C5.0949 19.9779 5.98 19.7462 6.77344 19.3242L6.78906 19.3164C7.00291 19.2027 7.18597 19.1049 7.33496 19.0342C7.47906 18.9657 7.65885 18.8882 7.85352 18.8584C8.04317 18.8294 8.22747 18.8471 8.38086 18.8682C8.53414 18.8892 8.72203 18.9236 8.93652 18.9639L8.9541 18.9678C9.54598 19.079 10.1467 19.1346 10.749 19.1338C15.8886 19.1338 19.9998 15.1552 20 10.3174C20 5.47943 15.8897 1.5 10.75 1.5ZM6.75977 9.75C7.31173 9.75025 7.75959 10.198 7.75977 10.75C7.75977 11.3021 7.31184 11.7497 6.75977 11.75H6.75C6.19787 11.7498 5.75 11.3022 5.75 10.75C5.75018 10.198 6.19798 9.75018 6.75 9.75H6.75977ZM10.7559 9.75C11.3078 9.75024 11.7557 10.198 11.7559 10.75C11.7559 11.3021 11.308 11.7498 10.7559 11.75H10.7461C10.1939 11.7498 9.74609 11.3022 9.74609 10.75C9.74627 10.198 10.194 9.75017 10.7461 9.75H10.7559ZM14.75 9.75C15.302 9.75024 15.7498 10.198 15.75 10.75C15.75 11.3022 15.3021 11.7498 14.75 11.75H14.7402C14.1881 11.7498 13.7402 11.3022 13.7402 10.75C13.7404 10.198 14.1882 9.75018 14.7402 9.75H14.75Z" fill="white"/></svg>'
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

    if (config.openAutomatically) {
      bubbleHolder.style.display = 'none'
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

    // Icon, plus the label for an expanded bubble
    bubble.innerHTML = launcherContentHtml()

    // Create badge element (initially hidden)
    badgeElement = document.createElement('div')
    badgeElement.className = 'pair-ai-bubble-badge'
    badgeElement.textContent = '0'
    badgeElement.setAttribute('data-count', '0')

    // bubble.appendChild(badgeElement)

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
    if (config.type === 'none') {
      bubbleHolder.style.display = 'none'
      return
    }
    bubbleHolder.style.opacity = ''
    bubbleHolder.style.visibility = ''
    bubbleHolder.style.pointerEvents = ''
    if (config.openAutomatically && isOpen) {
      bubbleHolder.style.display = 'none'
    }
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

  // Panel size. sdk.css reads these custom properties and falls back to the
  // sizes the panel used to be fixed at, so a host that sets nothing is
  // unaffected. A bare number is taken as pixels.
  function applyPanelSize(holder) {
    var panel = config.panel
    if (!holder || !panel) return
    var px = function (v) {
      return typeof v === 'number' ? v + 'px' : v
    }
    var map = {
      '--pair-panel-width': panel.width,
      '--pair-panel-height': panel.height,
      '--pair-panel-max-height': panel.maxHeight,
      '--pair-panel-min-height': panel.minHeight,
      '--pair-panel-bottom': panel.bottom,
      '--pair-panel-radius': panel.radius,
    }
    for (var name in map) {
      if (map[name] !== undefined && map[name] !== null && map[name] !== '') {
        holder.style.setProperty(name, px(map[name]))
      }
    }
  }

  // Create widget holder with iframe
  function createWidgetHolder() {
    if (document.getElementById(WIDGET_HOLDER_ID)) return

    var position = config.position || 'right'
    widgetHolder = document.createElement('div')
    widgetHolder.id = WIDGET_HOLDER_ID

    var holderClass = 'pair-ai-widget-holder pair-ai-position-' + position + ' pair-ai--hide'
    if (config.openAutomatically) {
      holderClass += ' pair-ai-widget-holder--auto-open'
    }
    widgetHolder.className = holderClass
    applyPanelSize(widgetHolder)

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
    if (config.transport) params.push('transport=' + encodeURIComponent(config.transport))
    if (config.userId) params.push('userId=' + encodeURIComponent(config.userId))
    if (config.welcome_title_var) params.push('welcome_title_var=' + encodeURIComponent(config.welcome_title_var))
    // The page opens and closes the panel itself, so the widget keeps a close button.
    if (config.startClosed) params.push('startClosed=true')
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

  // Create preview holder
  function createPreviewHolder() {
    if (document.getElementById(PREVIEW_HOLDER_ID)) return

    previewHolder = document.createElement('div')
    previewHolder.id = PREVIEW_HOLDER_ID

    var position = config.position || 'right'
    if (position === 'right') {
      previewHolder.style.right = '20px'
    } else {
      previewHolder.style.left = '20px'
    }

    previewHolder.className = 'pair-ai-preview-holder pair-ai-position-' + position
    document.body.appendChild(previewHolder)
  }

  // Pin the preview to the same corner as the live launcher, right above it
  function anchorPreviewToBubble(retry) {
    if (!previewHolder) return
    var bubble = bubbleHolder ? bubbleHolder.querySelector('.pair-ai-bubble') : null
    var r = bubble ? bubble.getBoundingClientRect() : null
    if ((!r || !r.width) && bubbleHolder) r = bubbleHolder.getBoundingClientRect()
    if (!r || !r.width) {
      // the launcher may still be mid-animation right after the panel closes
      if (!retry)
        setTimeout(function () {
          anchorPreviewToBubble(true)
        }, 350)
      return
    }
    var onRight = window.innerWidth - r.right <= r.left
    if (onRight) {
      previewHolder.style.right = Math.max(12, window.innerWidth - r.right) + 'px'
      previewHolder.style.left = 'auto'
    } else {
      previewHolder.style.left = Math.max(12, r.left) + 'px'
      previewHolder.style.right = 'auto'
    }
    var offset = (config.toastDesign && config.toastDesign.offset) || 12
    previewHolder.style.bottom = Math.max(20, window.innerHeight - r.top + offset) + 'px'
  }

  // Show preview card
  function showPreview(data) {
    if (!previewHolder || !data || !data.message) return
    // An incoming message takes the spot above the launcher.
    hideTeaser()
    anchorPreviewToBubble()

    var position = config.position || 'right'
    var cornerClass = position === 'right' ? 'pair-ai-preview-card--right' : 'pair-ai-preview-card--left'
    var senderName = data.message.senderName || config.widgetName || 'Agent'
    var content = (data.message.content || '').replace(/\*\*|__|`/g, '')

    // Avatar HTML — 24px with 5.76px border radius
    var avatarHtml = false
      ? '<img src="' + data.message.senderAvatar + '" alt="Avatar" />'
      : '<div class="pair-ai-preview-header-fallback"><svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10.75 0C16.6548 0 21.5 4.58906 21.5 10.3174C21.4998 16.0455 16.6547 20.6338 10.75 20.6338C10.0544 20.6347 9.36084 20.5706 8.67773 20.4424C8.44082 20.3978 8.28982 20.3688 8.17773 20.3535C8.12917 20.3468 8.09846 20.3448 8.08203 20.3438C8.06505 20.3503 8.03238 20.364 7.97852 20.3896C7.86403 20.444 7.71093 20.5243 7.47754 20.6484C6.04594 21.4098 4.37561 21.6804 2.76465 21.3809C2.50458 21.3325 2.28858 21.1505 2.19727 20.9023C2.106 20.6539 2.15241 20.3752 2.31934 20.1699C2.78709 19.5945 3.10874 18.9013 3.25098 18.1553C3.28937 17.9501 3.20224 17.6712 2.93457 17.3994C1.12003 15.5566 9.70484e-05 13.0648 0 10.3174C0 4.58917 4.84538 0.000168646 10.75 0ZM8.08008 20.3418C8.07681 20.3423 8.07348 20.3426 8.07129 20.3428C8.06877 20.3431 8.06705 20.3427 8.06641 20.3428C8.06759 20.3428 8.07248 20.3432 8.08203 20.3438L8.09668 20.3379C8.09668 20.3379 8.09048 20.3402 8.08008 20.3418ZM10.75 1.5C5.61048 1.50017 1.5 5.47953 1.5 10.3174C1.5001 12.6463 2.44768 14.7673 4.00391 16.3477C4.47798 16.8292 4.88584 17.5802 4.72461 18.4346V18.4355C4.62072 18.981 4.44451 19.5073 4.20117 19.999C5.0949 19.9779 5.98 19.7462 6.77344 19.3242L6.78906 19.3164C7.00291 19.2027 7.18597 19.1049 7.33496 19.0342C7.47906 18.9657 7.65885 18.8882 7.85352 18.8584C8.04317 18.8294 8.22747 18.8471 8.38086 18.8682C8.53414 18.8892 8.72203 18.9236 8.93652 18.9639L8.9541 18.9678C9.54598 19.079 10.1467 19.1346 10.749 19.1338C15.8886 19.1338 19.9998 15.1552 20 10.3174C20 5.47943 15.8897 1.5 10.75 1.5ZM6.75977 9.75C7.31173 9.75025 7.75959 10.198 7.75977 10.75C7.75977 11.3021 7.31184 11.7497 6.75977 11.75H6.75C6.19787 11.7498 5.75 11.3022 5.75 10.75C5.75018 10.198 6.19798 9.75018 6.75 9.75H6.75977ZM10.7559 9.75C11.3078 9.75024 11.7557 10.198 11.7559 10.75C11.7559 11.3021 11.308 11.7498 10.7559 11.75H10.7461C10.1939 11.7498 9.74609 11.3022 9.74609 10.75C9.74627 10.198 10.194 9.75017 10.7461 9.75H10.7559ZM14.75 9.75C15.302 9.75024 15.7498 10.198 15.75 10.75C15.75 11.3022 15.3021 11.7498 14.75 11.75H14.7402C14.1881 11.7498 13.7402 11.3022 13.7402 10.75C13.7404 10.198 14.1882 9.75018 14.7402 9.75H14.75Z" /></svg></div>'

    // Badge HTML
    var badgeHtml = ''
    if (false) {
      // if (data.unreadCount > 1) {
      var displayCount = data.unreadCount > 99 ? '99+' : data.unreadCount
      badgeHtml = '<div class="pair-ai-preview-badge">' + displayCount + '</div>'
    }

    var isAr = /[\u0600-\u06FF]/.test(content)
    var brand =
      (config.launcherDesign && config.launcherDesign.background === '#brand' ? config.primaryColor : null) ||
      config.primaryColor ||
      '#B3202C'
    var iconUrl = config.launcherDesign && config.launcherDesign.iconUrl
    if (iconUrl && iconUrl.indexOf('http') !== 0) iconUrl = (config.beBaseUrl || '').replace(/\/$/, '') + iconUrl
    var tdS = (config.toastDesign && config.toastDesign.styles) || {}
    var cardBg = tdS.backgroundColor || '#ffffff'
    var cardColor = tdS.color || '#1c1d22'
    var cardRadius = tdS.borderRadius || '16px'
    var avatar = iconUrl
      ? '<img src="' +
        iconUrl +
        '" alt="" style="width:30px;height:30px;border-radius:9px;object-fit:contain;background:' +
        brand +
        ';flex-shrink:0" />'
      : '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:' +
        brand +
        ';color:#fff;font-weight:700;font-size:14px;flex-shrink:0">' +
        (senderName || 'C').charAt(0) +
        '</span>'

    var html =
      '<div class="pair-ai-preview-card ' +
      cornerClass +
      '" role="button" tabindex="0" dir="' +
      (isAr ? 'rtl' : 'ltr') +
      '"' +
      ' style="all:initial;font-family:inherit;display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;padding:14px 16px;cursor:pointer;background:' +
      cardBg +
      ';color:' +
      cardColor +
      ';border-radius:' +
      cardRadius +
      ';border:1px solid rgba(0,0,0,0.06);box-shadow:0 10px 30px rgba(0,0,0,0.16), 0 0 0 1.5px ' +
      brand +
      '22">' +
      '  <div style="display:flex;align-items:center;gap:10px">' +
      avatar +
      '    <span style="flex:1;font-size:12.5px;font-weight:700;font-family:inherit;color:inherit">' +
      senderName +
      '</span>' +
      '    <button class="pair-ai-preview-close" aria-label="Close" style="all:initial;cursor:pointer;line-height:0;padding:4px;opacity:.55">' +
      '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '    </button>' +
      '  </div>' +
      '  <div class="pair-ai-preview-body" style="font-size:13.5px;line-height:1.55;font-family:inherit;color:inherit;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' +
      content +
      '</div>' +
      '  <span class="pair-ai-preview-action" style="font-size:12px;font-weight:600;font-family:inherit;color:' +
      brand +
      '">' +
      (isAr ? 'اعرض الرسالة ←' : 'View message →') +
      '</span>' +
      '</div>'

    previewHolder.innerHTML = html

    // Add event listeners
    var closeBtn = previewHolder.querySelector('.pair-ai-preview-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hidePreview()
        sendMessageToWidget('sdk:dismissPreview', {})
      })
    }

    var cardEl = previewHolder.querySelector('.pair-ai-preview-card')
    if (cardEl) {
      cardEl.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.pair-ai-preview-close')) return
        hidePreview()
        toggleWidget(true)
        sendMessageToWidget('sdk:dismissPreview', {})
      })
    }

    // Auto-hide after the Builder's duration (clamped to a readable minimum)
    if (previewAutoHide) clearTimeout(previewAutoHide)
    var tdd = config.toastDesign || {}
    var dur = Math.max(4000, Number(tdd.durationMs) || 8000)
    previewAutoHide = setTimeout(function () {
      hidePreview()
    }, dur)

    // Builder toast design: colours, radius and fonts land on the card itself
    var td = config.toastDesign || {}
    var card = previewHolder.querySelector('.pair-ai-preview-card')
    if (card && td.styles) {
      for (var k in td.styles) {
        try {
          card.style[k] = td.styles[k]
        } catch (e) {}
      }
    }
    if (td.showIcon === false) {
      var av = previewHolder.querySelector('.pair-ai-preview-header-fallback, .pair-ai-preview-card img')
      if (av) av.style.display = 'none'
    }
    if (td.iconColor) {
      var fb = previewHolder.querySelector('.pair-ai-preview-header-fallback svg')
      if (fb) fb.style.fill = td.iconColor
    }
    previewHolder.classList.add('pair-ai-preview--visible')
  }

  // Hide preview card
  function hidePreview() {
    if (!previewHolder) return
    previewHolder.classList.remove('pair-ai-preview--visible')
    setTimeout(function () {
      // Clear inner html after transition
      if (!previewHolder.classList.contains('pair-ai-preview--visible')) {
        previewHolder.innerHTML = ''
      }
      // The spot above the launcher is free again.
      syncTeaser()
    }, 200)
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
        hidePreview()
        // The message above the launcher has done its job once the chat opens.
        dismissTeaser()
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
        // If openAutomatically is true, also hide the bubble on desktop
        if (config.openAutomatically && bubbleHolder) {
          bubbleHolder.style.display = 'none'
        }
        // Notify widget
        sendMessageToWidget('sdk:opened', {})
        emitToHost('widget:opened', {})
        console.log('[PairAI SDK] Widget opened')
      } else {
        // Hide widget
        widgetHolder.classList.add('pair-ai--hide')
        // Change bubble to chat icon (preserve badge)
        var existingBadge = bubble.querySelector('.pair-ai-bubble-badge')
        var badgeHTML = existingBadge ? existingBadge.outerHTML : ''
        bubble.innerHTML = launcherContentHtml() + badgeHTML
        if (config.type === 'expanded_bubble') bubble.classList.add('pair-ai-bubble--expanded')
        // Re-reference badge element after innerHTML change
        badgeElement = bubble.querySelector('.pair-ai-bubble-badge')
        // Show bubble on mobile
        bubble.classList.remove('pair-ai--hide-mobile')
        // Make sure bubble is visible when closed — unless there is no
        // launcher at all, in which case nothing ever shows.
        if (bubbleHolder) {
          bubbleHolder.style.display = config.type === 'none' ? 'none' : ''
          bubbleHolder.style.opacity = ''
          bubbleHolder.style.visibility = ''
          bubbleHolder.style.pointerEvents = ''
        }
        // Notify widget
        sendMessageToWidget('sdk:closed', {})
        emitToHost('widget:closed', {})
        console.log('[PairAI SDK] Widget closed')
      }

      // Re-apply styles after changing innerHTML
      applyBubbleStyles()

      // Remove animation class after icon change
      setTimeout(function () {
        bubble.classList.remove('pair-ai-bubble--icon-changing')
      }, 50)
    }, 100) // Half of transition duration
  }

  /**
   * Open, close or flip the panel on the host's behalf. A call that lands
   * before the widget is ready is remembered and applied once it is, so a page
   * can ask for the panel as early as it likes without showing it unstyled.
   */
  function setOpen(state) {
    if (!widgetLoaded) return console.warn('[PairAI SDK] Call run() before opening or closing the widget')
    if (!widgetReady) {
      pendingOpen = state !== undefined ? !!state : !(pendingOpen !== null ? pendingOpen : isOpen)
      return
    }
    toggleWidget(state !== undefined ? !!state : undefined)
  }

  // The same three commands, for a page that cannot reach PairWidget itself
  // (another frame, a tag manager): window.postMessage({ type: 'pair:open' }, '*').
  var HOST_COMMANDS = { 'pair:open': true, 'pair:close': false, 'pair:toggle': undefined }

  // Host subscriptions to widget -> host messages, by event name without the
  // `widget:` prefix ('*' receives every one).
  var hostListeners = {}

  function emitToHost(type, payload) {
    var name = type.replace(/^widget:/, '')
    var lists = (hostListeners[name] || []).concat(hostListeners['*'] || [])
    for (var i = 0; i < lists.length; i++) {
      try {
        lists[i](payload, name)
      } catch (err) {
        console.error('[PairAI SDK] A host listener for "' + name + '" threw:', err)
      }
    }
  }

  // Setup message listener
  function setupMessageListener() {
    window.addEventListener('message', function (event) {
      // Only process messages that look like widget messages
      if (!event.data || typeof event.data !== 'object') return
      if (typeof event.data.type !== 'string') return
      if (Object.prototype.hasOwnProperty.call(HOST_COMMANDS, event.data.type)) {
        setOpen(HOST_COMMANDS[event.data.type])
        return
      }
      if (!event.data.type.startsWith('widget:')) return

      // Every widget message reaches the host's own listeners, whether or not
      // the switch below acts on it.
      emitToHost(event.data.type, event.data.data !== undefined ? event.data.data : event.data)

      switch (event.data.type) {
        case 'widget:ready':
          console.log('[PairAI SDK] Widget is ready')
          // Inject CSS now (widget is ready, will receive color soon)
          injectCSS(null, function () {
            showBubble()
            widgetReady = true
            // What the page asked for while the widget was loading wins over
            // the design's own opening.
            if (pendingOpen !== null ? pendingOpen : config.openAutomatically) {
              toggleWidget(true)
            }
            pendingOpen = null
            syncTeaser()
          })
          // Send config to widget
          sendMessageToWidget('sdk:config', config)
          break
        case 'widget:configUpdated':
          if (event.data.config) {
            updateSdkConfig(event.data.config)
          }
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
        case 'widget:previewMessage':
          if (!isOpen) {
            showPreview(event.data)
          }
          break
        case 'widget:dismissPreview':
          hidePreview()
          break
        case 'widget:requestTokenRefresh':
          console.log('[PairAI SDK] Received widget:requestTokenRefresh from widget iframe')
          var hostSettings = window.PairAiWidgetSettings || {}
          if (typeof hostSettings.refreshFn === 'function') {
            console.log('[PairAI SDK] Executing refreshFn on host page...')
            try {
              Promise.resolve(hostSettings.refreshFn())
                .then(function (result) {
                  console.log('[PairAI SDK] hostSettings.refreshFn() resolved with:', result)
                  if (result && result.accessToken) {
                    config.accessToken = result.accessToken
                    if (result.accessTokenExpiresIn !== undefined) {
                      config.accessTokenExpiresIn = result.accessTokenExpiresIn
                    }
                    console.log('[PairAI SDK] Token refreshed successfully, sending updated config to widget:', config)
                    sendMessageToWidget('sdk:config', config)
                  } else {
                    console.warn('[PairAI SDK] refreshFn returned result without accessToken:', result)
                  }
                })
                .catch(function (err) {
                  console.error('[PairAI SDK] Error executing refreshFn on host page:', err)
                })
            } catch (err) {
              console.error('[PairAI SDK] Exception executing refreshFn on host page:', err)
            }
          } else {
            console.warn(
              '[PairAI SDK] widget:requestTokenRefresh received but hostSettings.refreshFn is not a function',
            )
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

  // The launcher icon: the studio's uploaded icon when set, else the stock glyph
  function launcherIconHtml() {
    var d = config.launcherDesign
    if (d && d.iconUrl) {
      var u = d.iconUrl
      if (u.indexOf('http') !== 0) {
        var base = (config.beBaseUrl || '').replace(/\/$/, '')
        u = base + u
      }
      var sz = d.iconSize || 26
      return (
        '<img src="' +
        u +
        '" alt="" style="width:' +
        sz +
        'px;height:' +
        sz +
        'px;object-fit:contain;pointer-events:none" />'
      )
    }
    return chatIcon
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  // The label an expanded bubble carries, or '' when it shows the icon alone.
  function launcherLabel() {
    if (config.type !== 'expanded_bubble') return ''
    var d = config.launcherDesign
    if (d && d.label && d.label.show === false) return ''
    return config.launcherTitle || ''
  }

  // What the closed launcher holds: its icon, and its label when it has one.
  function launcherContentHtml() {
    var label = launcherLabel()
    return launcherIconHtml() + (label ? '<span>' + escapeHtml(label) + '</span>' : '')
  }

  /**
   * The launcher's box. The design's size is the launcher's height; with a
   * label it grows sideways to hold the icon and the text, where a bare icon
   * stays the square it was. Forcing the square onto a labelled launcher is
   * what used to squeeze the text out over the page.
   */
  function applyLauncherGeometry() {
    if (!bubbleHolder) return
    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    var d = config.launcherDesign
    if (!bubble || !d || !d.size) return
    var span = bubble.querySelector('span')
    bubble.style.height = d.size + 'px'
    if (span && !isOpen) {
      bubble.style.width = 'auto'
      bubble.style.minWidth = d.size + 'px'
      bubble.style.maxWidth = 'calc(100vw - 40px)'
      bubble.style.paddingTop = bubble.style.paddingBottom = '0'
      bubble.style.paddingInlineStart = Math.round(d.size * 0.29) + 'px'
      bubble.style.paddingInlineEnd = Math.round(d.size * 0.36) + 'px'
      var l = d.label || {}
      if (l.color) span.style.color = l.color === '#brand' ? config.primaryColor || '' : l.color
      if (l.size) span.style.fontSize = l.size + 'px'
      if (l.weight) span.style.fontWeight = l.weight
      if (l.fontFamily) {
        span.style.fontFamily = l.fontFamily
        injectGoogleFont(l.fontFamily)
      }
    } else {
      bubble.style.width = d.size + 'px'
      bubble.style.minWidth = ''
      bubble.style.maxWidth = ''
      bubble.style.padding = '0'
    }
  }

  // ========== MESSAGE ABOVE THE LAUNCHER ==========
  // A short line the studio writes — "Need a hand?" — that sits above the
  // closed launcher and opens the chat when tapped. It goes for good once the
  // visitor opens the chat or dismisses it, and stays gone for the browser
  // session unless its copy changes.

  var teaserHolder = null
  var teaserTimer = null
  var teaserGone = false

  function teaserKey() {
    return 'pair_widget_teaser_' + (config.widgetId || '')
  }

  function teaserMessage() {
    var m = config.launcherDesign && config.launcherDesign.message
    return m && m.show && typeof m.text === 'string' && m.text.trim() ? m : null
  }

  function teaserSeen(m) {
    if (teaserGone) return true
    try {
      return sessionStorage.getItem(teaserKey()) === m.text
    } catch (e) {
      return false
    }
  }

  function teaserWanted() {
    var m = teaserMessage()
    if (!m || !widgetReady || isOpen || config.type === 'none' || teaserSeen(m)) return null
    if (previewHolder && previewHolder.classList.contains('pair-ai-preview--visible')) return null
    return m
  }

  function buildTeaser() {
    teaserHolder = document.createElement('div')
    teaserHolder.id = 'pair-ai-teaser-holder'
    teaserHolder.innerHTML =
      '<div class="pair-ai-teaser" role="button" tabindex="0">' +
      '<span class="pair-ai-teaser-text"></span>' +
      '<button type="button" class="pair-ai-teaser-close" aria-label="Dismiss">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</button>' +
      '<span class="pair-ai-teaser-tail"></span>' +
      '</div>'
    var card = teaserHolder.firstChild
    card.addEventListener('click', function () {
      toggleWidget(true)
    })
    card.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      toggleWidget(true)
    })
    teaserHolder.querySelector('.pair-ai-teaser-close').addEventListener('click', function (e) {
      e.stopPropagation()
      dismissTeaser()
    })
    window.addEventListener('resize', positionTeaser)
    document.body.appendChild(teaserHolder)
  }

  // Copy and look, straight from the design the studio compiled.
  function renderTeaser(m) {
    if (!teaserHolder) buildTeaser()
    var card = teaserHolder.firstChild
    card.querySelector('.pair-ai-teaser-text').textContent = m.text
    card.setAttribute('dir', /[\u0600-\u06FF]/.test(m.text) ? 'rtl' : 'ltr')
    card.removeAttribute('style')
    var styles = m.styles || {}
    for (var k in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, k) && styles[k] != null) card.style[k] = styles[k]
    }
    if (styles.fontFamily) injectGoogleFont(styles.fontFamily)
    card.querySelector('.pair-ai-teaser-close').style.display = m.dismissible === false ? 'none' : ''
    card.querySelector('.pair-ai-teaser-tail').style.display = m.tail === false ? 'none' : ''
  }

  // Above the launcher, on the launcher's own side, pointer over its centre.
  function positionTeaser() {
    var m = teaserMessage()
    if (!teaserHolder || !bubbleHolder || !m) return
    // The holder's box, not the bubble's: the bubble scales through its
    // entrance and hover, the holder does not.
    var r = bubbleHolder.getBoundingClientRect()
    if (!r.width) return
    var vw = document.documentElement.clientWidth || window.innerWidth
    var onRight = vw - r.right <= r.left
    teaserHolder.style.bottom = window.innerHeight - r.top + (m.gap != null ? m.gap : 12) + 'px'
    teaserHolder.style.right = onRight ? Math.max(8, vw - r.right) + 'px' : 'auto'
    teaserHolder.style.left = onRight ? 'auto' : Math.max(8, r.left) + 'px'
    var tail = teaserHolder.querySelector('.pair-ai-teaser-tail')
    var inset = Math.max(10, Math.min(r.width / 2, 28) - 6) + 'px'
    tail.style.right = onRight ? inset : 'auto'
    tail.style.left = onRight ? 'auto' : inset
  }

  // Bring the message in line with the design and the moment: draw it, move
  // it, or take it away. Safe to call whenever either may have changed.
  function syncTeaser() {
    var m = teaserWanted()
    if (!m) return hideTeaser()
    renderTeaser(m)
    if (teaserHolder.classList.contains('pair-ai-teaser--in')) return positionTeaser()
    if (teaserTimer) return
    teaserTimer = setTimeout(function () {
      teaserTimer = null
      if (!teaserWanted()) return
      teaserHolder.style.display = 'block'
      positionTeaser()
      // A frame later, so the entrance transition has a start to run from.
      setTimeout(function () {
        if (teaserWanted()) teaserHolder.classList.add('pair-ai-teaser--in')
      }, 30)
    }, m.delayMs || 0)
  }

  function hideTeaser() {
    if (teaserTimer) {
      clearTimeout(teaserTimer)
      teaserTimer = null
    }
    if (!teaserHolder) return
    teaserHolder.classList.remove('pair-ai-teaser--in')
    setTimeout(function () {
      if (teaserHolder && !teaserHolder.classList.contains('pair-ai-teaser--in')) teaserHolder.style.display = 'none'
    }, 250)
  }

  // Gone for good: the visitor opened the chat or closed the message.
  function dismissTeaser() {
    var m = teaserMessage()
    teaserGone = true
    if (m) {
      try {
        sessionStorage.setItem(teaserKey(), m.text)
      } catch (e) {
        // Private mode: it still stays away for this page.
      }
    }
    hideTeaser()
  }

  // Apply the studio launcher design to the live bubble
  function applyLauncherDesign() {
    if (!bubbleHolder) return
    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    var d = config.launcherDesign
    if (!bubble || !d) return
    if (d.radius != null) bubble.style.borderRadius = d.radius + 'px'
    var bg = d.background
    if (bg === '#brand' || bg === 'brand') bg = config.primaryColor
    if (bg) bubble.style.background = bg
    // swap the icon in place when the panel is closed
    if (!isOpen) {
      var badgeHTML = badgeElement && bubble.contains(badgeElement) ? badgeElement.outerHTML : ''
      bubble.innerHTML = launcherContentHtml() + badgeHTML
      badgeElement = bubble.querySelector('.pair-ai-bubble-badge') || badgeElement
    }
    applyLauncherGeometry()
  }

  // Update bubble color
  function updateBubbleColor(color) {
    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    if (bubble) {
      bubble.style.background = color
    }
  }

  // Apply launcher styles to the bubble (color, backgroundColor, fontSize, fontFamily, fontWeight)
  function applyBubbleStyles() {
    if (!bubbleHolder) return
    var bubble = bubbleHolder.querySelector('.pair-ai-bubble')
    if (!bubble) return

    var lStyles = config.launcherStyles || {}
    var bubbleBg = lStyles.backgroundColor || config.primaryColor
    if (bubbleBg) {
      bubble.style.background = bubbleBg
    }

    var bubbleColor = lStyles.color || 'white'
    if (bubbleColor) {
      bubble.style.color = bubbleColor
      var svgPath = bubble.querySelector('svg path')
      if (svgPath) {
        svgPath.setAttribute('fill', bubbleColor)
      }
      var span = bubble.querySelector('span')
      if (span) {
        span.style.color = bubbleColor
      }
    }

    if (lStyles.fontSize) {
      bubble.style.fontSize = lStyles.fontSize
    }
    if (lStyles.fontFamily) {
      bubble.style.fontFamily = lStyles.fontFamily
      injectGoogleFont(lStyles.fontFamily)
    }
    if (lStyles.fontWeight) {
      bubble.style.fontWeight = lStyles.fontWeight
    }
    // Every rewrite of the launcher's content ends here, so its box and its
    // label follow the design however the content just changed.
    applyLauncherGeometry()
  }

  // Inject font from Google Fonts dynamically if requested
  function injectGoogleFont(fontFamily) {
    if (!fontFamily) return
    var rawFamily = fontFamily.split(',')[0].replace(/['"]/g, '').trim()
    var fontId = 'google-font-sdk-' + rawFamily.toLowerCase().replace(/\s+/g, '-')
    if (document.getElementById(fontId)) return

    var link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(rawFamily) +
      ':wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
  }

  // Update SDK config dynamically based on widget backend settings
  function updateSdkConfig(newConfig) {
    if (!newConfig) return

    console.log('[PairAI SDK] Updating config dynamically:', newConfig)

    // Preserve existing settings if new ones are not provided
    var oldPosition = config.position
    var oldType = config.type
    var oldOpenAutomatically = config.openAutomatically

    if (newConfig.position) config.position = newConfig.position
    if (newConfig.type) config.type = newConfig.type
    if (newConfig.launcherTitle) config.launcherTitle = newConfig.launcherTitle
    if (newConfig.openAutomatically !== undefined) config.openAutomatically = newConfig.openAutomatically
    // No launcher at all: the panel opens and stays; the bubble never shows.
    if (config.type === 'none') config.openAutomatically = true
    // The page asked to open the panel itself, so nothing opens it for it.
    if (config.startClosed) config.openAutomatically = false
    if (newConfig.primaryColor) config.primaryColor = newConfig.primaryColor
    if (newConfig.launcherStyles) config.launcherStyles = newConfig.launcherStyles
    if (newConfig.launcherDesign) {
      config.launcherDesign = newConfig.launcherDesign
      applyLauncherDesign()
    }
    if (newConfig.toastDesign) config.toastDesign = newConfig.toastDesign
    if (newConfig.showFooter !== undefined) config.showFooter = newConfig.showFooter
    if (newConfig.welcome_title_var !== undefined) config.welcome_title_var = newConfig.welcome_title_var
    // The studio's saved panel size wins over whatever the pasted snippet froze.
    if (newConfig.panel) {
      config.panel = newConfig.panel
      applyPanelSize(widgetHolder)
    }

    // 1. Update position classes on holders
    if (config.position !== oldPosition) {
      if (bubbleHolder) {
        bubbleHolder.style.left = config.position === 'left' ? '20px' : ''
        bubbleHolder.style.right = config.position === 'right' ? '20px' : ''
      }
      if (widgetHolder) {
        widgetHolder.className = widgetHolder.className
          .replace('pair-ai-position-left', '')
          .replace('pair-ai-position-right', '')
        widgetHolder.classList.add('pair-ai-position-' + config.position)
      }
    }

    // 2. Update automatic open behavior
    if (config.openAutomatically !== oldOpenAutomatically) {
      if (config.openAutomatically) {
        if (bubbleHolder) bubbleHolder.style.display = 'none'
        if (widgetHolder) {
          if (!widgetHolder.classList.contains('pair-ai-widget-holder--auto-open')) {
            widgetHolder.classList.add('pair-ai-widget-holder--auto-open')
          }
        }
        toggleWidget(true)
      } else {
        if (bubbleHolder) bubbleHolder.style.display = ''
        if (widgetHolder) {
          widgetHolder.classList.remove('pair-ai-widget-holder--auto-open')
        }
      }
    }

    // No launcher never shows a bubble, whether or not the panel opens by itself.
    if (config.type === 'none' && bubbleHolder) bubbleHolder.style.display = 'none'

    // 3. Update bubble elements and classes
    var bubble = bubbleHolder ? bubbleHolder.querySelector('.pair-ai-bubble') : null
    if (bubble) {
      // Apply style variant
      if (config.type === 'expanded_bubble') {
        if (!bubble.classList.contains('pair-ai-bubble--expanded')) {
          bubble.classList.add('pair-ai-bubble--expanded')
        }
      } else {
        bubble.classList.remove('pair-ai-bubble--expanded')
      }

      // Update bubble content (preserve badge, handle expanded text)
      var existingBadge = bubble.querySelector('.pair-ai-bubble-badge')
      var badgeHTML = existingBadge ? existingBadge.outerHTML : ''
      if (isOpen) {
        bubble.innerHTML = closeIcon + badgeHTML
      } else {
        bubble.innerHTML = launcherContentHtml() + badgeHTML
      }
      badgeElement = bubble.querySelector('.pair-ai-bubble-badge')

      // Apply styles
      applyBubbleStyles()
    }

    // The message above the launcher follows the design and the language.
    syncTeaser()
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
      transport: settings.transport || options.transport,
      position: settings.position || 'right',
      type: settings.type || 'standard',
      launcherTitle: settings.launcherTitle || 'Chat with us!',
      panel: settings.panel || options.panel,
      user: options.user,
      openAutomatically: settings.openAutomatically || options.openAutomatically || false,
      // The panel never opens by itself; the page opens it with open() / pair:open.
      startClosed: !!(settings.startClosed || options.startClosed),
      userId: settings.userId || options.userId || null,
      accessToken: settings.accessToken,
      accessTokenExpiresIn: settings.accessTokenExpiresIn,
      metadata: settings.metadata,
      welcome_title_var: settings.welcome_title_var || options.welcome_title_var,
    }

    // A 'none' launcher means the panel opens by itself and there is no bubble.
    if (config.type === 'none') config.openAutomatically = true
    if (config.startClosed) config.openAutomatically = false

    console.log('[PairAI SDK] Initializing with config:', config)

    // Setup
    // Don't inject CSS yet - wait for color from widget to avoid blue flash
    setupMessageListener()
    createBubble()
    createWidgetHolder()
    createPreviewHolder()

    widgetLoaded = true

    // Set user if provided
    if (config.user) {
      setTimeout(function () {
        setUser(config.user)
      }, 1000)
    }
  }

  // ========== EMBEDDED FORM ==========

  /**
   * Render a feedback form inside a host-provided container.
   *
   * @param {Object} options
   * @param {string} options.formId - The feedback form ULID (required)
   * @param {string} options.containerId - The ID of the host container element (required)
   * @param {string} [options.baseUrl] - Widget base URL
   * @param {Object} [options.styles] - Style overrides for the form
   */
  function renderForm(options) {
    if (!options || !options.formId) {
      console.error('[PairAI SDK] formId is required for renderForm')
      return
    }
    if (!options.containerId) {
      console.error('[PairAI SDK] containerId is required for renderForm')
      return
    }

    var container = document.getElementById(options.containerId)
    if (!container) {
      console.error('[PairAI SDK] Container element not found: #' + options.containerId)
      return
    }

    var baseUrl = options.baseUrl || config.baseUrl || 'https://pair-ai-widget-69d50.web.app'
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '')

    // Build form URL with parameters
    var params = []
    params.push('formId=' + encodeURIComponent(options.formId))

    // Pass style overrides as URL params
    var styleKeys = [
      'backgroundColor',
      'primaryColor',
      'fontFamily',
      'borderRadius',
      'inputBackgroundColor',
      'inputBorderColor',
      'inputTextColor',
      'labelColor',
      'submitButtonText',
      'submitButtonColor',
      'submitButtonTextColor',
    ]
    if (options.styles) {
      for (var i = 0; i < styleKeys.length; i++) {
        var key = styleKeys[i]
        if (options.styles[key]) {
          params.push(key + '=' + encodeURIComponent(options.styles[key]))
        }
      }
    }

    // Pass beBaseUrl if available
    var settings = window.PairAiWidgetSettings || {}
    if (settings.beBaseUrl) {
      params.push('beBaseUrl=' + encodeURIComponent(settings.beBaseUrl))
    }

    var formUrl = baseUrl + '/form?' + params.join('&')

    // Create iframe
    var iframe = document.createElement('iframe')
    iframe.id = 'pair-ai-form-iframe-' + options.containerId
    iframe.className = 'pair-ai-form-iframe'
    iframe.src = formUrl
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('allowtransparency', 'true')
    // Inline styles — fills container completely
    iframe.style.width = '100%'
    iframe.style.height = container.offsetHeight + 'px' // iframes ignore height:100%, use actual px
    iframe.style.border = 'none'
    iframe.style.display = 'block'
    iframe.style.overflow = 'auto'

    // Clear container and insert iframe
    container.innerHTML = ''
    container.classList.add('pair-ai-form-container')
    container.style.position = 'relative'
    container.style.width = '100%'
    // container.style.height = '100%'
    container.style.overflow = 'auto'
    container.appendChild(iframe)

    // Debug: log container and iframe dimensions
    console.log('[PairAI SDK] Form container #' + options.containerId + ' dimensions:', {
      containerOffsetWidth: container.offsetWidth,
      containerOffsetHeight: container.offsetHeight,
      containerClientWidth: container.clientWidth,
      containerClientHeight: container.clientHeight,
      containerStyleHeight: container.style.height,
      containerComputedHeight: window.getComputedStyle(container).height,
      containerComputedMinHeight: window.getComputedStyle(container).minHeight,
      parentElement: container.parentElement ? container.parentElement.tagName : 'none',
      parentHeight: container.parentElement ? window.getComputedStyle(container.parentElement).height : 'N/A',
    })

    // Debug: log iframe dimensions after load
    iframe.addEventListener('load', function () {
      console.log('[PairAI SDK] Form iframe loaded, dimensions:', {
        iframeOffsetWidth: iframe.offsetWidth,
        iframeOffsetHeight: iframe.offsetHeight,
        iframeClientWidth: iframe.clientWidth,
        iframeClientHeight: iframe.clientHeight,
        iframeStyleHeight: iframe.style.height,
        iframeComputedHeight: window.getComputedStyle(iframe).height,
      })
    })

    // Listen for resize messages from the form iframe
    var containerHeight = container.offsetHeight
    window.addEventListener('message', function (event) {
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.type === 'form:resize' && event.data.height) {
        // Never shrink below container height
        var newHeight = Math.max(event.data.height, containerHeight)
        console.log('[PairAI SDK] Form resize message received:', {
          requestedHeight: event.data.height,
          containerHeight: containerHeight,
          resolvedHeight: newHeight,
          currentIframeHeight: iframe.offsetHeight,
        })
        iframe.style.height = newHeight + 'px'
        console.log('[PairAI SDK] Iframe height set to:', iframe.style.height)
      }
      if (event.data.type === 'form:submitted') {
        console.log('[PairAI SDK] Form submitted successfully')
        if (options.onSubmitted && typeof options.onSubmitted === 'function') {
          options.onSubmitted(event.data)
        }
      }
    })

    console.log('[PairAI SDK] Form rendered in #' + options.containerId)
    return iframe
  }

  // Update metadata dynamically
  function updateMetadata(newMetadata) {
    if (!newMetadata || typeof newMetadata !== 'object') {
      console.warn('[PairAI SDK] updateMetadata requires an object parameter')
      return
    }

    console.log('[PairAI SDK] Updating metadata:', newMetadata)

    // Update internal config metadata
    config.metadata = Object.assign({}, config.metadata || {}, newMetadata)

    // Update global settings metadata if present on host page
    if (window.PairAiWidgetSettings) {
      window.PairAiWidgetSettings.metadata = Object.assign({}, window.PairAiWidgetSettings.metadata || {}, newMetadata)
    }

    // Send metadata:update postMessage to widget iframe
    sendMessageToWidget('metadata:update', newMetadata)
  }

  var LANGS = { en: 1, ar: 1 }
  var THEMES = { light: 1, dark: 1 }

  /**
   * Switch the widget's language and/or theme at runtime.
   *
   * The widget re-fetches its config from the matching `/pv/<lang>/<theme>`
   * base, so the whole design follows — no page reload, and the same path the
   * visitor's own header controls take.
   */
  function setView(next) {
    next = next || {}
    var view = {}
    if (next.lang) {
      if (!LANGS[next.lang]) return console.warn('[PairAI SDK] setView: unknown language "' + next.lang + '"')
      view.lang = next.lang
    }
    if (next.theme) {
      if (!THEMES[next.theme]) return console.warn('[PairAI SDK] setView: unknown theme "' + next.theme + '"')
      view.theme = next.theme
    }
    sendMessageToWidget('sdk:setView', view)
  }

  function setLanguage(lang) {
    if (!LANGS[lang]) return console.warn('[PairAI SDK] setLanguage: expected "en" or "ar", got "' + lang + '"')
    sendMessageToWidget('sdk:setLanguage', { lang: lang })
  }

  function setTheme(theme) {
    if (!THEMES[theme]) return console.warn('[PairAI SDK] setTheme: expected "light" or "dark", got "' + theme + '"')
    sendMessageToWidget('sdk:setTheme', { theme: theme })
  }

  /** Ask the widget where things stand; the answer arrives as the `state` event. */
  function getState() {
    sendMessageToWidget('sdk:getState')
  }

  /**
   * Send any message to the widget yourself, for anything this API does not
   * cover. The widget receives `{ type, data }`, exactly as with the calls above.
   */
  function send(type, data) {
    if (typeof type !== 'string' || !type) {
      return console.warn('[PairAI SDK] send() needs a message type')
    }
    sendMessageToWidget(type, data)
  }

  /** Subscribe to what the widget sends back. `'*'` receives every message. */
  function on(event, handler) {
    if (typeof handler !== 'function') return function () {}
    var name = String(event || '*').replace(/^widget:/, '')
    if (!hostListeners[name]) hostListeners[name] = []
    hostListeners[name].push(handler)
    return function () {
      off(name, handler)
    }
  }

  function off(event, handler) {
    var name = String(event || '*').replace(/^widget:/, '')
    var list = hostListeners[name]
    if (!list) return
    var i = list.indexOf(handler)
    if (i !== -1) list.splice(i, 1)
  }

  // Public API
  window.PairAiWidgetSDK = {
    run: init,
    renderForm: renderForm,
    updateMetadata: updateMetadata,
    setView: setView,
    setLanguage: setLanguage,
    setTheme: setTheme,
    getState: getState,
    send: send,
    on: on,
    off: off,
    toggle: function (show) {
      setOpen(show)
    },
    open: function () {
      setOpen(true)
    },
    close: function () {
      setOpen(false)
    },
    // The older names for open() and close().
    show: function () {
      setOpen(true)
    },
    hide: function () {
      setOpen(false)
    },
    setUser: setUser,
    isOpen: function () {
      return isOpen
    },
  }

  // Backward compatibility, plus a short name for host pages.
  window.widgetSDK = window.PairAiWidgetSDK
  window.PairWidget = window.PairAiWidgetSDK

  console.log('[PairAI SDK] SDK loaded successfully')
})(window, document)
