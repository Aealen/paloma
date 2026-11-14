// 窗口形态的类型定义。所有几何（尺寸/位置/吸附）由 Go 侧
// ui_mode.go 用 Win32 物理坐标统一管理，前端只消费形态字符串。
export type WindowMode = 'compact' | 'notification' | 'panel' | 'dock-left' | 'dock-right'

export type DockSide = 'dock-left' | 'dock-right'
