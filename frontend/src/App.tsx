import { useCallback, useEffect, useRef, useState } from 'react'
import { backend, isBrowserPreview } from './backend'
import type { AgentEvent, AppSnapshot, DockSide, SpriteMood, WindowMode } from './types'
import { Mascot } from './components/Mascot'
import { EdgeDock } from './components/EdgeDock'
import { ActivityPanel } from './components/ActivityPanel'
import { useWindowEvents } from './hooks/useWindowEvents'

// 精灵色板（手绘脸）。
export const SPRITE_PALETTE = [
  { key: 'black', label: '碳黑', hand: '#141414' },
  { key: 'blue', label: '经典蓝', hand: '#3784e8' },
  { key: 'yellow', label: '明黄', hand: '#f0b429' },
  { key: 'mint', label: '薄荷', hand: '#4cc38a' },
] as const

export type SpriteColorKey = (typeof SPRITE_PALETTE)[number]['key']

const initialSnapshot: AppSnapshot = {
  event: {
    schemaVersion: '1', id: 'initial', providerId: 'paloma', agentId: 'paloma',
    type: 'agent.message', status: 'idle',
    title: 'Paloma 已准备好', content: '等待新的活动', createdAt: new Date().toISOString(),
  },
  activity: [], providers: [], todos: [], automations: [],
  simulationMode: true, simulationActive: false,
}

function moodForStatus(status: AgentEvent['status']): SpriteMood {
  switch (status) {
    case 'queued':
    case 'running':
    case 'streaming':
      return 'working'
    case 'thinking':
      return 'thinking'
    case 'waiting_approval':
      return 'waiting'
    case 'completed':
      return 'happy'
    case 'failed':
      return 'worried'
    default:
      return 'idle'
  }
}

function isImportant(event: AgentEvent): boolean {
  return event.requiresAction === true || event.status === 'failed'
}

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(initialSnapshot)
  const [expanded, setExpanded] = useState(false)
  const [notification, setNotification] = useState<AgentEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AgentEvent | null>(null)
  const [activeTab, setActiveTab] = useState<'activity' | 'today' | 'plan'>('activity')
  const [error, setError] = useState('')
  const [colorKey, setColorKey] = useState<SpriteColorKey>('blue')
  const [dock, setDock] = useState<DockSide | null>(null)
  const [uiMode, setUiMode] = useState<WindowMode>('compact')
  const [bounceSignal, setBounceSignal] = useState(0)
  const palette = SPRITE_PALETTE.find((item) => item.key === colorKey) ?? SPRITE_PALETTE[0]

  const expandedRef = useRef(false)
  const dockRef = useRef<DockSide | null>(null)
  const refreshSequence = useRef(0)
  const eventRevision = useRef(0)

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

  // 主进程返回的形态字符串是窗口几何的唯一权威；这里只同步 UI 状态。
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

  // 形态切换的唯一入口：桌面环境调主进程（几何由主进程完成），
  // 浏览器预览退化为本地状态模拟。
  const requestMode = useCallback((request: () => Promise<WindowMode> | void, previewMode: WindowMode) => {
    if (isBrowserPreview) {
      applyModeState(previewMode)
      return
    }
    void Promise.resolve(request()).then((mode) => {
      if (mode) applyModeState(mode as WindowMode)
    }).catch((reason) => console.error('切换窗口形态失败', reason))
  }, [applyModeState])

  const openPanel = () => {
    if (notification) setActiveTab('activity')
    setSelectedEvent(notification)
    setNotification(null)
    requestMode(() => window.paloma?.togglePanel(), 'panel')
  }

  const closePanel = () => {
    setSelectedEvent(null)
    requestMode(() => window.paloma?.setMode('compact'), 'compact')
  }

  const dismissNotification = useCallback(() => {
    setNotification(null)
    // 仅当窗口正处于通知形态时才收回到紧凑形态；面板/停靠形态不受影响。
    if (!expandedRef.current && !dockRef.current) {
      requestMode(() => window.paloma?.setMode('compact'), 'compact')
    }
  }, [requestMode])

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
          requestMode(() => window.paloma?.setMode('notification'), 'notification')
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

  // 主进程事件：轻点（tap）、拖动松手结算、任意形态变更。
  useWindowEvents({
    onTap: () => { if (expandedRef.current) closePanel(); else openPanel() },
    onSettled: applyModeState,
    onModeChanged: applyModeState,
  })

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedRef.current) closePanel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 点击穿透由主进程轮询光标 + 球面几何全权判定，renderer 无需参与。

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
            onPreviewTap={openPanel}
          />
        ) : (
          <div className="mascot-slot">
            <Mascot
              mood={moodForStatus(notification?.status ?? selectedEvent?.status ?? snapshot.event.status)}
              expanded={expanded}
              bodyColor={palette.hand}
              bounceSignal={bounceSignal}
              onPreviewTap={expanded ? closePanel : openPanel}
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
            <div className="brand-line"><strong>paloma</strong><span>桌面小精灵</span></div>
            <p>{selectedEvent?.title ?? snapshot.event.title}</p>
            <button className="window-close" type="button" aria-label="隐藏到托盘" onClick={() => {
              if (!isBrowserPreview) window.paloma?.setMode('compact')
              closePanel()
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
