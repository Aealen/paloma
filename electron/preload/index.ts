import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AgentEvent, AppSnapshot } from '../main/store'
import type { UiMode } from '../main/window'

/** 渲染进程可用的主进程 API（contextBridge 白名单）。 */
export interface PalomaApi {
  snapshot(): Promise<AppSnapshot>
  triggerSimulation(provider: string, status: string): Promise<void>
  startSimulation(): Promise<void>
  stopSimulation(): Promise<void>
  addTodo(title: string): Promise<void>
  completeTodo(id: string): Promise<void>
  togglePanel(): Promise<UiMode>
  setMode(mode: UiMode): Promise<UiMode>
  setPassthrough(passthrough: boolean): void
  dragStart(grabOffsetX: number, grabOffsetY: number): void
  dragEnd(): void
  onAgentEvent(listener: (event: AgentEvent) => void): () => void
  onModeChanged(listener: (mode: UiMode) => void): () => void
  onSettled(listener: (mode: UiMode) => void): () => void
  onTap(listener: (mode: UiMode) => void): () => void
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: PalomaApi = {
  snapshot: () => ipcRenderer.invoke('store:snapshot'),
  triggerSimulation: (provider, status) => ipcRenderer.invoke('store:trigger-simulation', provider, status),
  startSimulation: () => ipcRenderer.invoke('store:start-simulation'),
  stopSimulation: () => ipcRenderer.invoke('store:stop-simulation'),
  addTodo: (title) => ipcRenderer.invoke('store:add-todo', title),
  completeTodo: (id) => ipcRenderer.invoke('store:complete-todo', id),
  togglePanel: () => ipcRenderer.invoke('window:toggle-panel'),
  setMode: (mode) => ipcRenderer.invoke('window:set-mode', mode),
  setPassthrough: (passthrough) => ipcRenderer.send('window:passthrough', passthrough),
  dragStart: (x, y) => ipcRenderer.send('window:drag-start', x, y),
  dragEnd: () => ipcRenderer.send('window:drag-end'),
  onAgentEvent: (listener) => subscribe('store:agent-event', listener),
  onModeChanged: (listener) => subscribe('mode:changed', listener),
  onSettled: (listener) => subscribe('window:settled', listener),
  onTap: (listener) => subscribe('window:tap', listener),
}

contextBridge.exposeInMainWorld('paloma', api)
