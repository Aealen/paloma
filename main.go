package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"paloma/internal/domain"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[domain.AgentEvent](agentEventName)
	application.RegisterEvent[application.Void](dragSettledEventName)
	application.RegisterEvent[string](uiModeEventName)
}

func main() {
	service := NewAppService()
	app := application.New(application.Options{
		Name:        "Paloma",
		Description: "A tiny Agent companion for your desktop",
		Services: []application.Service{
			application.NewService(service),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		OnShutdown: func() {
			if err := service.stopSimulation(); err != nil {
				log.Printf("停止模拟事件失败: %v", err)
			}
		},
	})
	service.attach(app)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "paloma-island",
		Title:            "Paloma",
		Width:            144,
		Height:           104,
		Frameless:        true,
		AlwaysOnTop:      true,
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		// 去掉 Windows 11 给无边框窗口画的系统边框/圆角/阴影（透明窗口会露出灰框）；
		// 拖动走 JS SetPosition，不依赖该配置。
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		InitialPosition: application.WindowCentered,
		URL:             "/",
	})

	// 必须在窗口创建之后：按名称取窗口对象注册 WindowDidMove 监听。
	setupDragSettleNotifier(app)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
