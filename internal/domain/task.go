package domain

import (
	"strings"
	"time"
)

type TodoStatus string

const (
	TodoInbox     TodoStatus = "inbox"
	TodoActive    TodoStatus = "active"
	TodoCompleted TodoStatus = "completed"
	TodoSnoozed   TodoStatus = "snoozed"
	TodoCancelled TodoStatus = "cancelled"
)

type Todo struct {
	ID                   string     `json:"id"`
	Title                string     `json:"title"`
	Description          string     `json:"description,omitempty"`
	Status               TodoStatus `json:"status"`
	DueAt                *time.Time `json:"dueAt,omitempty"`
	Source               string     `json:"source,omitempty"`
	LinkedConversationID string     `json:"linkedConversationId,omitempty"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

func (t Todo) Validate() error {
	if strings.TrimSpace(t.ID) == "" {
		return ErrMissingTodoID
	}
	if strings.TrimSpace(t.Title) == "" {
		return ErrMissingTodoTitle
	}
	switch t.Status {
	case TodoInbox, TodoActive, TodoCompleted, TodoSnoozed, TodoCancelled:
		return nil
	default:
		return ErrInvalidTodoStatus
	}
}

type ScheduleKind string

const (
	ScheduleOnce     ScheduleKind = "once"
	ScheduleInterval ScheduleKind = "interval"
	ScheduleCron     ScheduleKind = "cron"
)

type AutomationAction struct {
	Kind    string         `json:"kind"`
	Payload map[string]any `json:"payload,omitempty"`
}

type Automation struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	Enabled   bool             `json:"enabled"`
	Kind      ScheduleKind     `json:"kind"`
	Schedule  string           `json:"schedule"`
	Timezone  string           `json:"timezone"`
	Action    AutomationAction `json:"action"`
	NextRunAt *time.Time       `json:"nextRunAt,omitempty"`
	LastRunAt *time.Time       `json:"lastRunAt,omitempty"`
}

func (a Automation) Validate() error {
	if strings.TrimSpace(a.ID) == "" {
		return ErrMissingAutomationID
	}
	if strings.TrimSpace(a.Title) == "" {
		return ErrMissingAutomationTitle
	}
	if strings.TrimSpace(a.Schedule) == "" {
		return ErrMissingSchedule
	}
	switch a.Kind {
	case ScheduleOnce, ScheduleInterval, ScheduleCron:
	default:
		return ErrInvalidScheduleKind
	}
	if strings.TrimSpace(a.Timezone) == "" {
		return ErrInvalidTimezone
	}
	if _, err := time.LoadLocation(a.Timezone); err != nil {
		return ErrInvalidTimezone
	}
	if strings.TrimSpace(a.Action.Kind) == "" {
		return ErrMissingAutomationAction
	}
	return nil
}
