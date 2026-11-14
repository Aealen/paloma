package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

// 窗口几何吸附的 Win32 支持。
// 所有坐标均为物理像素：吸附计算直接读窗口真实位置与显示器工作区，
// 再用 MoveWindow 原子设置，完全绕开前端与 Wails API 的 DPI 语义差异。

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	procFindWindow       = user32.NewProc("FindWindowW")
	procGetWindowRect    = user32.NewProc("GetWindowRect")
	procMonitorFromPoint = user32.NewProc("MonitorFromPoint")
	procGetMonitorInfo   = user32.NewProc("GetMonitorInfoW")
	procMoveWindow       = user32.NewProc("MoveWindow")
	procGetDpiForWindow  = user32.NewProc("GetDpiForWindow")
)

type point struct {
	X, Y int32
}

type rect struct {
	Left, Top, Right, Bottom int32
}

type monitorInfo struct {
	CbSize    uint32
	RcMonitor rect
	RcWork    rect
	DwFlags   uint32
}

const (
	monitorDefaultToNearest = 2
	monitorInfoFlagsPrimary = 1
)

func findMainWindow() (uintptr, error) {
	className, _ := syscall.UTF16PtrFromString("WailsWebviewWindow")
	title, _ := syscall.UTF16PtrFromString("Paloma")
	hwnd, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(className)), uintptr(unsafe.Pointer(title)))
	if hwnd == 0 {
		return 0, fmt.Errorf("Paloma window not found")
	}
	return hwnd, nil
}

func getWindowRect(hwnd uintptr) (rect, error) {
	var r rect
	ret, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	if ret == 0 {
		return r, fmt.Errorf("GetWindowRect failed")
	}
	return r, nil
}

func monitorWorkArea(centerX, centerY int32) (monitorInfo, error) {
	var mi monitorInfo
	mi.CbSize = uint32(unsafe.Sizeof(mi))
	pt := point{X: centerX, Y: centerY}
	monitor, _, _ := procMonitorFromPoint.Call(uintptr(unsafe.Pointer(&pt)), monitorDefaultToNearest)
	if monitor == 0 {
		return mi, fmt.Errorf("MonitorFromPoint failed")
	}
	ret, _, _ := procGetMonitorInfo.Call(monitor, uintptr(unsafe.Pointer(&mi)))
	if ret == 0 {
		return mi, fmt.Errorf("GetMonitorInfo failed")
	}
	return mi, nil
}

func moveWindowTo(hwnd uintptr, left, top, width, height int32) {
	procMoveWindow.Call(hwnd, uintptr(left), uintptr(top), uintptr(width), uintptr(height), 1)
}

func windowDPI(hwnd uintptr) int32 {
	ret, _, _ := procGetDpiForWindow.Call(hwnd)
	if ret == 0 {
		return 96
	}
	return int32(ret)
}
