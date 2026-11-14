import type * as Domain from '../bindings/paloma/internal/domain'
import type { AppSnapshot as GeneratedSnapshot } from '../bindings/paloma/models'

export type AgentEvent = Domain.AgentEvent
export type AgentStatus = Domain.AgentStatus
export type ProviderManifest = Domain.ProviderManifest
export type Todo = Domain.Todo
export type Automation = Domain.Automation

// 数据在前端边界统一为数组，避免各视图重复处理 Go 的 nil 切片。
export type AppSnapshot = Omit<GeneratedSnapshot, 'activity' | 'providers' | 'todos' | 'automations'> & {
  activity: AgentEvent[]
  providers: ProviderManifest[]
  todos: Todo[]
  automations: Automation[]
}

export type SpriteMood = 'idle' | 'working' | 'thinking' | 'waiting' | 'happy' | 'worried'
