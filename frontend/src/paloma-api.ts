import type { AgentEvent, AppSnapshot, WindowMode } from './types'

/** 主进程通过 preload contextBridge 暴露的 API。 */
export interface PalomaApi {
  snapshot(): Promise<AppSnapshot>
  triggerSimulation(provider: string, status: string): Promise<void>
  startSimulation(): Promise<void>
  stopSimulation(): Promise<void>
  addTodo(title: string): Promise<void>
  completeTodo(id: string): Promise<void>
  togglePanel(): Promise<WindowMode>
  setMode(mode: WindowMode): Promise<WindowMode>
  setPassthrough(passthrough: boolean): void
  dragStart(cursorX: number, cursorY: number): void
  dragEnd(): void
  onAgentEvent(listener: (event: AgentEvent) => void): () => void
  onModeChanged(listener: (mode: WindowMode) => void): () => void
  onSettled(listener: (mode: WindowMode) => void): () => void
  onTap(listener: (mode: WindowMode) => void): () => void
}

declare global {
  interface Window {
    paloma?: PalomaApi
  }
}

export {}
