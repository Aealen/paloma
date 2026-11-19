import path from 'node:path'
import { Menu, Tray, app, nativeImage } from 'electron'
import { getMainWindow, markQuitting } from './window'

let tray: Tray | null = null

/** 托盘：显示/隐藏小球、退出。关窗不退出（隐藏到托盘）。 */
export function createTray(): void {
  const icon = nativeImage.createFromPath(path.resolve(__dirname, '../../resources/icon.ico'))
  tray = new Tray(icon)
  tray.setToolTip('Paloma · 桌面小精灵')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示 / 隐藏小球',
        click: () => {
          const win = getMainWindow()
          if (!win) return
          if (win.isVisible()) win.hide()
          else win.show()
        },
      },
      { type: 'separator' },
      {
        label: '退出 Paloma',
        click: () => {
          markQuitting()
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isVisible()) win.hide()
      else win.show()
    }
  })
}
