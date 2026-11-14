import { useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { AppService } from '../../bindings/paloma'
import { isBrowserPreview } from '../backend'

// Go 侧在窗口移动停稳（250ms 无新移动，即拖动松手）后发出的结算信号。
const dragSettledEventName = 'paloma:window-settled'

/**
 * 拖动由 useWindowDrag 的 JS SetPosition 完成（已验证精确跟手）；
 * 松手结算有两条路径：正常路径 pointerup 直接触发 onDragEnd，
 * 本 hook 订阅 Go 的 window-settled 事件作为兜底（pointerup 被吞、
 * 或窗口因系统因素移动停稳时，仍能完成吸附/恢复判定）。
 * 浏览器预览下不订阅任何窗口事件。
 */
export function useDragSettle(onSettled: (mode: string) => void) {
  const [dragging, setDragging] = useState(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    if (isBrowserPreview) return

    let debounceTimer = 0
    const unsubscribe = Events.On(dragSettledEventName, () => {
      // 拖动中窗口持续移动，事件多次到达；仅在没有新移动时结算。
      window.clearTimeout(debounceTimer)
      setDragging(true)
      debounceTimer = window.setTimeout(() => {
        setDragging(false)
        void AppService.SettleAfterDrag().then((mode) => {
          if (mode) onSettledRef.current(mode)
        }).catch((reason) => console.error('吸附判定失败', reason))
      }, 60)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(debounceTimer)
    }
  }, [])

  return { dragging }
}
