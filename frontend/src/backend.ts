import { Events } from '@wailsio/runtime'
import { AppService } from '../bindings/paloma'
import { AgentStatus, EventType, Capability, Transport, TodoStatus } from '../bindings/paloma/internal/domain'
import type { AgentEvent, AppSnapshot } from './types'

export interface Backend {
  snapshot(): Promise<AppSnapshot>
  subscribe(listener: (event: AgentEvent) => void): () => void
  triggerSimulation(provider: string, status: string): Promise<void>
  startSimulation(): Promise<void>
  stopSimulation(): Promise<void>
  addTodo(title: string): Promise<void>
  completeTodo(id: string): Promise<void>
}

function normalise(snapshot: Awaited<ReturnType<typeof AppService.Snapshot>>): AppSnapshot {
  return {
    ...snapshot,
    activity: snapshot.activity ?? [],
    providers: snapshot.providers ?? [],
    todos: snapshot.todos ?? [],
    automations: snapshot.automations ?? [],
  }
}

const desktopBackend: Backend = {
  async snapshot() { return normalise(await AppService.Snapshot()) },
  subscribe(listener) {
    return Events.On('paloma:agent-event', (event) => listener(event.data))
  },
  async triggerSimulation(provider, status) { await AppService.TriggerSimulation(provider, status) },
  async startSimulation() { await AppService.StartSimulation() },
  async stopSimulation() { await AppService.StopSimulation() },
  async addTodo(title) { await AppService.AddTodo(title) },
  async completeTodo(id) { await AppService.CompleteTodo(id) },
}

// 浏览器预览用于验证界面，不与真实 Agent 或桌面运行时通信。
function createPreviewBackend(): Backend {
  const listeners = new Set<(event: AgentEvent) => void>()
  let timer: number | undefined
  let counter = 0
  const snapshot: AppSnapshot = {
    event: {
      schemaVersion: '1', id: 'initial', providerId: 'paloma', agentId: 'paloma',
      type: EventType.EventAgentMessage, status: AgentStatus.StatusIdle,
      title: 'Paloma 已准备好', content: '等待新的活动', createdAt: new Date().toISOString(),
    },
    activity: [],
    providers: ['ZCode', 'DSH'].map((displayName) => ({
      id: displayName.toLowerCase(), displayName, protocolVersion: '1',
      transports: [Transport.TransportEmbedded],
      capabilities: [Capability.CapabilityHealth],
    })),
    todos: [], automations: [], simulationMode: true, simulationActive: false,
  }
  const states: Record<string, { type: EventType; title: string; content: string }> = {
    idle: { type: EventType.EventAgentMessage, title: '休息一下', content: '模拟事件已回到待机状态。' },
    running: { type: EventType.EventAgentProgress, title: '正在工作', content: '正在整理项目中的信息。' },
    thinking: { type: EventType.EventAgentProgress, title: '正在思考下一步', content: '正在检查任务上下文。' },
    waiting_approval: { type: EventType.EventAgentWaiting, title: '等你确认一项操作', content: '这是用于演示的待确认消息。' },
    completed: { type: EventType.EventAgentCompleted, title: '任务顺利完成', content: '这是一条模拟完成消息。' },
    failed: { type: EventType.EventAgentFailed, title: '刚刚遇到一个问题', content: '这是一条模拟异常消息。' },
  }
  const emit = (provider: string, status: string) => {
    const state = states[status]
    if (!state) throw new Error('未知的模拟状态')
    const event: AgentEvent = {
      schemaVersion: '1', id: `preview-${++counter}`, providerId: provider,
      agentId: `${provider}-demo`, type: state.type, status: status as AgentStatus,
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
      snapshot.todos.unshift({ id: `todo-${++counter}`, title, status: TodoStatus.TodoInbox, source: 'manual', createdAt: now, updatedAt: now })
    },
    async completeTodo(id) {
      const todo = snapshot.todos.find((item) => item.id === id)
      if (!todo) throw new Error('待办不存在')
      todo.status = TodoStatus.TodoCompleted
      todo.updatedAt = new Date().toISOString()
    },
  }
}

export const isBrowserPreview = new URLSearchParams(window.location.search).has('preview')
export const backend = isBrowserPreview ? createPreviewBackend() : desktopBackend
