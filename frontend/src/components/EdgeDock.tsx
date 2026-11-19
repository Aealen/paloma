import { useCallback } from 'react'
import { isBrowserPreview } from '../backend'
import type { SpriteMood } from '../types'

type EdgeDockProps = {
  mood: SpriteMood
  activityCount: number
  todoCount: number
  /** 浏览器预览下的轻点回调（真实环境由主进程 tap 事件驱动）。 */
  onPreviewTap: () => void
}

const moodColors: Record<SpriteMood, string> = {
  idle: '#8a8a90', working: '#78d99d', thinking: '#7aa7e8',
  waiting: '#e7c281', happy: '#6fe2a4', worried: '#ff958c',
}

/**
 * 屏幕边缘的状态条：像手机灵动岛一样吸附在侧边。
 * 圆点表示当前情绪，数字分别是本次活动数与未完成待办数。
 * 点击展开（主进程 tap 判定）；按住拖离边缘由主进程结算恢复小球。
 */
export function EdgeDock({ mood, activityCount, todoCount, onPreviewTap }: EdgeDockProps) {
  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0 || isBrowserPreview) return
    event.currentTarget.setPointerCapture(event.pointerId)
    window.paloma?.dragStart(event.screenX, event.screenY)
  }, [])

  const onPointerUp = useCallback(() => {
    if (isBrowserPreview) onPreviewTap()
    else window.paloma?.dragEnd()
  }, [onPreviewTap])

  return (
    <div
      className="edge-dock hit"
      role="button"
      tabIndex={0}
      aria-label={`Paloma 状态条：${activityCount} 条活动，${todoCount} 项待办。点击展开，按住拖离边缘`}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPreviewTap() } }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="dock-dot" style={{ background: moodColors[mood], boxShadow: `0 0 10px ${moodColors[mood]}55` }} aria-hidden="true" />
      <span className="dock-count">{activityCount > 99 ? '99+' : activityCount}</span>
      <span className="dock-sep" aria-hidden="true" />
      <span className="dock-count dock-todo">{todoCount > 99 ? '99+' : todoCount}</span>
    </div>
  )
}
