import type { AgentEvent, AppSnapshot } from './types'
import type { PalomaApi } from './paloma-api'

export interface Backend {
  snapshot(): Promise<AppSnapshot>
  subscribe(listener: (event: AgentEvent) => void): () => void
  triggerSimulation(provider: string, status: string): Promise<void>
  startSimulation(): Promise<void>
  stopSimulation(): Promise<void>
  addTodo(title: string): Promise<void>
  completeTodo(id: string): Promise<void>
}

// 桌面后端：全部走主进程 IPC（preload 的 window.paloma）。
const desktopBackend: Backend = {
  snapshot() { return api().snapshot() },
  subscribe(listener) { return api().onAgentEvent(listener) },
  async triggerSimulation(provider, status) { await api().triggerSimulation(provider, status) },
  async startSimulation() { await api().startSimulation() },
  async stopSimulation() { await api().stopSimulation() },
  async addTodo(title) { await api().addTodo(title) },
  async completeTodo(id) { await api().completeTodo(id) },
}

function api(): PalomaApi {
  if (!window.paloma) throw new Error('主进程桥未就绪，请重启应用')
  return window.paloma
}

// 浏览器预览用于验证界面，不与真实 Agent 或桌面运行时通信。
function createPreviewBackend(): Backend {
  const listeners = new Set<(event: AgentEvent) => void>()
  let timer: number | undefined
  let counter = 0
  const snapshot: AppSnapshot = {
    event: {
      schemaVersion: '1', id: 'initial', providerId: 'paloma', agentId: 'paloma',
      type: 'agent.message', status: 'idle',
      title: 'Paloma 已准备好', content: '等待新的活动', createdAt: new Date().toISOString(),
    },
    activity: [],
    providers: ['ZCode', 'DSH'].map((displayName) => ({
      id: displayName.toLowerCase(), displayName, protocolVersion: '1',
      transports: ['embedded'], capabilities: ['health'],
    })),
    todos: [], automations: [], simulationMode: true, simulationActive: false,
  }
  const states: Record<string, { type: AgentEvent['type']; title: string; content: string }> = {
    idle: { type: 'agent.message', title: '休息一下', content: '模拟事件已回到待机状态。' },
    running: { type: 'agent.progress', title: '正在工作', content: '正在整理项目中的信息。' },
    thinking: { type: 'agent.progress', title: '正在思考下一步', content: '正在检查任务上下文。' },
    waiting_approval: { type: 'agent.waiting', title: '等你确认一项操作', content: '这是用于演示的待确认消息。' },
    completed: { type: 'agent.completed', title: '任务顺利完成', content: '这是一条模拟完成消息。' },
    failed: { type: 'agent.failed', title: '刚刚遇到一个问题', content: '这是一条模拟异常消息。' },
  }
  const emit = (provider: string, status: string) => {
    const state = states[status]
    if (!state) throw new Error('未知的模拟状态')
    const event: AgentEvent = {
      schemaVersion: '1', id: `preview-${++counter}`, providerId: provider,
      agentId: `${provider}-demo`, type: state.type, status: status as AgentEvent['status'],
      title: state.title, content: state.content,
      requiresAction: status === 'waiting_approval', createdAt: new Date().toISOString(),
    }
    snapshot.event = event
    snapshot.activity = [event, ...snapshot.activity].slice(0, 30)
    listeners.forEach((listener) => listener(event))
  }
  return {
    async snapshot() { return { ...snapshot, activity: [...snapshot.activity], todos: [...snapshot.todos] } },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async triggerSimulation(provider, status) { emit(provider, status) },
    async startSimulation() {
      if (timer !== undefined) return
      snapshot.simulationActive = true
      const sequence = ['thinking', 'running', 'waiting_approval', 'completed', 'failed', 'idle']
      timer = window.setInterval(() => emit(counter % 2 === 0 ? 'zcode' : 'dsh', sequence[counter % sequence.length]), 7000)
    },
    async stopSimulation() {
      window.clearInterval(timer)
      timer = undefined
      snapshot.simulationActive = false
    },
    async addTodo(title) {
      const now = new Date().toISOString()
      snapshot.todos.unshift({ id: `todo-${++counter}`, title, status: 'inbox', source: 'manual', createdAt: now, updatedAt: now })
    },
    async completeTodo(id) {
      const todo = snapshot.todos.find((item) => item.id === id)
      if (!todo) throw new Error('待办不存在')
      todo.status = 'completed'
      todo.updatedAt = new Date().toISOString()
    },
  }
}

export const isBrowserPreview = !window.paloma || new URLSearchParams(window.location.search).has('preview')
export const backend = isBrowserPreview ? createPreviewBackend() : desktopBackend
