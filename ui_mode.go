package main

// 窗口 UI 形态的统一管理：所有窗口几何走 Win32 物理坐标（MoveWindow），
// 形态变更通过 paloma:mode 事件同步给前端。前端不直接调用任何窗口
// 尺寸/位置 API，彻底规避 GetScreen（逻辑）与 SetPosition（物理）的
// DPI 语义差异。

// 物理像素尺寸（125% 缩放屏实测标定：逻辑值 × 1.25）。
const (
	compactPhysW = 180
	compactPhysH = 130
	panelPhysW   = 525
	panelPhysH   = 713
	notifyPhysW  = 438
	notifyPhysH  = 140
	dockPhysW    = 175
	dockPhysH    = 400
	edgePadding  = 12
)

// uiMode 描述窗口当前形态。
type uiMode string

const (
	modeCompact      uiMode = "compact"
	modePanel        uiMode = "panel"
	modeNotification uiMode = "notification"
	modeDockLeft     uiMode = "dock-left"
	modeDockRight    uiMode = "dock-right"
)

func modePhysSize(mode uiMode) (int32, int32) {
	switch mode {
	case modePanel:
		return panelPhysW, panelPhysH
	case modeNotification:
		return notifyPhysW, notifyPhysH
	case modeDockLeft, modeDockRight:
		return dockPhysW, dockPhysH
	default:
		return compactPhysW, compactPhysH
	}
}

// applyMode 把窗口切到目标形态：以当前窗口中心为锚点（dock 贴边除外），
// MoveWindow 原子设置尺寸与位置，记录形态并向前端广播。
func (s *AppService) applyMode(mode uiMode) {
	s.setMode(mode)

	hwnd := s.windowHandle()
	if hwnd == 0 {
		return
	}

	w, h := modePhysSize(mode)
	rect, err := getWindowRect(hwnd)
	if err != nil {
		return
	}
	centerX := rect.Left + (rect.Right-rect.Left)/2
	centerY := rect.Top + (rect.Bottom-rect.Top)/2

	mi, err := monitorWorkArea(centerX, centerY)
	if err != nil {
		return
	}

	var left, top int32
	if mode == modeDockLeft {
		left = mi.RcWork.Left + edgePadding
		top = mi.RcWork.Top + (mi.RcWork.Bottom-mi.RcWork.Top-h)/2
	} else if mode == modeDockRight {
		left = mi.RcWork.Right - w - edgePadding
		top = mi.RcWork.Top + (mi.RcWork.Bottom-mi.RcWork.Top-h)/2
	} else {
		left = centerX - w/2
		top = centerY - h/2
		// 钳制在显示器工作区内。
		if left < mi.RcWork.Left+edgePadding {
			left = mi.RcWork.Left + edgePadding
		}
		if top < mi.RcWork.Top+edgePadding {
			top = mi.RcWork.Top + edgePadding
		}
		if left+w > mi.RcWork.Right-edgePadding {
			left = mi.RcWork.Right - edgePadding - w
		}
		if top+h > mi.RcWork.Bottom-edgePadding {
			top = mi.RcWork.Bottom - edgePadding - h
		}
	}

	moveWindowTo(hwnd, left, top, w, h)
	s.emitMode(mode)
}

// emitMode 向前端广播当前形态。
func (s *AppService) emitMode(mode uiMode) {
	if s.app != nil {
		s.app.Event.Emit(uiModeEventName, string(mode))
	}
}

// TogglePanel 展开/收起面板（前端轻点小球/状态条时调用），返回最终形态。
func (s *AppService) TogglePanel() (string, error) {
	if s.currentMode() == modePanel {
		s.applyMode(modeCompact)
		return string(modeCompact), nil
	}
	s.applyMode(modePanel)
	return string(modePanel), nil
}

// SetNotificationMode 切到通知形态，返回最终形态。
func (s *AppService) SetNotificationMode() (string, error) {
	s.applyMode(modeNotification)
	return string(modeNotification), nil
}

// SetCompactMode 切回紧凑形态，返回最终形态。
func (s *AppService) SetCompactMode() (string, error) {
	s.applyMode(modeCompact)
	return string(modeCompact), nil
}

func (s *AppService) setMode(mode uiMode) {
	s.modeMu.Lock()
	s.mode = mode
	s.modeMu.Unlock()
}

func (s *AppService) currentMode() uiMode {
	s.modeMu.Lock()
	defer s.modeMu.Unlock()
	return s.mode
}
