import { useCallback, useEffect, useRef, useState } from 'react'
import { Events, Window as WailsWindow } from '@wailsio/runtime'
import { isBrowserPreview } from '../backend'

const TAP_THRESHOLD = 4

// Go 侧在窗口移动停稳（250ms 无新移动）后发出的结算兜底信号。
const dragSettledEventName = 'paloma:window-settled'

type DragSession = {
  /** 按下时指针相对窗口的横坐标（球心偏移，用于换算松手后的中心屏幕坐标）。 */
  grabOffsetX: number
  grabOffsetY: number
  /** 按下时窗口位置，用于位移比较与拖动增量计算。 */
  originX: number
  originY: number
  moved: boolean
}

type UseWindowDragOptions = {
  /** 轻点（按下后窗口几乎未移动）时触发。 */
  onTap?: () => void
  /** 拖动开始（首次有效移动）时触发。 */
  onDragStart?: () => void
  /** 拖动结束（松手）时触发，带球心/条心的屏幕坐标。 */
  onDragEnd?: (centerX: number, centerY: number) => void
  /** 指针移动时触发（非拖动态），供视线跟随等附加行为使用。 */
  onPointerMoveExtra?: (event: React.PointerEvent) => void
}

/**
 * JS 拖动：pointermove 中调 SetPosition 移动窗口（已验证精确跟手）。
 * 轻点/拖动用指针位移区分（JS 拖动下 pointer 事件流完整可靠）；
 * Go 侧 settled 事件作为松手结算的兜底（正常路径 pointerup 即时结算）。
 * 浏览器预览下只保留点击判定。
 */
export function useWindowDrag({ onTap, onDragStart, onDragEnd, onPointerMoveExtra }: UseWindowDragOptions = {}) {
  const [pressed, setPressed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const sessionRef = useRef<DragSession | null>(null)
  const callbacksRef = useRef({ onTap, onDragStart, onDragEnd, onPointerMoveExtra })
  callbacksRef.current = { onTap, onDragStart, onDragEnd, onPointerMoveExtra }

  const finish = useCallback((session: DragSession) => {
    if (sessionRef.current !== session) return
    sessionRef.current = null
    setPressed(false)
    setDragging(false)

    if (session.moved) {
      // 拖动结束：松手后窗口已停稳，读取当前位置换算中心屏幕坐标。
      if (!isBrowserPreview) {
        void WailsWindow.Position().then((position) => {
          callbacksRef.current.onDragEnd?.(position.x + session.grabOffsetX, position.y + session.grabOffsetY)
        }).catch(() => {
          callbacksRef.current.onDragEnd?.(session.originX + session.grabOffsetX, session.originY + session.grabOffsetY)
        })
      } else {
        callbacksRef.current.onDragEnd?.(session.originX + session.grabOffsetX, session.originY + session.grabOffsetY)
      }
    } else {
      callbacksRef.current.onTap?.()
    }
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0 || sessionRef.current) return
    setPressed(true)
    const rect = event.currentTarget.getBoundingClientRect()
    sessionRef.current = {
      grabOffsetX: event.clientX - rect.left,
      grabOffsetY: event.clientY - rect.top,
      originX: 0,
      originY: 0,
      moved: false,
    }
    if (isBrowserPreview) return
    void WailsWindow.Position().then((position) => {
      const current = sessionRef.current
      if (current !== sessionRef.current || !current) return
      current.originX = position.x
      current.originY = position.y
    }).catch(() => {
      // 位置不可用时无法判定拖动，退化为纯点击。
      sessionRef.current = null
      setPressed(false)
    })
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const session = sessionRef.current
    if (!session) {
      callbacksRef.current.onPointerMoveExtra?.(event)
      return
    }
    const deltaX = event.clientX - (session.originX + session.grabOffsetX)
    const deltaY = event.clientY - (session.originY + session.grabOffsetY)
    if (!session.moved && Math.hypot(deltaX, deltaY) < TAP_THRESHOLD) return
    if (!session.moved) {
      session.moved = true
      setPressed(false)
      setDragging(true)
      callbacksRef.current.onDragStart?.()
    }
    if (isBrowserPreview) return
    void WailsWindow.SetPosition(
      Math.round(session.originX + deltaX),
      Math.round(session.originY + deltaY),
    ).catch(() => {})
  }, [])

  const onPointerUp = useCallback(() => {
    const session = sessionRef.current
    if (session) finish(session)
  }, [finish])

  // 兜底：pointerup 被吞时由 Go 的 settled 事件结算（窗口移动停稳）。
  useEffect(() => {
    if (isBrowserPreview) return
    const unsubscribe = Events.On(dragSettledEventName, () => {
      const session = sessionRef.current
      if (session && session.moved) finish(session)
    })
    return unsubscribe
  }, [finish])

  return {
    pressed,
    dragging,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
