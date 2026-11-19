// 领域类型（自包含，对齐主进程 electron/main/store.ts 的模型）。
export type AgentStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'thinking'
  | 'streaming'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type EventType =
  | 'agent.started'
  | 'agent.progress'
  | 'agent.message'
  | 'agent.waiting'
  | 'agent.completed'
  | 'agent.failed'
  | 'todo.due'
  | 'schedule.fired'

export type TodoStatus = 'inbox' | 'active' | 'completed' | 'snoozed' | 'cancelled'
export type Transport = 'embedded' | 'stdio' | 'http' | 'websocket'
export type Capability = 'chat' | 'stream' | 'cancel' | 'approval' | 'tool' | 'usage' | 'files' | 'schedule' | 'health'

export interface AgentEvent {
  schemaVersion: string
  id: string
  providerId: string
  agentId: string
  conversationId?: string
  runId?: string
  type: EventType
  status: AgentStatus
  title: string
  content?: string
  progress?: number | null
  requiresAction?: boolean
  createdAt: string
  metadata?: Record<string, unknown> | null
}

export interface Todo {
  id: string
  title: string
  description?: string
  status: TodoStatus
  dueAt?: string | null
  source?: string
  linkedConversationId?: string
  createdAt: string
  updatedAt: string
}

export interface ProviderManifest {
  id: string
  displayName: string
  protocolVersion: string
  transports: Transport[]
  capabilities: Capability[]
}

export interface Automation {
  id: string
  title: string
  enabled: boolean
  kind: 'once' | 'interval' | 'cron'
  schedule: string
  timezone: string
  action: { kind: string; payload?: Record<string, unknown> }
  nextRunAt?: string | null
  lastRunAt?: string | null
}

export interface AppSnapshot {
  event: AgentEvent
  activity: AgentEvent[]
  providers: ProviderManifest[]
  todos: Todo[]
  automations: Automation[]
  simulationMode: boolean
  simulationActive: boolean
}

// 窗口形态与主进程 electron/main/window.ts 的 UiMode 对齐。
export type WindowMode = 'compact' | 'notification' | 'panel' | 'dock-left' | 'dock-right'
export type DockSide = 'dock-left' | 'dock-right'

export type SpriteMood = 'idle' | 'working' | 'thinking' | 'waiting' | 'happy' | 'worried'
