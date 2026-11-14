package main

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"paloma/internal/agent"
	"paloma/internal/domain"
	"paloma/internal/events"
	"paloma/internal/tasks"
)

const agentEventName = "paloma:agent-event"
const uiModeEventName = "paloma:mode"

type AppService struct {
	app       *application.App
	bus       *events.Bus
	registry  *agent.Registry
	source    *agent.MockSource
	store     *tasks.MemoryStore
	mu        sync.RWMutex
	latest    domain.AgentEvent
	activity  []domain.AgentEvent
	simMu     sync.Mutex
	simActive bool
	sequence  atomic.Uint64
	hwnd      uintptr
	modeMu    sync.Mutex
	mode      uiMode
}

func (s *AppService) windowHandle() uintptr {
	if s.hwnd != 0 {
		return s.hwnd
	}
	// 惰性获取：窗口句柄在 Run 之后才真正存在，首次结算时缓存。
	if hwnd, err := findMainWindow(); err == nil {
		s.hwnd = hwnd
	}
	return s.hwnd
}

type AppSnapshot struct {
	Event            domain.AgentEvent         `json:"event"`
	Activity         []domain.AgentEvent       `json:"activity"`
	Providers        []domain.ProviderManifest `json:"providers"`
	Todos            []domain.Todo             `json:"todos"`
	Automations      []domain.Automation       `json:"automations"`
	SimulationMode   bool                      `json:"simulationMode"`
	SimulationActive bool                      `json:"simulationActive"`
}

func NewAppService() *AppService {
	registry := agent.NewRegistry()
	_ = registry.Register(agent.NewSimulatedProvider("zcode", "ZCode"))
	_ = registry.Register(agent.NewSimulatedProvider("dsh", "DSH"))

	return &AppService{
		bus:      events.NewBus(),
		registry: registry,
		source:   agent.NewMockSource(),
		store:    tasks.NewMemoryStore(),
		latest: domain.AgentEvent{
			SchemaVersion: domain.SchemaVersion,
			ID:            "initial",
			ProviderID:    "paloma",
			AgentID:       "paloma",
			Type:          domain.EventAgentMessage,
			Status:        domain.StatusIdle,
			Title:         "Paloma 已准备好",
			Content:       "等待 ZCode 或 DSH 的下一条活动",
			CreatedAt:     time.Now().UTC(),
		},
	}
}

func (s *AppService) attach(app *application.App) {
	s.app = app
}

// StartSimulation 开始产生演示事件，重复调用不会重复启动。
func (s *AppService) StartSimulation() error {
	s.simMu.Lock()
	defer s.simMu.Unlock()
	if s.simActive {
		return nil
	}
	if err := s.source.Start(context.Background(), s.publish); err != nil {
		return err
	}
	s.simActive = true
	return nil
}

// StopSimulation 停止自动演示；手动状态预览仍然可用。
func (s *AppService) StopSimulation() error {
	return s.stopSimulation()
}

func (s *AppService) stopSimulation() error {
	s.simMu.Lock()
	defer s.simMu.Unlock()
	if !s.simActive {
		return nil
	}
	if err := s.source.Stop(context.Background()); err != nil {
		return err
	}
	s.simActive = false
	return nil
}

func (s *AppService) TriggerSimulation(providerID string, statusName string) error {
	if providerID == "" {
		providerID = "zcode"
	}
	if statusName == "" {
		statusName = string(domain.StatusRunning)
	}
	if providerID != "zcode" && providerID != "dsh" {
		return fmt.Errorf("不支持的模拟来源: %s", providerID)
	}
	status := domain.AgentStatus(statusName)
	event := domain.AgentEvent{
		SchemaVersion:  domain.SchemaVersion,
		ID:             fmt.Sprintf("manual-%d", s.sequence.Add(1)),
		ProviderID:     providerID,
		AgentID:        providerID + "-manual",
		RunID:          "manual-run",
		Type:           eventTypeForStatus(status),
		Status:         status,
		Title:          titleForStatus(status),
		Content:        contentForStatus(status),
		RequiresAction: status == domain.StatusWaitingApproval,
		CreatedAt:      time.Now().UTC(),
	}
	if progress := progressForStatus(status); progress >= 0 {
		event.Progress = &progress
	}
	return s.publish(event)
}

func (s *AppService) Snapshot() AppSnapshot {
	s.mu.RLock()
	event := s.latest
	activity := append([]domain.AgentEvent{}, s.activity...)
	s.mu.RUnlock()
	s.simMu.Lock()
	simActive := s.simActive
	s.simMu.Unlock()
	return AppSnapshot{
		Event:            event,
		Activity:         activity,
		Providers:        s.registry.Manifests(),
		Todos:            s.store.List(),
		Automations:      s.store.ListAutomations(),
		SimulationMode:   true,
		SimulationActive: simActive,
	}
}

func (s *AppService) AddTodo(title string) error {
	now := time.Now().UTC()
	return s.store.Create(domain.Todo{
		ID:        fmt.Sprintf("todo-%d", s.sequence.Add(1)),
		Title:     strings.TrimSpace(title),
		Status:    domain.TodoInbox,
		Source:    "manual",
		CreatedAt: now,
		UpdatedAt: now,
	})
}

func (s *AppService) CompleteTodo(id string) error {
	todos := s.store.List()
	for _, todo := range todos {
		if todo.ID == id {
			todo.Status = domain.TodoCompleted
			todo.UpdatedAt = time.Now().UTC()
			return s.store.Update(todo)
		}
	}
	return fmt.Errorf("todo %q does not exist", id)
}

func (s *AppService) publish(event domain.AgentEvent) error {
	if err := event.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	s.latest = event
	s.activity = append([]domain.AgentEvent{event}, s.activity...)
	if len(s.activity) > 30 {
		s.activity = s.activity[:30]
	}
	s.mu.Unlock()
	s.bus.Publish(event)
	if s.app != nil {
		s.app.Event.Emit(agentEventName, event)
	}
	return nil
}

func eventTypeForStatus(status domain.AgentStatus) domain.EventType {
	switch status {
	case domain.StatusWaitingApproval:
		return domain.EventAgentWaiting
	case domain.StatusCompleted:
		return domain.EventAgentCompleted
	case domain.StatusFailed:
		return domain.EventAgentFailed
	case domain.StatusThinking, domain.StatusStreaming, domain.StatusRunning:
		return domain.EventAgentProgress
	default:
		return domain.EventAgentMessage
	}
}

func titleForStatus(status domain.AgentStatus) string {
	switch status {
	case domain.StatusIdle:
		return "当前待机"
	case domain.StatusThinking:
		return "正在思考下一步"
	case domain.StatusStreaming:
		return "正在输出回复"
	case domain.StatusWaitingApproval:
		return "等你确认一项操作"
	case domain.StatusCompleted:
		return "任务顺利完成"
	case domain.StatusFailed:
		return "刚刚遇到一个问题"
	default:
		return "Agent 正在工作"
	}
}

func contentForStatus(status domain.AgentStatus) string {
	switch status {
	case domain.StatusWaitingApproval:
		return "展开 Paloma 查看需要确认的内容"
	case domain.StatusCompleted:
		return "这条消息来自模拟事件，用于验证完成态"
	case domain.StatusFailed:
		return "这条消息来自模拟事件，用于验证错误态"
	default:
		return "这条消息来自模拟事件"
	}
}

func progressForStatus(status domain.AgentStatus) float64 {
	switch status {
	case domain.StatusRunning:
		return 42
	case domain.StatusThinking:
		return 58
	case domain.StatusStreaming:
		return 76
	case domain.StatusWaitingApproval, domain.StatusCompleted, domain.StatusFailed:
		return 100
	default:
		return -1
	}
}
