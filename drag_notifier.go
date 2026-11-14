package main

import (
	"log"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailsEvents "github.com/wailsapp/wails/v3/pkg/events"
)

const dragSettledEventName = "paloma:window-settled"

// setupDragSettleNotifier 监听窗口移动事件，停稳后（250ms 无新移动）通知前端。
// 窗口移动（真实拖动松手、程序化挪动）停稳是吸附结算的统一触发点。
//
// 注意：WindowDidMove 是 window 级事件（走 windowEvents channel），
// 必须用窗口对象的 OnWindowEvent 监听；app.Event.OnApplicationEvent
// 的 application 级监听器收不到 window 事件（实测踩坑）。
func setupDragSettleNotifier(app *application.App) {
	var mu sync.Mutex
	var settleTimer *time.Timer

	window, ok := app.Window.GetByName("paloma-island")
	if !ok || window == nil {
		log.Printf("[drag-notifier] 未找到 paloma-island 窗口，停稳结算不可用")
		return
	}
	window.OnWindowEvent(wailsEvents.Windows.WindowDidMove, func(_ *application.WindowEvent) {
		mu.Lock()
		defer mu.Unlock()
		if settleTimer != nil {
			settleTimer.Stop()
		}
		settleTimer = time.AfterFunc(250*time.Millisecond, func() {
			app.Event.Emit(dragSettledEventName)
		})
	})
}
