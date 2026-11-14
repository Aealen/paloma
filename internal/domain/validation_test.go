package domain

import (
	"errors"
	"math"
	"testing"
	"time"
)

func validEvent() AgentEvent {
	return AgentEvent{
		SchemaVersion: SchemaVersion,
		ID:            "event-1",
		ProviderID:    "provider-1",
		AgentID:       "agent-1",
		Type:          EventAgentMessage,
		Status:        StatusRunning,
		Title:         "Working",
		CreatedAt:     time.Now(),
	}
}

func TestAgentEventValidateRejectsInvalidFields(t *testing.T) {
	progress := math.NaN()
	tests := []struct {
		name   string
		mutate func(*AgentEvent)
		want   error
	}{
		{"schema version", func(e *AgentEvent) { e.SchemaVersion = "2" }, ErrInvalidSchemaVersion},
		{"event type", func(e *AgentEvent) { e.Type = "unknown" }, ErrInvalidEventType},
		{"status", func(e *AgentEvent) { e.Status = "unknown" }, ErrInvalidAgentStatus},
		{"agent id", func(e *AgentEvent) { e.AgentID = " " }, ErrMissingAgentID},
		{"timestamp", func(e *AgentEvent) { e.CreatedAt = time.Time{} }, ErrMissingEventTimestamp},
		{"nan progress", func(e *AgentEvent) { e.Progress = &progress }, ErrInvalidProgress},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := validEvent()
			tt.mutate(&event)
			if err := event.Validate(); !errors.Is(err, tt.want) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestTodoValidateRequiresIDTitleAndKnownStatus(t *testing.T) {
	tests := []struct {
		name string
		todo Todo
		want error
	}{
		{"id", Todo{Title: "Task", Status: TodoInbox}, ErrMissingTodoID},
		{"title", Todo{ID: "task-1", Title: "  ", Status: TodoInbox}, ErrMissingTodoTitle},
		{"status", Todo{ID: "task-1", Title: "Task", Status: "unknown"}, ErrInvalidTodoStatus},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.todo.Validate(); !errors.Is(err, tt.want) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestAutomationValidateChecksScheduleTimezoneAndAction(t *testing.T) {
	valid := Automation{
		ID: "automation-1", Title: "Reminder", Kind: ScheduleOnce,
		Schedule: "2026-11-13T10:00:00Z", Timezone: "UTC",
		Action: AutomationAction{Kind: "notify"},
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid automation rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*Automation)
		want   error
	}{
		{"kind", func(a *Automation) { a.Kind = "unknown" }, ErrInvalidScheduleKind},
		{"timezone", func(a *Automation) { a.Timezone = "Mars/Olympus" }, ErrInvalidTimezone},
		{"action", func(a *Automation) { a.Action.Kind = " " }, ErrMissingAutomationAction},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			automation := valid
			tt.mutate(&automation)
			if err := automation.Validate(); !errors.Is(err, tt.want) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.want)
			}
		})
	}
}
