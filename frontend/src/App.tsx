import { useCallback, useEffect, useRef, useState } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import { AppService } from '../bindings/paloma'
import { AgentStatus, EventType } from '../bindings/paloma/internal/domain'
import { backend, isBrowserPreview } from './backend'
import type { AgentEvent, AgentStatus as Status, AppSnapshot, SpriteMood } from './types'
import type { DockSide, WindowMode } from './windowLayout'
import { Mascot, type FaceKind } from './components/Mascot'
import { EdgeDock } from './components/EdgeDock'
import { ActivityPanel } from './components/ActivityPanel'
import { useDragSettle } from './hooks/useDragSettle'

// 精灵色板：手绘脸用 hex，Aora 脸用引擎命名色。
// 引擎的 black 是保留色（渲染为反白），深黑用 night；其 ink 偏紫，
// 通过 aoraFilter 降饱和压掉色调，让 Aora 脸的"碳黑"观感接近纯黑。
export const SPRITE_PALETTE = [
  { key: 'black', label: '碳黑', hand: '#141414', aora: 'night', aoraFilter: 'saturate(0.35) brightness(0.9)' },
  { key: 'blue', label: '经典蓝', hand: '#3784e8', aora: 'blue', aoraFilter: undefined },
  { key: 'yellow', label: '明黄', hand: '#f0b429', aora: 'yellow', aoraFilter: undefined },
  { key: 'mint', label: '薄荷', hand: '#4cc38a', aora: 'green', aoraFilter: undefined },
] as const

export type SpriteColorKey = (typeof SPRITE_PALETTE)[number]['key']

const initialSnapshot: AppSnapshot = {
  event: {
    schemaVersion: '1', id: 'initial', providerId: 'paloma', agentId: 'paloma',
    type: EventType.EventAgentMessage, status: AgentStatus.StatusIdle,
    title: 'Paloma 已准备好', content: '等待新的活动', createdAt: new Date().toISOString(),
  },
  activity: [], providers: [], todos: [], automations: [],
  simulationMode: true, simulationActive: false,
}

function moodForStatus(status: Status): SpriteMood {
  switch (status) {
    case AgentStatus.StatusQueued:
    case AgentStatus.StatusRunning:
    case AgentStatus.StatusStreaming:
      return 'working'
    case AgentStatus.StatusThinking:
      return 'thinking'
    case AgentStatus.StatusWaitingApproval:
      return 'waiting'
    case AgentStatus.StatusCompleted:
      return 'happy'
    case AgentStatus.StatusFailed:
      return 'worried'
    default:
      return 'idle'
  }
}

function isImportant(event: AgentEvent): boolean {
  return event.requiresAction === true || event.status === AgentStatus.StatusFailed
}

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(initialSnapshot)
  const [expanded, setExpanded] = useState(false)
  const [notification, setNotification] = useState<AgentEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AgentEvent | null>(null)
  const [activeTab, setActiveTab] = useState<'activity' | 'today' | 'plan'>('activity')
  const [error, setError] = useState('')
  const [face, setFace] = useState<FaceKind>(() =>
    new URLSearchParams(window.location.search).get('face') === 'aora' ? 'aora' : 'hand',
  )
  const [colorKey, setColorKey] = useState<SpriteColorKey>('blue')
  const [dock, setDock] = useState<DockSide | null>(null)
  const [uiMode, setUiMode] = useState<WindowMode>('compact')
  const [bounceSignal, setBounceSignal] = useState(0)
  const palette = SPRITE_PALETTE.find((item) => item.key === colorKey) ?? SPRITE_PALETTE[0]

  const expandedRef = useRef(false)
  const dockRef = useRef<DockSide | null>(null)
  const refreshSequence = useRef(0)
  const eventRevision = useRef(0)

  // Go 返回的形态字符串是窗口几何的唯一权威（Win32 物理坐标）；
  // 这里只同步前端 UI 状态，不再触碰任何窗口尺寸/位置 API。
  const applyModeState = useCallback((next: WindowMode) => {
    setUiMode(next)
    if (next === 'dock-left' || next === 'dock-right') {
      expandedRef.current = false
      dockRef.current = next
      setExpanded(false)
      setSelectedEvent(null)
      setNotification(null)
      setDock(next)
    } else if (next === 'panel') {
      expandedRef.current = true
      dockRef.current = null
      setExpanded(true)
      setDock(null)
    } else {
      expandedRef.current = false
      dockRef.current = null
      setExpanded(false)
      setDock(null)
    }
  }, [])

  // 形态切换的唯一入口：真实环境调 Go 绑定（几何由 Go 完成），
  // 浏览器预览退化为本地状态模拟。
  const requestMode = useCallback((request: () => Promise<string>, previewMode: WindowMode) => {
    if (isBrowserPreview) {
      applyModeState(previewMode)
      return
    }
    void request().then((mode) => {
      if (mode) applyModeState(mode as WindowMode)
    }).catch((reason) => console.error('切换窗口形态失败', reason))
  }, [applyModeState])

  // 拖动松手的统一落点：吸附与恢复计算全部在 Go 侧完成。
  const handleDragEnd = useCallback(() => {
    if (isBrowserPreview) return
    void AppService.SettleAfterDrag().then((mode) => {
      if (mode) applyModeState(mode as WindowMode)
    }).catch((reason) => console.error('吸附判定失败', reason))
  }, [applyModeState])

  // Go 侧结算信号兜底（pointerup 丢失时仍能完成吸附/恢复）。
  const handleSettled = useCallback((mode: string) => {
    if (mode) applyModeState(mode as WindowMode)
  }, [applyModeState])
  useDragSettle(handleSettled)

  const openPanel = () => {
    if (notification) setActiveTab('activity')
    setSelectedEvent(notification)
    setNotification(null)
    requestMode(() => AppService.TogglePanel(), 'panel')
  }

  const closePanel = () => {
    setSelectedEvent(null)
    requestMode(() => AppService.SetCompactMode(), 'compact')
  }

  const dismissNotification = useCallback(() => {
    setNotification(null)
    // 仅当窗口正处于通知形态时才收回到紧凑形态；面板/停靠形态不受影响。
    if (!expandedRef.current && !dockRef.current) {
      requestMode(() => AppService.SetCompactMode(), 'compact')
    }
  }, [requestMode])

  const refresh = useCallback(async (): Promise<boolean> => {
    const request = ++refreshSequence.current
    const revision = eventRevision.current
    try {
      const next = await backend.snapshot()
      if (request !== refreshSequence.current) return true
      setSnapshot((previous) => {
        if (eventRevision.current === revision) return next
        const seen = new Set(previous.activity.map((event) => event.id))
        const activity = [...previous.activity, ...next.activity.filter((event) => !seen.has(event.id))].slice(0, 30)
        return { ...next, event: previous.event, activity }
      })
      setError('')
      return true
    } catch (reason) {
      if (request !== refreshSequence.current) return false
      console.error('获取 Paloma 状态失败', reason)
      setError('无法连接本地服务，请重启应用后重试')
      return false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = backend.subscribe((event) => {
      eventRevision.current++
      setSnapshot((previous) => ({
        ...previous,
        event,
        activity: [event, ...previous.activity.filter((item) => item.id !== event.id)].slice(0, 30),
      }))
      if (!expandedRef.current) {
        setNotification((previous) => previous && isImportant(previous) && !isImportant(event) ? previous : event)
        // 新消息让小球蹦一下，把瞌睡吓醒。
        setBounceSignal((value) => value + 1)
        // 非停靠时窗口切到通知形态；停靠时状态条圆点已表达情绪，不再抢形态。
        if (!dockRef.current) {
          requestMode(() => AppService.SetNotificationMode(), 'notification')
        }
      }
    })
    void refresh()
    return unsubscribe
  }, [refresh, requestMode])

  useEffect(() => {
    if (!notification || isImportant(notification)) return
    const timer = window.setTimeout(() => dismissNotification(), 5000)
    return () => window.clearTimeout(timer)
  }, [notification, dismissNotification])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedRef.current) closePanel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const perform = async (action: () => Promise<void>): Promise<boolean> => {
    try {
      await action()
      await refresh()
      return true
    } catch (reason) {
      console.error('操作失败', reason)
      setError(reason instanceof Error ? reason.message : '操作失败，请重试')
      return false
    }
  }

  return (
    <main className={`desktop-island mode-${uiMode}${isBrowserPreview ? ' browser-preview' : ''}`}>
      <div className="island-top">
        {dock && !expanded ? (
          <EdgeDock
            mood={moodForStatus(snapshot.event.status)}
            activityCount={snapshot.activity.length}
            todoCount={snapshot.todos.filter((todo) => todo.status !== 'completed' && todo.status !== 'cancelled').length}
            onTap={openPanel}
            onDragEnd={handleDragEnd}
          />
        ) : (
          <div className="mascot-slot">
            <Mascot
              mood={moodForStatus(notification?.status ?? selectedEvent?.status ?? snapshot.event.status)}
              expanded={expanded}
              face={face}
              bodyColor={palette.hand}
              aoraColor={palette.aora}
              aoraFilter={palette.aoraFilter}
              bounceSignal={bounceSignal}
              onClick={expanded ? closePanel : openPanel}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}
        {uiMode === 'notification' && notification && (
          <div className={`notification-bubble bubble-${notification.status}`} role="status">
            <button className="bubble-content" type="button" onClick={openPanel}>
              <span className="bubble-source">{notification.providerId.toUpperCase()} · 模拟消息</span>
              <strong>{notification.title}</strong>
              {isImportant(notification) && <small>点击查看详情</small>}
            </button>
            <button className="bubble-dismiss" type="button" aria-label="收起通知" onClick={dismissNotification}>×</button>
          </div>
        )}
        {expanded && (
          <div className="island-heading">
            <div className="island-drag" aria-label="拖动窗口"><span className="drag-dots" aria-hidden="true">⠿</span></div>
            <div className="brand-line"><strong>paloma</strong><span>桌面小精灵</span></div>
            <p>{selectedEvent?.title ?? snapshot.event.title}</p>
            <button className="window-close" type="button" aria-label="退出 Paloma" onClick={() => {
              if (!isBrowserPreview) void WailsWindow.Close().catch((reason) => setError(String(reason)))
            }}>×</button>
          </div>
        )}
      </div>

      {expanded && (
        <ActivityPanel
          snapshot={snapshot}
          selectedEvent={selectedEvent}
          activeTab={activeTab}
          error={error}
          face={face}
          onFaceChange={setFace}
          colorKey={colorKey}
          onColorChange={setColorKey}
          onTabChange={setActiveTab}
          onClose={closePanel}
          onAddTodo={(title) => perform(() => backend.addTodo(title))}
          onCompleteTodo={(id) => perform(() => backend.completeTodo(id))}
          onSimulate={(status, provider) => {
            setSelectedEvent(null)
            return perform(() => backend.triggerSimulation(provider, status))
          }}
          onToggleSimulation={() => perform(() => snapshot.simulationActive ? backend.stopSimulation() : backend.startSimulation())}
        />
      )}
    </main>
  )
}

export default App
