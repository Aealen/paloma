import { BrowserWindow } from 'electron'

// 主进程 → 渲染进程的事件广播（走所有 BrowserWindow 的 webContents）。
type MainEventMap = {
  'store:agent-event': unknown
  'mode:changed': string
  'window:settled': string
  'window:tap': string
}

export function broadcast<K extends keyof MainEventMap>(channel: K, payload: MainEventMap[K]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}
