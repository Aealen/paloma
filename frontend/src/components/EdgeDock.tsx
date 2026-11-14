import { useWindowDrag } from '../hooks/useWindowDrag'
import type { SpriteMood } from '../types'

type EdgeDockProps = {
  mood: SpriteMood
  activityCount: number
  todoCount: number
  onTap: () => void
  /** 拖动开始时触发（拖动中保持状态条形态）。 */
  onDragStart?: () => void
  /** 拖动结束（松手）时触发，带条心的屏幕坐标（Go 侧判定拖离/换边）。 */
  onDragEnd?: (centerX: number, centerY: number) => void
}

const moodColors: Record<SpriteMood, string> = {
  idle: '#8a8a90', working: '#78d99d', thinking: '#7aa7e8',
  waiting: '#e7c281', happy: '#6fe2a4', worried: '#ff958c',
}

/**
 * 屏幕边缘的状态条：像手机灵动岛一样吸附在侧边。
 * 圆点表示当前情绪，数字分别是本次活动数与未完成待办数。
 * 点击展开面板；按住拖离边缘由 Go 侧结算恢复小球。
 */
export function EdgeDock({ mood, activityCount, todoCount, onTap, onDragStart, onDragEnd }: EdgeDockProps) {
  const { pressed, dragHandlers } = useWindowDrag({
    onTap,
    onDragStart,
    onDragEnd,
  })

  return (
    <div
      className={`edge-dock${pressed ? ' is-pressed' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Paloma 状态条：${activityCount} 条活动，${todoCount} 项待办。点击展开，按住拖离边缘`}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTap() } }}
      {...dragHandlers}
    >
      <span className="dock-dot" style={{ background: moodColors[mood], boxShadow: `0 0 10px ${moodColors[mood]}55` }} aria-hidden="true" />
      <span className="dock-count">{activityCount > 99 ? '99+' : activityCount}</span>
      <span className="dock-sep" aria-hidden="true" />
      <span className="dock-count dock-todo">{todoCount > 99 ? '99+' : todoCount}</span>
    </div>
  )
}
