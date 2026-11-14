package agent

import (
	"context"
	"fmt"
	"sync"
	"time"

	"paloma/internal/domain"
)

type MockSource struct {
	mu       sync.Mutex
	running  bool
	sequence uint64
	interval time.Duration
	cancel   context.CancelFunc
	done     chan struct{}
}

func NewMockSource() *MockSource { return &MockSource{interval: 7 * time.Second} }

func (s *MockSource) ID() string { return "mock-events" }

func (s *MockSource) Start(ctx context.Context, emit func(domain.AgentEvent) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if emit == nil {
		return ErrNilEventHandler
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return ErrSourceAlreadyRunning
	}
	interval := s.interval
	if interval <= 0 {
		interval = 7 * time.Second
	}
	runCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	s.running = true
	s.cancel = cancel
	s.done = done
	s.mu.Unlock()

	go s.run(runCtx, done, emit, interval)
	return nil
}

func (s *MockSource) run(ctx context.Context, done chan struct{}, emit func(domain.AgentEvent) error, interval time.Duration) {
	defer func() {
		s.mu.Lock()
		if s.done == done {
			s.running = false
			s.cancel = nil
			s.done = nil
		}
		close(done)
		s.mu.Unlock()
	}()

	states := []struct {
		provider string
		typeName domain.EventType
		status   domain.AgentStatus
		title    string
		content  string
		progress float64
	}{
		{"zcode", domain.EventAgentProgress, domain.StatusThinking, "正在理解仓库结构", "ZCode 已开始整理 Paloma 工程概况", 38},
		{"dsh", domain.EventAgentProgress, domain.StatusStreaming, "正在分析实现方案", "DSH 正在检查 Agent 接入边界", 72},
		{"zcode", domain.EventAgentWaiting, domain.StatusWaitingApproval, "有一项操作等待确认", "请检查 Agent 发起的操作", 100},
		{"dsh", domain.EventAgentCompleted, domain.StatusCompleted, "桌面端视觉方向已整理", "桌面状态与任务面板共用统一事件模型", 100},
		{"zcode", domain.EventAgentFailed, domain.StatusFailed, "示例异常通知", "这是一条用于验证错误态的模拟事件", 100},
		{"zcode", domain.EventAgentStarted, domain.StatusRunning, "开始新的工作", "模拟事件循环已重新开始", 5},
	}

	for {
		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}

		sequence := s.nextSequence()
		state := states[(sequence-1)%uint64(len(states))]
		progress := state.progress
		event := domain.AgentEvent{
			SchemaVersion:  domain.SchemaVersion,
			ID:             fmt.Sprintf("mock-%d", sequence),
			ProviderID:     state.provider,
			AgentID:        state.provider + "-primary",
			ConversationID: state.provider + "-demo-conversation",
			RunID:          fmt.Sprintf("%s-run-%d", state.provider, sequence),
			Type:           state.typeName,
			Status:         state.status,
			Title:          state.title,
			Content:        state.content,
			Progress:       &progress,
			RequiresAction: state.status == domain.StatusWaitingApproval,
			CreatedAt:      time.Now().UTC(),
		}
		if err := event.Validate(); err != nil {
			return
		}
		if err := emit(event); err != nil || ctx.Err() != nil {
			return
		}
	}
}

func (s *MockSource) nextSequence() uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sequence++
	return s.sequence
}

func (s *MockSource) Stop(ctx context.Context) error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return nil
	}
	cancel := s.cancel
	done := s.done
	cancel()
	s.mu.Unlock()

	if err := ctx.Err(); err != nil {
		return err
	}
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
