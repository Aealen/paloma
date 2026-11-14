package main

import (
	"fmt"
)

// 状态条吸附判定的物理尺寸阈值。窗口几何本身由 ui_mode.go 统一管理。
const snapMarginPhys = 120

// SettleAfterDrag 在前端拖动结束后调用：按窗口当前位置与所在显示器
// 工作区判定吸附，切到状态条或恢复小球形态（几何由 applyMode 统一处理）。
// 返回值告知前端最终形态；无变化时返回空。
func (s *AppService) SettleAfterDrag() (string, error) {
	hwnd := s.windowHandle()
	if hwnd == 0 {
		return "", fmt.Errorf("window not ready")
	}
	windowRect, err := getWindowRect(hwnd)
	if err != nil {
		return "", err
	}

	centerX := windowRect.Left + (windowRect.Right-windowRect.Left)/2
	centerY := windowRect.Top + (windowRect.Bottom-windowRect.Top)/2

	mi, err := monitorWorkArea(centerX, centerY)
	if err != nil {
		return "", err
	}

	w, _ := modePhysSize(s.currentMode())
	currentlyDocked := windowRect.Right-windowRect.Left == w && (s.currentMode() == modeDockLeft || s.currentMode() == modeDockRight)

	// 距左/右工作区边缘不足阈值 → 吸附；否则脱离状态条恢复小球。
	switch {
	case centerX-mi.RcWork.Left <= snapMarginPhys:
		s.applyMode(modeDockLeft)
		return string(modeDockLeft), nil
	case mi.RcWork.Right-centerX <= snapMarginPhys:
		s.applyMode(modeDockRight)
		return string(modeDockRight), nil
	default:
		if currentlyDocked {
			s.applyMode(modeCompact)
			return string(modeCompact), nil
		}
		return "", nil
	}
}
