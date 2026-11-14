package domain

import (
	"math"
	"strings"
	"time"
)

const SchemaVersion = "1"

type EventType string

const (
	EventAgentStarted   EventType = "agent.started"
	EventAgentProgress  EventType = "agent.progress"
	EventAgentMessage   EventType = "agent.message"
	EventAgentWaiting   EventType = "agent.waiting"
	EventAgentCompleted EventType = "agent.completed"
	EventAgentFailed    EventType = "agent.failed"
	EventTodoDue        EventType = "todo.due"
	EventScheduleFired  EventType = "schedule.fired"
)

type AgentStatus string

const (
	StatusIdle            AgentStatus = "idle"
	StatusQueued          AgentStatus = "queued"
	StatusRunning         AgentStatus = "running"
	StatusThinking        AgentStatus = "thinking"
	StatusStreaming       AgentStatus = "streaming"
	StatusWaitingApproval AgentStatus = "waiting_approval"
	StatusCompleted       AgentStatus = "completed"
	StatusFailed          AgentStatus = "failed"
	StatusCancelled       AgentStatus = "cancelled"
)

type AgentEvent struct {
	SchemaVersion  string         `json:"schemaVersion"`
	ID             string         `json:"id"`
	ProviderID     string         `json:"providerId"`
	AgentID        string         `json:"agentId"`
	ConversationID string         `json:"conversationId,omitempty"`
	RunID          string         `json:"runId,omitempty"`
	Type           EventType      `json:"type"`
	Status         AgentStatus    `json:"status"`
	Title          string         `json:"title"`
	Content        string         `json:"content,omitempty"`
	Progress       *float64       `json:"progress,omitempty"`
	RequiresAction bool           `json:"requiresAction,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

func (e AgentEvent) Validate() error {
	if strings.TrimSpace(e.ID) == "" {
		return ErrMissingEventID
	}
	if strings.TrimSpace(e.ProviderID) == "" {
		return ErrMissingProviderID
	}
	if strings.TrimSpace(e.AgentID) == "" {
		return ErrMissingAgentID
	}
	if e.SchemaVersion != SchemaVersion {
		return ErrInvalidSchemaVersion
	}
	if !e.Type.IsValid() {
		if e.Type == "" {
			return ErrMissingEventType
		}
		return ErrInvalidEventType
	}
	if !e.Status.IsValid() {
		return ErrInvalidAgentStatus
	}
	if strings.TrimSpace(e.Title) == "" {
		return ErrMissingEventTitle
	}
	if e.CreatedAt.IsZero() {
		return ErrMissingEventTimestamp
	}
	if e.Progress != nil && (math.IsNaN(*e.Progress) || math.IsInf(*e.Progress, 0) || *e.Progress < 0 || *e.Progress > 100) {
		return ErrInvalidProgress
	}
	return nil
}

func (t EventType) IsValid() bool {
	switch t {
	case EventAgentStarted, EventAgentProgress, EventAgentMessage, EventAgentWaiting,
		EventAgentCompleted, EventAgentFailed, EventTodoDue, EventScheduleFired:
		return true
	default:
		return false
	}
}

func (s AgentStatus) IsValid() bool {
	switch s {
	case StatusIdle, StatusQueued, StatusRunning, StatusThinking, StatusStreaming,
		StatusWaitingApproval, StatusCompleted, StatusFailed, StatusCancelled:
		return true
	default:
		return false
	}
}
