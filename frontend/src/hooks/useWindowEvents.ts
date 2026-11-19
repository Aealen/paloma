import { useEffect, useRef } from 'react'
import type { WindowMode } from '../types'
import { isBrowserPreview } from '../backend'

/**
 * 订阅主进程的形态事件：
 * - window:settled：拖动松手吸附/恢复结算
 * - mode:changed：任意形态切换（applyMode 广播）
 * - window:tap：drag region 轻点判定（位移 < 5px）
 * 浏览器预览下不订阅（形态切换走本地模拟）。
 */
export function useWindowEvents(handlers: {
  onSettled?: (mode: WindowMode) => void
  onModeChanged?: (mode: WindowMode) => void
  onTap?: () => void
}): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (isBrowserPreview || !window.paloma) return
    const api = window.paloma
    const offSettled = api.onSettled((mode) => handlersRef.current.onSettled?.(mode))
    const offMode = api.onModeChanged((mode) => handlersRef.current.onModeChanged?.(mode))
    const offTap = api.onTap(() => handlersRef.current.onTap?.())
    return () => {
      offSettled()
      offMode()
      offTap()
    }
  }, [])
}
