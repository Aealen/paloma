import { app } from 'electron'
import { registerIpc } from './ipc'
import { createMainWindow, getMainWindow, startPassthroughLoop, watchWindowMoves } from './window'
import { createTray } from './tray'

// 主进程未捕获异常打到 stdout（Electron 默认弹 Error 框且不留痕）。
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err?.stack ?? err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason)
})

// 单实例：再次启动时聚焦已有窗口。
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    console.log('[main] app ready, creating window')
    createMainWindow()
    watchWindowMoves()
    registerIpc()
    createTray()
    startPassthroughLoop()
    console.log('[main] startup complete')
  }).catch((reason) => {
    console.error('[main] startup failed', reason)
  })

  // 关窗即隐藏到托盘（window.ts 拦截 close），这里只兜底非 Windows 平台。
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
