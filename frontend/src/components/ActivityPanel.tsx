import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AppSnapshot, AgentEvent } from '../types'
import { SPRITE_PALETTE, type SpriteColorKey } from '../App'

type ActivityPanelProps = {
  snapshot: AppSnapshot
  selectedEvent: AgentEvent | null
  activeTab: 'activity' | 'today' | 'plan'
  error: string
  colorKey: SpriteColorKey
  onColorChange: (key: SpriteColorKey) => void
  onTabChange: (tab: 'activity' | 'today' | 'plan') => void
  onClose: () => void
  onAddTodo: (title: string) => Promise<boolean>
  onCompleteTodo: (id: string) => Promise<boolean>
  onSimulate: (status: string, providerId: string) => Promise<boolean>
  onToggleSimulation: () => Promise<boolean>
}

const tabs = [{ id: 'activity', label: '活动' }, { id: 'today', label: '待办' }, { id: 'plan', label: '计划' }] as const
const timeLabel = (value: string) => {
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? '—' : new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(time)
}
const sourceLabel = (id: string) => ({ zcode: 'ZCode', dsh: 'DSH', paloma: 'Paloma' }[id] ?? id)
const stateLabel = (event: AgentEvent) => {
  switch (event.status) {
    case 'waiting_approval': return '等待确认'
    case 'completed': return '已完成'
    case 'failed': return '出现异常'
    case 'idle': return '待机中'
    case 'thinking': return '思考中'
    case 'cancelled': return '已取消'
    default: return '工作中'
  }
}

export function ActivityPanel({ snapshot, selectedEvent, activeTab, error, colorKey, onColorChange, onTabChange, onClose, onAddTodo, onCompleteTodo, onSimulate, onToggleSimulation }: ActivityPanelProps) {
  const { activity, providers, todos, simulationActive } = snapshot
  const event = selectedEvent ?? snapshot.event
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const unfinished = todos.filter((todo) => todo.status !== 'completed' && todo.status !== 'cancelled')

  useEffect(() => { closeRef.current?.focus() }, [])

  const submitTodo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setAdding(true)
    try {
      if (await onAddTodo(title)) setDraft('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="activity-panel hit" aria-label="Paloma 面板">
      <header className="panel-header">
        <h1>Paloma</h1>
        <button ref={closeRef} className="icon-button close-panel" type="button" aria-label="收起面板" onClick={onClose}>×</button>
      </header>
      <nav className="panel-tabs" aria-label="面板视图">
        {tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => onTabChange(tab.id)}>
          {tab.label}{tab.id === 'today' && unfinished.length > 0 && <span className="tab-count">{unfinished.length}</span>}
        </button>)}
      </nav>
      {error && <p className="error-message" role="alert">{error}</p>}

      {activeTab === 'activity' && <div className="panel-content">
        <article className="current-event">
          <div className="event-topline"><span className={`source-pill source-${event.providerId}`}>{sourceLabel(event.providerId)}</span><time dateTime={event.createdAt}>{timeLabel(event.createdAt)}</time></div>
          <h2>{event.title}</h2><p>{event.content || '等待活动'}</p>
          <div className={`event-state state-${event.status}`}><span className="state-dot" />{stateLabel(event)}
            {event.progress != null && <span className="event-progress">{Math.round(event.progress)}%</span>}
          </div>
          {event.requiresAction && <button className="primary-action" type="button" onClick={() => void onSimulate('completed', event.providerId)}>模拟完成</button>}
        </article>
        <div className="section-heading"><h2>最近活动</h2><span>本次运行</span></div>
        {activity.length === 0 ? <p className="list-empty">暂时没有新活动</p> : <ul className="activity-list">{activity.slice(0, 5).map((item) => <li key={item.id}>
          <span className={`activity-dot state-${item.status}`} /><span className="activity-copy"><strong>{item.title}</strong><small>{sourceLabel(item.providerId)} · {stateLabel(item)}</small></span><time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
        </li>)}</ul>}
        <div className="section-heading"><h2>状态演示</h2><button className="text-button" type="button" onClick={() => void onToggleSimulation()}>{simulationActive ? '停止演示' : '自动演示'}</button></div>
        <div className="color-picker" role="group" aria-label="精灵颜色">
          {SPRITE_PALETTE.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`color-chip${colorKey === item.key ? ' is-selected' : ''}`}
              style={{ background: item.hand }}
              title={item.label}
              aria-pressed={colorKey === item.key}
              aria-label={`精灵颜色：${item.label}`}
              onClick={() => onColorChange(item.key)}
            />
          ))}
        </div>
        <div className="demo-controls" aria-label="模拟状态">
          {[['idle','待机'], ['thinking','思考'], ['running','工作'], ['waiting_approval','确认'], ['completed','完成'], ['failed','异常']].map(([status, label]) => <button key={status} type="button" aria-pressed={event.status === status} onClick={() => void onSimulate(status, 'zcode')}>{label}</button>)}
        </div>
        <p className="provider-note">{providers.map((item) => item.displayName).join('、') || 'ZCode、DSH'} 尚未接入</p>
      </div>}

      {activeTab === 'today' && <div className="panel-content">
        <div className="section-heading first-heading"><h2>待办清单</h2><span>{unfinished.length} 项待完成</span></div>
        <form className="todo-form" onSubmit={(e) => void submitTodo(e)}>
          <label className="visually-hidden" htmlFor="todo-title">待办内容</label>
          <input id="todo-title" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} placeholder="记下一件小事…" />
          <button type="submit" disabled={!draft.trim() || adding}>添加</button>
        </form>
        {todos.length === 0 ? <div className="empty-state"><strong>暂无待办</strong><p>在上方输入待办事项</p></div> : <ul className="todo-list">{todos.map((todo) => <li key={todo.id} className={todo.status === 'completed' ? 'is-completed' : ''}>
          <button className="todo-check" type="button" aria-label={todo.status === 'completed' ? `${todo.title}已完成` : `完成${todo.title}`} disabled={todo.status === 'completed'} onClick={() => void onCompleteTodo(todo.id)}>{todo.status === 'completed' ? '✓' : ''}</button>
          <span>{todo.title}</span>{todo.status === 'completed' && <small>已完成</small>}
        </li>)}</ul>}
        <p className="quiet-note">当前为内存演示，退出应用后不会保存。</p>
      </div>}

      {activeTab === 'plan' && <div className="panel-content">
        <div className="section-heading first-heading"><h2>定时计划</h2><span>暂未开放</span></div>
        <div className="empty-state plan-empty"><strong>定时计划尚未实现</strong><p>后续将支持提醒和 Agent 定时任务</p></div>
        <div className="future-note"><strong>计划支持</strong><p>提醒与时区 · 重复规则 · Agent 任务</p></div>
      </div>}
      <footer className="panel-footer"><span className="footer-dot" /><span>演示模式 · 未连接真实 Agent</span><span className="footer-version">PALOMA 0.1</span></footer>
    </section>
  )
}
