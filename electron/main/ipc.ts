import { app, ipcMain } from 'electron'
import { Store } from './store'
import { broadcast } from './events'
import { applyMode, endDrag, startDrag, togglePanel, type UiMode } from './window'

const store = new Store()

/** 注册渲染进程可调用的全部 IPC 通道。 */
export function registerIpc(): void {
  store.subscribe((event) => broadcast('store:agent-event', event))

  ipcMain.handle('store:snapshot', () => store.snapshot())
  ipcMain.handle('store:trigger-simulation', (_event, provider: string, status: string) => {
    store.triggerSimulation(provider, status)
  })
  ipcMain.handle('store:start-simulation', () => store.startSimulation())
  ipcMain.handle('store:stop-simulation', () => store.stopSimulation())
  ipcMain.handle('store:add-todo', (_event, title: string) => store.addTodo(title))
  ipcMain.handle('store:complete-todo', (_event, id: string) => store.completeTodo(id))

  ipcMain.handle('window:toggle-panel', () => togglePanel())
  ipcMain.handle('window:set-mode', (_event, mode: UiMode) => applyMode(mode))
  ipcMain.on('window:passthrough', () => {
    // 穿透由主进程轮询全权判定，渲染进程的开关请求不再生效。
  })
  ipcMain.on('window:drag-start', (_event, cursorX: number, cursorY: number) => startDrag(cursorX, cursorY))
  ipcMain.on('window:drag-end', () => endDrag())

  void app
}
