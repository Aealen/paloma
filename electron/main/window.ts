import path from 'node:path'
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { debounce } from './util'
import { broadcast } from './events'

// 窗口 UI 形态的唯一权威：五种形态的尺寸、锚定（当前窗口中心）、
// 工作区钳制、边缘吸附全部在主进程用 DIP 逻辑坐标完成
// （Electron 的 Bounds/WorkArea 语义一致，无 Wails 时代的 DPI 混用问题）。
export type UiMode = 'compact' | 'panel' | 'notification' | 'dock-left' | 'dock-right'

const SIZES: Record<UiMode, { w: number; h: number }> = {
  compact: { w: 144, h: 104 },
  panel: { w: 420, h: 570 },
  notification: { w: 350, h: 112 },
  'dock-left': { w: 140, h: 320 },
  'dock-right': { w: 140, h: 320 },
}
const EDGE_PADDING = 10
const SNAP_MARGIN = 96
const TAP_THRESHOLD = 5

export let currentMode: UiMode = 'compact'
let win: BrowserWindow | null = null
let quitting = false
// 程序化 setBounds 也会触发 move，用标志跳过，避免与拖动结算互相干扰。
let programmaticMove = false

/** 拖动会话：主进程按光标轮询移动窗口（零 IPC 延迟，绝对跟手）。 */
type DragSession = {
  grabOffsetX: number
  grabOffsetY: number
  originX: number
  originY: number
  poll: NodeJS.Timeout
  ticks: number
}
let drag: DragSession | null = null

export function getMainWindow(): BrowserWindow | null {
  return win
}

export function createMainWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: SIZES.compact.w,
    height: SIZES.compact.h,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      // preload 为 ESM（.mjs），必须关闭 sandbox；渲染进程仍保持 contextIsolation。
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // screen-saver 级置顶，盖住绝大多数应用窗口。
  win.setAlwaysOnTop(true, 'screen-saver')

  win.on('ready-to-show', () => win?.show())
  win.on('close', (event) => {
    // 关窗即隐藏到托盘，真正退出走托盘菜单。
    if (!quitting) {
      event.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => {
    win = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  // 诊断：renderer console 与 preload 注入状态转发到主进程 stdout。
  win.webContents.on('console-message', (_event, _level, message) => {
    console.log('[renderer]', message)
  })
  win.webContents.once('did-finish-load', () => {
    void win?.webContents.executeJavaScript('String(typeof window.paloma)').then(
      (v) => console.log('[win] window.paloma =', v),
      (err) => console.error('[win] probe failed', err),
    )
  })
  return win
}

export function markQuitting(): void {
  quitting = true
}

function centerOf(bounds: Rectangle): { x: number; y: number } {
  return { x: bounds.x + Math.round(bounds.width / 2), y: bounds.y + Math.round(bounds.height / 2) }
}

/** applyMode 把窗口切到目标形态：中心锚定（dock 贴边除外）+ 工作区钳制。 */
export function applyMode(mode: UiMode): UiMode {
  currentMode = mode
  if (!win) return mode
  const { w, h } = SIZES[mode]
  const center = centerOf(win.getBounds())
  const workArea = screen.getDisplayNearestPoint(center).workArea

  let x: number
  let y: number
  if (mode === 'dock-left') {
    x = workArea.x + EDGE_PADDING
    y = workArea.y + Math.round((workArea.height - h) / 2)
  } else if (mode === 'dock-right') {
    x = workArea.x + workArea.width - w - EDGE_PADDING
    y = workArea.y + Math.round((workArea.height - h) / 2)
  } else {
    x = center.x - Math.round(w / 2)
    y = center.y - Math.round(h / 2)
    x = Math.max(workArea.x + EDGE_PADDING, Math.min(x, workArea.x + workArea.width - w - EDGE_PADDING))
    y = Math.max(workArea.y + EDGE_PADDING, Math.min(y, workArea.y + workArea.height - h - EDGE_PADDING))
  }

  // 程序化移动不应触发拖动结算。
  programmaticMove = true
  console.log('[win] applyMode', mode, '->', { x, y, w, h })
  win.setBounds({ x, y, width: w, height: h })
  console.log('[win] setBounds done, actual:', JSON.stringify(win.getBounds()))
  broadcast('mode:changed', mode)
  return mode
}

/** TogglePanel 展开/收起面板，返回最终形态。 */
export function togglePanel(): UiMode {
  console.log('[win] togglePanel from', currentMode)
  const next = applyMode(currentMode === 'panel' ? 'compact' : 'panel')
  console.log('[win] togglePanel ->', next)
  return next
}

/**
 * 拖动结束的统一结算：中心距工作区左右缘 ≤ SNAP_MARGIN 吸附状态条，
 * 已停靠的窗口拖离边缘则恢复小球。
 */
function settleAfterDrag(): UiMode | null {
  if (!win) return null
  const center = centerOf(win.getBounds())
  const workArea = screen.getDisplayNearestPoint(center).workArea
  if (center.x - workArea.x <= SNAP_MARGIN) return applyMode('dock-left')
  if (workArea.x + workArea.width - center.x <= SNAP_MARGIN) return applyMode('dock-right')
  if (currentMode === 'dock-left' || currentMode === 'dock-right') return applyMode('compact')
  return null
}

/** 主进程按光标轮询移动窗口：每次 tick 直接 setPosition，无渲染进程往返。 */
export function startDrag(cursorX: number, cursorY: number): void {
  console.log('[win] dragStart', cursorX, cursorY)
  if (!win || drag) return
  setPassthrough(false)
  const bounds = win.getBounds()
  const grabOffsetX = cursorX - bounds.x
  const grabOffsetY = cursorY - bounds.y
  drag = { grabOffsetX, grabOffsetY, originX: bounds.x, originY: bounds.y, poll: setInterval(pollDragCursor, 16), ticks: 0 }
}

function pollDragCursor(): void {
  if (!win || !drag) return
  const cursor = screen.getCursorScreenPoint()
  // 显式带尺寸：实测 setPosition 在 transparent frameless 窗口上每次调用
  // 会累积 ~1 物理像素的尺寸漂移（Electron 内部 bounds 舍入），setBounds 恒定尺寸可绕过。
  const { w, h } = SIZES[currentMode]
  win.setBounds({ x: cursor.x - drag.grabOffsetX, y: cursor.y - drag.grabOffsetY, width: w, height: h })
  if (++drag.ticks === 1 || drag.ticks === 30) {
    console.log('[win] poll tick', drag.ticks, 'bounds:', JSON.stringify(win.getBounds()))
  }
}

export function endDrag(): void {
  console.log('[win] dragEnd, session?', !!drag)
  if (!drag) return
  clearInterval(drag.poll)
  const session = drag
  drag = null

  if (!win) return
  const cursor = screen.getCursorScreenPoint()
  const dragged = Math.hypot(cursor.x - (session.originX + session.grabOffsetX), cursor.y - (session.originY + session.grabOffsetY))
  if (dragged < TAP_THRESHOLD) {
    // 按下后几乎没有位移 → 轻点，交由渲染进程展开/收起面板。
    broadcast('window:tap', currentMode)
    return
  }
  const mode = settleAfterDrag()
  if (mode) broadcast('window:settled', mode)
}

export const handleWindowMoved = debounce(() => {
  if (!win || drag || programmaticMove) {
    programmaticMove = false
    return
  }
  const mode = settleAfterDrag()
  if (mode) broadcast('window:settled', mode)
}, 250)

/** 注册主进程 move 监听（在窗口创建后调用）。 */
export function watchWindowMoves(): void {
  if (!win) return
  win.on('move', handleWindowMoved)
}

/**
 * 点击穿透（主进程全权判定，不依赖 renderer/forward）：
 * compact 模式窗口矩形大于球面，光标落在球面椭圆之外时穿透到桌面；
 * panel/notification/dock 内容接近满窗，整个矩形保持可交互。
 * 注：setIgnoreMouseEvents 的 forward mousemove 在本机不派发，
 * renderer 侧无法感知穿透中的光标，因此判定只能在这里完成。
 */
const BALL_CENTER = { x: 72, y: 52 }
const BALL_RADIUS = { x: 44, y: 40 }

let passthroughPoll: NodeJS.Timeout | undefined
let passthroughPollTicks = 0
export function startPassthroughLoop(): void {
  if (passthroughPoll || !win) return
  setPassthrough(true)
  passthroughPoll = setInterval(() => {
    if (!win || drag) return // 拖动中球贴着光标，保持可交互
    const cursor = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const localX = cursor.x - b.x
    const localY = cursor.y - b.y
    if (++passthroughPollTicks % 50 === 1) {
      console.log('[win] ppoll', JSON.stringify({ cursor: { x: cursor.x, y: cursor.y }, bounds: b }))
    }
    let interactive = true
    if (currentMode === 'compact') {
      const dx = (localX - BALL_CENTER.x) / BALL_RADIUS.x
      const dy = (localY - BALL_CENTER.y) / BALL_RADIUS.y
      interactive = dx * dx + dy * dy <= 1
    } else {
      interactive = localX >= 0 && localY >= 0 && localX < b.width && localY < b.height
    }
    setPassthrough(!interactive)
  }, 30)
}

export function stopPassthroughLoop(): void {
  if (passthroughPoll) {
    clearInterval(passthroughPoll)
    passthroughPoll = undefined
  }
}

let passthroughState = false
function setPassthrough(passthrough: boolean): void {
  if (passthroughState === passthrough) return
  passthroughState = passthrough
  console.log('[win] passthrough ->', passthrough)
  if (!win) return
  if (passthrough) {
    win.setIgnoreMouseEvents(true, { forward: true })
  } else {
    win.setIgnoreMouseEvents(false)
  }
}
