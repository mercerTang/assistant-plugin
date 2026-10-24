/**
 * AssistantPlugin —— 可嵌入任意页面的小助手浮窗插件。
 *
 * 能力：
 *  - 悬浮图标（可自定义图片 / 内联 SVG / 大小），可拖动
 *  - 点击图标打开 iframe 面板，关闭后图标回到原位置
 *  - 面板八个方向可拖拽缩放（四边 + 四角），带最小尺寸限制
 *  - 位置 / 尺寸 / 开关状态可记忆（localStorage）
 *  - Shadow DOM 隔离样式，不会被宿主页面的 CSS 影响，也不污染宿主
 *
 * 用法：
 *   <script src="assistant-plugin.js"></script>
 *   <script>
 *     AssistantPlugin.init({
 *       iframeUrl: 'https://agent.example.com',
 *       iconUrl: '/icon.png',
 *       iconSize: 56,
 *       width: 420,
 *       height: 640
 *     })
 *   </script>
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    global.AssistantPlugin = factory()
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict'

  var DEFAULTS = {
    iframeUrl: '',
    iconUrl: '',
    iconHtml: '',
    iconSize: 56,
    iconAlt: '打开小助手',
    title: '小助手',
    header: false,
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 420,
    position: 'bottom-right',
    offset: 24,
    zIndex: 2147483000,
    remember: true,
    storageKey: 'assistant-plugin',
    lazy: true,
    sandbox: '',
    onOpen: null,
    onClose: null
  }

  var STYLE = `
    :host { all: initial; }
    .ap-icon {
      position: fixed;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      padding: 0;
      border-radius: 50%;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.28);
      touch-action: none;
      user-select: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      overflow: hidden;
    }
    .ap-icon[hidden] { display: none; }
    .ap-icon:hover { transform: scale(1.05); box-shadow: 0 14px 34px rgba(15, 23, 42, 0.34); }
    .ap-icon:focus-visible { outline: 3px solid rgba(37, 99, 235, 0.45); outline-offset: 2px; }
    .ap-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ap-icon svg { width: 62%; height: 62%; display: block; }

    .ap-panel {
      box-sizing: border-box;
      position: fixed;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35);
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
    }
    .ap-panel[hidden] { display: none; }

    .ap-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      background: #f8fafc;
      flex: none;
      cursor: grab;
      user-select: none;
    }
    .ap-dragging .ap-head { cursor: grabbing; }
    .ap-dragging { user-select: none; }
    .ap-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ap-close {
      border: 0;
      background: transparent;
      color: #475569;
      font-size: 18px;
      line-height: 1;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ap-close:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; }

    .ap-max {
      border: 0;
      background: transparent;
      color: #475569;
      font-size: 15px;
      line-height: 1;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
    }
    .ap-max:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; }
    .ap-panel.is-max .ap-handle { display: none; }

    /* header: false：隐藏标题条，保留右上角浮动按钮 */
    .ap-panel.no-header .ap-head {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 4;
      padding: 0;
      gap: 6px;
      border: 0;
      background: transparent;
    }
    .ap-panel.no-header .ap-title { display: none; }
    .ap-panel.no-header .ap-close,
    .ap-panel.no-header .ap-max {
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 50%;
    }
    .ap-drag-strip {
      position: absolute;
      top: 8px;
      left: 14px;
      right: 14px;
      height: 10px;
      z-index: 3;
      cursor: grab;
      background: transparent;
    }
    .ap-dragging .ap-drag-strip { cursor: grabbing; }
    .ap-drag-strip::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 3px;
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: rgba(15, 23, 42, 0.18);
      transform: translateX(-50%);
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .ap-panel:hover .ap-drag-strip::after { opacity: 1; }

    .ap-body { position: relative; flex: 1; min-height: 0; }
    .ap-body iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #fff;
    }

    .ap-handle {
      position: absolute;
      z-index: 4;
      touch-action: none;
    }
    .ap-handle[data-dir="n"]  { top: 0; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
    .ap-handle[data-dir="s"]  { bottom: 0; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
    .ap-handle[data-dir="w"]  { left: 0; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
    .ap-handle[data-dir="e"]  { right: 0; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
    .ap-handle[data-dir="nw"] { left: 0; top: 0; width: 14px; height: 14px; cursor: nwse-resize; }
    .ap-handle[data-dir="ne"] { right: 0; top: 0; width: 14px; height: 14px; cursor: nesw-resize; }
    .ap-handle[data-dir="sw"] { left: 0; bottom: 0; width: 14px; height: 14px; cursor: nesw-resize; }
    .ap-handle[data-dir="se"] { right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
    .ap-handle:hover { background: rgba(37, 99, 235, 0.12); }

    .ap-resizing .ap-body iframe { pointer-events: none; }
  `

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  function readStorage(key) {
    try {
      var raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch (error) {
      return null
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      /* 隐私模式下写不进去，忽略即可 */
    }
  }

  function create(options) {
    var config = Object.assign({}, DEFAULTS, options || {})
    if (!config.iframeUrl) {
      throw new Error('[AssistantPlugin] iframeUrl 不能为空')
    }

    var host = document.createElement('div')
    host.setAttribute('data-assistant-plugin', '')
    host.style.position = 'fixed'
    host.style.left = '0'
    host.style.top = '0'
    host.style.width = '0'
    host.style.height = '0'
    host.style.zIndex = String(config.zIndex)
    document.body.appendChild(host)
    var shadow = host.attachShadow({ mode: 'open' })

    var style = document.createElement('style')
    style.textContent = STYLE
    shadow.appendChild(style)

    // ---- 图标 ----
    var icon = document.createElement('button')
    icon.className = 'ap-icon'
    icon.type = 'button'
    icon.setAttribute('aria-label', config.iconAlt || config.title)
    icon.title = config.iconAlt || config.title
    icon.style.width = config.iconSize + 'px'
    icon.style.height = config.iconSize + 'px'
    if (config.iconHtml) {
      icon.innerHTML = config.iconHtml
    } else if (config.iconUrl) {
      var img = document.createElement('img')
      img.src = config.iconUrl
      img.alt = ''
      img.draggable = false
      icon.appendChild(img)
    } else {
      icon.textContent = '💬'
      icon.style.fontSize = Math.round(config.iconSize * 0.46) + 'px'
    }
    shadow.appendChild(icon)

    // ---- 面板 ----
    var panel = document.createElement('div')
    panel.className = 'ap-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', config.title)
    panel.hidden = true
    panel.style.width = config.width + 'px'
    panel.style.height = config.height + 'px'

    var head = document.createElement('div')
    head.className = 'ap-head'
    var title = document.createElement('span')
    title.className = 'ap-title'
    title.textContent = config.title
    var closeButton = document.createElement('button')
    closeButton.className = 'ap-close'
    closeButton.type = 'button'
    closeButton.setAttribute('aria-label', '关闭')
    closeButton.textContent = '×'

    var maxButton = document.createElement('button')
    maxButton.className = 'ap-max'
    maxButton.type = 'button'
    maxButton.setAttribute('aria-label', '放大')
    maxButton.title = '放大 / 还原'
    maxButton.textContent = '⤢'

    head.appendChild(maxButton)
    head.appendChild(closeButton)

    // header: false 时不显示标题条，只保留右上角浮动按钮 + 顶部拖拽细条
    var showHeader = config.header !== false
    var dragArea = head
    if (!showHeader) {
      head.classList.add('is-floating')
      panel.classList.add('no-header')
      var dragStrip = document.createElement('div')
      dragStrip.className = 'ap-drag-strip'
      dragStrip.title = '拖动移动面板'
      panel.appendChild(dragStrip)
      dragArea = dragStrip
    } else {
      head.insertBefore(title, maxButton)
    }

    // ---- 放大 / 还原 ----
    var maximized = false
    var restoreRect = null

    function applyMaximized() {
      var margin = 16
      state.panelX = margin
      state.panelY = margin
      state.width = window.innerWidth - margin * 2
      state.height = window.innerHeight - margin * 2
      panel.classList.add('is-max')
      applyPanelRect()
    }

    function toggleMaximize() {
      if (!state.open) {
        open()
      }
      if (maximized) {
        maximized = false
        panel.classList.remove('is-max')
        if (restoreRect) {
          state.panelX = restoreRect.x
          state.panelY = restoreRect.y
          state.width = restoreRect.w
          state.height = restoreRect.h
        }
        maxButton.textContent = '⤢'
        maxButton.setAttribute('aria-label', '放大')
        applyPanelRect()
        persist()
        return
      }
      restoreRect = {
        x: state.panelX,
        y: state.panelY,
        w: state.width,
        h: state.height
      }
      maximized = true
      maxButton.textContent = '⤡'
      maxButton.setAttribute('aria-label', '还原')
      applyMaximized()
    }

    maxButton.addEventListener('click', toggleMaximize)
    dragArea.addEventListener('dblclick', function (event) {
      if (!event.target.closest('.ap-close') && !event.target.closest('.ap-max')) {
        toggleMaximize()
      }
    })

    var body = document.createElement('div')
    body.className = 'ap-body'
    var iframe = document.createElement('iframe')
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write; microphone; camera')
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
    if (config.sandbox) {
      iframe.setAttribute('sandbox', config.sandbox)
    }
    if (config.lazy) {
      iframe.setAttribute('data-src', config.iframeUrl)
    } else {
      iframe.src = config.iframeUrl
    }
    body.appendChild(iframe)

    panel.appendChild(head)
    panel.appendChild(body)

    var DIRECTIONS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
    DIRECTIONS.forEach(function (dir) {
      var handle = document.createElement('div')
      handle.className = 'ap-handle'
      handle.setAttribute('data-dir', dir)
      panel.appendChild(handle)
    })
    shadow.appendChild(panel)

    // ---- 位置与尺寸 ----
    var saved = config.remember ? readStorage(config.storageKey) : null
    var state = {
      x: saved && typeof saved.x === 'number' ? saved.x : null,
      y: saved && typeof saved.y === 'number' ? saved.y : null,
      panelX: saved && typeof saved.panelX === 'number' ? saved.panelX : null,
      panelY: saved && typeof saved.panelY === 'number' ? saved.panelY : null,
      width: saved && typeof saved.width === 'number'
        ? saved.width
        : Math.min(config.width, window.innerWidth - 16),
      height: saved && typeof saved.height === 'number'
        ? saved.height
        : Math.min(config.height, window.innerHeight - 16),
      open: !!(saved && saved.open)
    }

    function defaultPosition() {
      var gap = config.offset
      if (config.position === 'bottom-left') {
        return { x: gap, y: window.innerHeight - config.iconSize - gap }
      }
      if (config.position === 'top-right') {
        return { x: window.innerWidth - config.iconSize - gap, y: gap }
      }
      if (config.position === 'top-left') {
        return { x: gap, y: gap }
      }
      return { x: window.innerWidth - config.iconSize - gap, y: window.innerHeight - config.iconSize - gap }
    }

    function ensureWithinViewport() {
      if (state.x === null || state.y === null) {
        var pos = defaultPosition()
        state.x = pos.x
        state.y = pos.y
      }
      state.x = clamp(state.x, 0, Math.max(0, window.innerWidth - config.iconSize))
      state.y = clamp(state.y, 0, Math.max(0, window.innerHeight - config.iconSize))
    }

    function applyIconPosition() {
      icon.style.left = Math.round(state.x) + 'px'
      icon.style.top = Math.round(state.y) + 'px'
    }

    function effectiveMinWidth() {
      return Math.min(config.minWidth, Math.max(220, window.innerWidth - 16))
    }

    function effectiveMinHeight() {
      return Math.min(config.minHeight, Math.max(240, window.innerHeight - 16))
    }

    function applyPanelRect() {
      var w = clamp(state.width, effectiveMinWidth(), window.innerWidth)
      var h = clamp(state.height, effectiveMinHeight(), window.innerHeight)
      state.width = w
      state.height = h
      // 首次打开贴着图标；拖动过面板后按记忆的位置恢复
      var left = state.panelX
      var top = state.panelY
      if (left === null || top === null) {
        left = state.x
        top = state.y
        if (left + w > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - w - 8)
        }
        if (top + h > window.innerHeight - 8) {
          top = Math.max(8, window.innerHeight - h - 8)
        }
      }
      left = clamp(left, 0, Math.max(0, window.innerWidth - w))
      top = clamp(top, 0, Math.max(0, window.innerHeight - h))
      state.panelX = left
      state.panelY = top
      panel.style.left = Math.round(left) + 'px'
      panel.style.top = Math.round(top) + 'px'
      panel.style.width = Math.round(w) + 'px'
      panel.style.height = Math.round(h) + 'px'
    }

    function persist() {
      if (!config.remember) {
        return
      }
      writeStorage(config.storageKey, {
        x: Math.round(state.x),
        y: Math.round(state.y),
        panelX: state.panelX === null ? null : Math.round(state.panelX),
        panelY: state.panelY === null ? null : Math.round(state.panelY),
        width: Math.round(state.width),
        height: Math.round(state.height),
        open: state.open
      })
    }

    // ---- 打开 / 关闭 ----
    function open() {
      if (state.open) {
        return
      }
      if (config.lazy && !iframe.getAttribute('src')) {
        iframe.src = iframe.getAttribute('data-src') || config.iframeUrl
      }
      state.open = true
      icon.hidden = true
      panel.hidden = false
      if (maximized) {
        applyMaximized()
      } else {
        applyPanelRect()
      }
      persist()
      if (typeof config.onOpen === 'function') {
        config.onOpen()
      }
    }

    function close() {
      if (!state.open) {
        return
      }
      state.open = false
      panel.hidden = true
      icon.hidden = false
      persist()
      if (typeof config.onClose === 'function') {
        config.onClose()
      }
    }

    closeButton.addEventListener('click', close)
    icon.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.open) {
        close()
      }
    })

    // ---- 图标拖动 ----
    var drag = null
    icon.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) {
        return
      }
      icon.setPointerCapture(event.pointerId)
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
        moved: false
      }
    })

    icon.addEventListener('pointermove', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) {
        return
      }
      var dx = event.clientX - drag.startX
      var dy = event.clientY - drag.startY
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) {
        drag.moved = true
      }
      if (drag.moved) {
        state.x = clamp(drag.originX + dx, 0, Math.max(0, window.innerWidth - config.iconSize))
        state.y = clamp(drag.originY + dy, 0, Math.max(0, window.innerHeight - config.iconSize))
        applyIconPosition()
      }
    })

    icon.addEventListener('pointerup', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) {
        return
      }
      var wasDrag = drag.moved
      drag = null
      if (wasDrag) {
        persist()
      } else {
        open()
      }
    })

    icon.addEventListener('pointercancel', function () {
      drag = null
    })

    // ---- 面板缩放 ----
    var resize = null
    panel.addEventListener('pointerdown', function (event) {
      var handle = event.target.closest('.ap-handle')
      if (!handle || maximized) {
        return
      }
      event.preventDefault()
      var dir = handle.getAttribute('data-dir')
      var rect = panel.getBoundingClientRect()
      handle.setPointerCapture(event.pointerId)
      resize = {
        pointerId: event.pointerId,
        dir: dir,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
      panel.classList.add('ap-resizing')
    })

    panel.addEventListener('pointermove', function (event) {
      if (!resize || resize.pointerId !== event.pointerId) {
        return
      }
      var dx = event.clientX - resize.startX
      var dy = event.clientY - resize.startY
      var dir = resize.dir
      var left = resize.left
      var top = resize.top
      var width = resize.width
      var height = resize.height

      if (dir.indexOf('e') >= 0) {
        width = clamp(resize.width + dx, effectiveMinWidth(), window.innerWidth - left - 8)
      }
      if (dir.indexOf('s') >= 0) {
        height = clamp(resize.height + dy, effectiveMinHeight(), window.innerHeight - top - 8)
      }
      if (dir.indexOf('w') >= 0) {
        var nextWidth = clamp(resize.width - dx, effectiveMinWidth(), resize.left + resize.width - 8)
        left = resize.left + resize.width - nextWidth
        width = nextWidth
      }
      if (dir.indexOf('n') >= 0) {
        var nextHeight = clamp(resize.height - dy, effectiveMinHeight(), resize.top + resize.height - 8)
        top = resize.top + resize.height - nextHeight
        height = nextHeight
      }

      state.width = width
      state.height = height
      state.panelX = left
      state.panelY = top
      panel.style.left = Math.round(left) + 'px'
      panel.style.top = Math.round(top) + 'px'
      panel.style.width = Math.round(width) + 'px'
      panel.style.height = Math.round(height) + 'px'
    })

    function endResize(event) {
      if (!resize || (event && resize.pointerId !== event.pointerId)) {
        return
      }
      resize = null
      panel.classList.remove('ap-resizing')
      persist()
    }

    panel.addEventListener('pointerup', endResize)
    panel.addEventListener('pointercancel', endResize)

    // ---- 面板拖动（拖标题栏移动整个面板） ----
    var panelDrag = null
    dragArea.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || maximized || event.target.closest('.ap-close') || event.target.closest('.ap-max')) {
        return
      }
      event.preventDefault()
      var rect = panel.getBoundingClientRect()
      dragArea.setPointerCapture(event.pointerId)
      panelDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      }
      panel.classList.add('ap-dragging')
    })

    dragArea.addEventListener('pointermove', function (event) {
      if (!panelDrag || panelDrag.pointerId !== event.pointerId) {
        return
      }
      var left = clamp(
        panelDrag.left + (event.clientX - panelDrag.startX),
        0,
        Math.max(0, window.innerWidth - state.width)
      )
      var top = clamp(
        panelDrag.top + (event.clientY - panelDrag.startY),
        0,
        Math.max(0, window.innerHeight - state.height)
      )
      state.panelX = left
      state.panelY = top
      panel.style.left = Math.round(left) + 'px'
      panel.style.top = Math.round(top) + 'px'
    })

    function endPanelDrag(event) {
      if (!panelDrag || (event && panelDrag.pointerId !== event.pointerId)) {
        return
      }
      panelDrag = null
      panel.classList.remove('ap-dragging')
      persist()
    }

    dragArea.addEventListener('pointerup', endPanelDrag)
    dragArea.addEventListener('pointercancel', endPanelDrag)

    // ---- 窗口尺寸变化 ----
    function onWindowResize() {
      ensureWithinViewport()
      applyIconPosition()
      if (state.open) {
        if (maximized) {
          applyMaximized()
        } else {
          applyPanelRect()
        }
      }
    }
    window.addEventListener('resize', onWindowResize)

    // ---- 初始化 ----
    ensureWithinViewport()
    applyIconPosition()
    if (state.open) {
      state.open = false
      open()
    }

    var api = {
      open: open,
      close: close,
      toggle: function () {
        state.open ? close() : open()
      },
      toggleMaximize: toggleMaximize,
      isMaximized: function () {
        return maximized
      },
      isOpen: function () {
        return state.open
      },
      setIcon: function (next) {
        icon.innerHTML = ''
        if (next.iconUrl) {
          var nextImg = document.createElement('img')
          nextImg.src = next.iconUrl
          nextImg.alt = ''
          nextImg.draggable = false
          icon.appendChild(nextImg)
        } else if (next.iconHtml) {
          icon.innerHTML = next.iconHtml
        }
      },
      setSize: function (size) {
        if (size && typeof size === 'number') {
          config.iconSize = size
          icon.style.width = size + 'px'
          icon.style.height = size + 'px'
        }
      },
      destroy: function () {
        window.removeEventListener('resize', onWindowResize)
        if (host.parentNode) {
          host.parentNode.removeChild(host)
        }
      }
    }

    return api
  }

  return {
    init: function (options) {
      return create(options)
    },
    version: '0.1.0'
  }
})
