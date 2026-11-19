// 细节 01 生命感：眨眼调度 + 视线跟随/漫游。
// 呼吸与阴影是纯 CSS 动画（见 styles.css），这里只驱动需要随机性的部分。

const GAZE_MAX_X = 4
const GAZE_MAX_Y = 3
const GAZE_SMOOTH_MS = 80
const WANDER_IDLE_MS = 5000
const BLINK_MIN_MS = 3200
const BLINK_MAX_MS = 6500
const WANDER_MIN_MS = 4000
const WANDER_MAX_MS = 8000

function setupBlink(ball: HTMLElement): void {
  const schedule = (): void => {
    window.setTimeout(() => {
      ball.classList.add('is-blinking')
      window.setTimeout(() => {
        ball.classList.remove('is-blinking')
        schedule()
      }, 160)
    }, BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS))
  }
  schedule()
}

function setupGaze(eyes: HTMLElement): void {
  let target = { x: 0, y: 0 }
  let current = { x: 0, y: 0 }

  const render = (): void => {
    // 80ms 线性平滑，避免眼神瞬移。
    current.x += (target.x - current.x) * 0.35
    current.y += (target.y - current.y) * 0.35
    eyes.style.setProperty('--gaze-x', `${current.x.toFixed(2)}px`)
    eyes.style.setProperty('--gaze-y', `${current.y.toFixed(2)}px`)
  }
  window.setInterval(render, GAZE_SMOOTH_MS)

  let lastMove = Date.now()
  let wandering = true

  // 鼠标在窗口内的相对位置映射为眼神偏移（±4 / ±3px）。
  window.addEventListener('mousemove', (event) => {
    lastMove = Date.now()
    wandering = false
    target = {
      x: (event.clientX / window.innerWidth * 2 - 1) * GAZE_MAX_X,
      y: (event.clientY / window.innerHeight * 2 - 1) * GAZE_MAX_Y,
    }
  })

  // 无人打扰 5 秒后进入漫游：每 4~8s 随机看一处，三成概率回中。
  const wander = (): void => {
    window.setTimeout(() => {
      if (Date.now() - lastMove >= WANDER_IDLE_MS) {
        wandering = true
        target = Math.random() < 0.3
          ? { x: 0, y: 0 }
          : {
              x: (Math.random() * 2 - 1) * GAZE_MAX_X * 0.75,
              y: (Math.random() * 2 - 1) * GAZE_MAX_Y * 0.75,
            }
      }
      wander()
    }, WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS))
  }
  wander()
  void wandering
}

function main(): void {
  const ball = document.querySelector<HTMLElement>('.ball')
  const eyes = document.querySelector<HTMLElement>('.eyes')
  if (!ball || !eyes) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  setupBlink(ball)
  setupGaze(eyes)
}

main()
