import { useCallback, useEffect, useRef, useState } from 'react'
import { isBrowserPreview } from '../backend'
import type { SpriteMood } from '../types'

type MascotProps = {
  mood: SpriteMood
  expanded: boolean
  /** 手绘脸小球颜色（hex）。 */
  bodyColor: string
  /** 每次事件到达时递增，触发一次小跳。 */
  bounceSignal: number
  /** 浏览器预览下的轻点回调（真实环境由主进程 tap 事件驱动）。 */
  onPreviewTap?: () => void
}

const labels: Record<SpriteMood, string> = {
  idle: '待机', working: '工作中', thinking: '思考中',
  waiting: '等待确认', happy: '已完成', worried: '有异常',
}

const NAP_AFTER_MS = 45_000

export function Mascot({ mood, expanded, bodyColor, bounceSignal, onPreviewTap }: MascotProps) {
  const [blink, setBlink] = useState(false)
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [napping, setNapping] = useState(false)
  const [waking, setWaking] = useState(false)
  const [hopping, setHopping] = useState(false)
  const wakeTimer = useRef(0)
  const hopTimer = useRef(0)

  const wake = useCallback(() => {
    setNapping((wasNapping) => {
      if (!wasNapping) return false
      setWaking(true)
      window.clearTimeout(wakeTimer.current)
      wakeTimer.current = window.setTimeout(() => setWaking(false), 600)
      return false
    })
  }, [])

  const handleGaze = useCallback((event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setGaze({
      x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)),
      y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)),
    })
  }, [])

  // 拖动由主进程按光标轮询完成（绝对跟手）；轻点/吸附判定也在主进程结算。
  // 这里的 pointer 事件只负责发起与结束拖动会话。
  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    wake()
    if (isBrowserPreview) return
    event.currentTarget.setPointerCapture(event.pointerId)
    window.paloma?.dragStart(event.screenX, event.screenY)
  }, [wake])

  const onPointerUp = useCallback(() => {
    if (isBrowserPreview) onPreviewTap?.()
    else window.paloma?.dragEnd()
  }, [onPreviewTap])

  // 事件到达：小跳一下，顺便把瞌睡吓醒。
  useEffect(() => {
    if (bounceSignal === 0) return
    wake()
    setHopping(true)
    window.clearTimeout(hopTimer.current)
    hopTimer.current = window.setTimeout(() => setHopping(false), 1400)
  }, [bounceSignal, wake])

  // 生命感：随机眨眼。
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return
    let nextBlink = 0
    let closeTimer = 0
    const schedule = () => {
      nextBlink = window.setTimeout(() => {
        setBlink(true)
        closeTimer = window.setTimeout(() => { setBlink(false); schedule() }, 160)
      }, 3600 + Math.random() * 3200)
    }
    schedule()
    return () => { window.clearTimeout(nextBlink); window.clearTimeout(closeTimer) }
  }, [])

  // 视线漫游：待机且没人打扰时自己左看右看。
  useEffect(() => {
    if (mood !== 'idle' || hovered || napping) return
    let timer = 0
    const wander = () => {
      setGaze({ x: (Math.random() * 2 - 1) * 0.45, y: (Math.random() * 2 - 1) * 0.3 })
      timer = window.setTimeout(wander, 4800 + Math.random() * 4200)
    }
    timer = window.setTimeout(wander, 3800 + Math.random() * 3000)
    return () => window.clearTimeout(timer)
  }, [mood, hovered, napping])

  // 安静太久会打瞌睡：待机、无人交互且没有新事件。
  useEffect(() => {
    if (napping) return
    if (mood !== 'idle' || hovered) return
    const timer = window.setTimeout(() => setNapping(true), NAP_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [mood, hovered, napping, bounceSignal])

  const stateClasses = [
    `mood-${mood}`,
    blink ? 'is-blinking' : '',
    napping ? 'is-napping' : '',
    waking ? 'is-waking' : '',
    hopping ? 'is-hopping' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      className={`eye-button hit ${stateClasses}`}
      type="button"
      aria-label={`Paloma ${napping ? '打瞌睡中' : labels[mood]}，${expanded ? '收起' : '展开'}面板，按住可拖动`}
      aria-expanded={expanded}
      onPointerEnter={() => { setHovered(true); wake() }}
      onPointerLeave={() => { setHovered(false); setGaze({ x: 0, y: 0 }) }}
      onPointerMove={handleGaze}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="mascot-shadow" aria-hidden="true" />
      <span className="mascot-float" aria-hidden="true">
        <span className="mascot-tilt" aria-hidden="true">
          <svg className="eye-art" viewBox="0 0 96 96" aria-hidden="true">
            <defs>
              {/* 球面光照：左上高光、主体本色、边缘收暗，黑球也有轮廓层次 */}
              <radialGradient id="body-gradient" cx="0.34" cy="0.26" r="1.05">
                <stop offset="0" stopColor={`color-mix(in srgb, ${bodyColor} 72%, white)`} />
                <stop offset="0.55" stopColor={bodyColor} />
                <stop offset="1" stopColor={`color-mix(in srgb, ${bodyColor} 74%, black)`} />
              </radialGradient>
            </defs>
            <rect className="sprite-body" x="10" y="10" width="76" height="76" rx="35" fill="url(#body-gradient)" />
            {napping && (
              <g className="sprite-zzz" aria-hidden="true">
                <text x="72" y="30" className="zzz z1">z</text>
                <text x="80" y="20" className="zzz z2">z</text>
              </g>
            )}
            <g transform={`translate(${gaze.x * 4} ${gaze.y * 3})`}>
              <g className="sprite-expression">
                <g className="sprite-eye-rest">
                  <g className="sprite-eye eye-left"><rect x="30" y="35" width="11" height="22" rx="5.5" /></g>
                  <g className="sprite-eye eye-right"><rect x="55" y="35" width="11" height="22" rx="5.5" /></g>
                </g>
                <g className="sprite-eye-alt sprite-eye-happy">
                  <path d="M29 49 Q35.5 40 42 49" />
                  <path d="M54 49 Q60.5 40 67 49" />
                </g>
                <g className="sprite-eye-alt sprite-eye-worried">
                  <path d="M29 43 Q35.5 50 42 43" />
                  <path d="M54 43 Q60.5 50 67 43" />
                </g>
              </g>
            </g>
          </svg>
        </span>
      </span>
    </button>
  )
}
