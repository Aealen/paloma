package domain

import "errors"

var (
	ErrMissingEventID          = errors.New("event id is required")
	ErrMissingProviderID       = errors.New("provider id is required")
	ErrMissingAgentID          = errors.New("agent id is required")
	ErrMissingEventType        = errors.New("event type is required")
	ErrInvalidEventType        = errors.New("event type is invalid")
	ErrInvalidSchemaVersion    = errors.New("event schema version is invalid")
	ErrInvalidAgentStatus      = errors.New("agent status is invalid")
	ErrMissingEventTitle       = errors.New("event title is required")
	ErrMissingEventTimestamp   = errors.New("event timestamp is required")
	ErrInvalidProgress         = errors.New("progress must be a finite number between 0 and 100")
	ErrMissingTodoID           = errors.New("todo id is required")
	ErrMissingTodoTitle        = errors.New("todo title is required")
	ErrInvalidTodoStatus       = errors.New("todo status is invalid")
	ErrDuplicateTodoID         = errors.New("todo id already exists")
	ErrTodoNotFound            = errors.New("todo does not exist")
	ErrMissingAutomationID     = errors.New("automation id is required")
	ErrMissingScheduleID       = ErrMissingAutomationID
	ErrDuplicateAutomationID   = errors.New("automation id already exists")
	ErrMissingAutomationTitle  = errors.New("automation title is required")
	ErrMissingSchedule         = errors.New("schedule is required")
	ErrInvalidScheduleKind     = errors.New("schedule kind is invalid")
	ErrInvalidTimezone         = errors.New("timezone is invalid")
	ErrMissingAutomationAction = errors.New("automation action kind is required")
)
