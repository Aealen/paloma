import { defineAoraBot } from '@aora-bot/element'
import { useEffect, useRef } from 'react'
import type { SpriteMood } from '../types'

// 注册 <aora-bot> Web Component（幂等）。
defineAoraBot()

type AoraFaceProps = {
  mood: SpriteMood
  napping: boolean
  paused: boolean
  /** Aora 引擎命名色，如 night / blue / yellow。 */
  bodyColor: string
  /** 部分引擎命名色带色调（如 night 偏紫），可用 CSS filter 校正。 */
  colorFilter?: string
  size?: number
}

// Paloma 情绪 → Aora Bot 动画状态。
const stateFor = (mood: SpriteMood, napping: boolean): string => {
  if (napping) return 'sleeping'
  switch (mood) {
    case 'working': return 'working'
    case 'thinking': return 'thinking'
    case 'waiting': return 'alerting'
    case 'happy': return 'happy'
    case 'worried': return 'sad'
    default: return 'idle'
  }
}

export function AoraFace({ mood, napping, paused, bodyColor, colorFilter, size = 84 }: AoraFaceProps) {
  const hostRef = useRef<HTMLElement>(null)

  // 不可见时暂停引擎 rAF，省 CPU。
  useEffect(() => {
    const host = hostRef.current as (HTMLElement & { paused?: boolean }) | null
    if (host) host.paused = paused
  }, [paused])

  return (
    <span className="aora-face" style={colorFilter ? { filter: colorFilter } : undefined}>
      <aora-bot
        ref={hostRef}
        shape="circle"
        face="eyes"
        color={bodyColor}
        state={stateFor(mood, napping)}
        size={size}
        eye-color="#fffdf7"
        reduced-motion={false}
        auto-pause={false}
      />
    </span>
  )
}
