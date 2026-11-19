// 数据层：内存版领域存储与模拟事件（对齐 Wails 版 internal/ 的领域模型）。
// 首期仅内存保存（退出即丢），SQLite 持久化留待后续阶段。

export const SchemaVersion = '1'

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

const ACTIVITY_LIMIT = 30
const SIMULATION_INTERVAL_MS = 7000

const PROVIDERS: ProviderManifest[] = [
  { id: 'zcode', displayName: 'ZCode', protocolVersion: '1', transports: ['embedded'], capabilities: ['health'] },
  { id: 'dsh', displayName: 'DSH', protocolVersion: '1', transports: ['embedded'], capabilities: ['health'] },
]

function initialEvent(): AgentEvent {
  return {
    schemaVersion: SchemaVersion,
    id: 'initial',
    providerId: 'paloma',
    agentId: 'paloma',
    type: 'agent.message',
    status: 'idle',
    title: 'Paloma 已准备好',
    content: '等待 ZCode 或 DSH 的下一条活动',
    createdAt: new Date().toISOString(),
  }
}

function eventTypeForStatus(status: AgentStatus): EventType {
  switch (status) {
    case 'waiting_approval':
      return 'agent.waiting'
    case 'completed':
      return 'agent.completed'
    case 'failed':
      return 'agent.failed'
    case 'thinking':
    case 'streaming':
    case 'running':
      return 'agent.progress'
    default:
      return 'agent.message'
  }
}

function titleForStatus(status: AgentStatus): string {
  switch (status) {
    case 'idle':
      return '当前待机'
    case 'thinking':
      return '正在思考下一步'
    case 'streaming':
      return '正在输出回复'
    case 'waiting_approval':
      return '等你确认一项操作'
    case 'completed':
      return '任务顺利完成'
    case 'failed':
      return '刚刚遇到一个问题'
    default:
      return 'Agent 正在工作'
  }
}

function contentForStatus(status: AgentStatus): string {
  switch (status) {
    case 'waiting_approval':
      return '展开 Paloma 查看需要确认的内容'
    case 'completed':
      return '这条消息来自模拟事件，用于验证完成态'
    case 'failed':
      return '这条消息来自模拟事件，用于验证错误态'
    default:
      return '这条消息来自模拟事件'
  }
}

function progressForStatus(status: AgentStatus): number | null {
  switch (status) {
    case 'running':
      return 42
    case 'thinking':
      return 58
    case 'streaming':
      return 76
    case 'waiting_approval':
    case 'completed':
    case 'failed':
      return 100
    default:
      return null
  }
}

const SIMULATION_SEQUENCE: AgentStatus[] = ['thinking', 'running', 'waiting_approval', 'completed', 'failed', 'idle']

export class Store {
  private event: AgentEvent = initialEvent()
  private activity: AgentEvent[] = []
  private todos: Todo[] = []
  private automations: Automation[] = []
  private sequence = 0
  private simulationTimer: NodeJS.Timeout | undefined
  private onEvent?: (event: AgentEvent) => void

  /** 订阅新事件（主进程在注册 IPC 时接线到 webContents.send）。 */
  subscribe(listener: (event: AgentEvent) => void): void {
    this.onEvent = listener
  }

  snapshot(): AppSnapshot {
    return {
      event: this.event,
      activity: [...this.activity],
      providers: PROVIDERS,
      todos: [...this.todos],
      automations: [...this.automations],
      simulationMode: true,
      simulationActive: this.simulationTimer !== undefined,
    }
  }

  triggerSimulation(providerId: string, statusName: string): AgentEvent {
    const provider = providerId === 'dsh' ? 'dsh' : 'zcode'
    const status = statusName as AgentStatus
    const event: AgentEvent = {
      schemaVersion: SchemaVersion,
      id: `manual-${++this.sequence}`,
      providerId: provider,
      agentId: `${provider}-manual`,
      runId: 'manual-run',
      type: eventTypeForStatus(status),
      status,
      title: titleForStatus(status),
      content: contentForStatus(status),
      progress: progressForStatus(status),
      requiresAction: status === 'waiting_approval',
      createdAt: new Date().toISOString(),
    }
    this.publish(event)
    return event
  }

  startSimulation(): void {
    if (this.simulationTimer) return
    this.simulationTimer = setInterval(() => {
      const status = SIMULATION_SEQUENCE[this.sequence % SIMULATION_SEQUENCE.length]
      const provider = this.sequence % 2 === 0 ? 'zcode' : 'dsh'
      this.triggerSimulation(provider, status)
    }, SIMULATION_INTERVAL_MS)
  }

  stopSimulation(): void {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer)
      this.simulationTimer = undefined
    }
  }

  addTodo(title: string): Todo {
    const now = new Date().toISOString()
    const todo: Todo = {
      id: `todo-${++this.sequence}`,
      title: title.trim(),
      status: 'inbox',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }
    this.todos.unshift(todo)
    return todo
  }

  completeTodo(id: string): Todo {
    const todo = this.todos.find((item) => item.id === id)
    if (!todo) throw new Error(`待办 ${id} 不存在`)
    todo.status = 'completed'
    todo.updatedAt = new Date().toISOString()
    return todo
  }

  private publish(event: AgentEvent): void {
    this.event = event
    this.activity = [event, ...this.activity].slice(0, ACTIVITY_LIMIT)
    this.onEvent?.(event)
  }
}
