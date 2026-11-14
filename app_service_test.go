package main

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"paloma/internal/domain"
)

func TestAddTodoConcurrentRequestsPreserveAllTodosWithUniqueIDs(t *testing.T) {
	const count = 250
	service := NewAppService()
	start := make(chan struct{})
	results := make(chan error, count)
	var workers sync.WaitGroup

	for i := 0; i < count; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			<-start
			results <- service.AddTodo(fmt.Sprintf("  待办 %03d  ", i))
		}(i)
	}
	close(start)
	workers.Wait()
	close(results)

	for err := range results {
		if err != nil {
			t.Errorf("AddTodo() error = %v", err)
		}
	}

	todos := service.Snapshot().Todos
	if len(todos) != count {
		t.Fatalf("Snapshot() returned %d todos, want %d", len(todos), count)
	}

	ids := make(map[string]bool, count)
	titles := make(map[string]bool, count)
	for _, todo := range todos {
		if todo.ID == "" || ids[todo.ID] {
			t.Errorf("Snapshot() contains an empty or duplicate todo ID %q", todo.ID)
		}
		ids[todo.ID] = true
		if titles[todo.Title] {
			t.Errorf("Snapshot() contains duplicate todo title %q", todo.Title)
		}
		titles[todo.Title] = true
		if todo.Status != domain.TodoInbox || todo.Source != "manual" {
			t.Errorf("todo %q has status %q and source %q", todo.Title, todo.Status, todo.Source)
		}
	}
	for i := 0; i < count; i++ {
		title := fmt.Sprintf("待办 %03d", i)
		if !titles[title] {
			t.Errorf("Snapshot() is missing todo %q", title)
		}
	}
}

func TestTodoValidationAndCompletion(t *testing.T) {
	service := NewAppService()
	for _, title := range []string{"", " \t\n"} {
		if err := service.AddTodo(title); !errors.Is(err, domain.ErrMissingTodoTitle) {
			t.Errorf("AddTodo(%q) error = %v, want ErrMissingTodoTitle", title, err)
		}
	}
	if got := len(service.Snapshot().Todos); got != 0 {
		t.Fatalf("invalid titles created %d todos", got)
	}

	if err := service.AddTodo("  整理任务  "); err != nil {
		t.Fatalf("AddTodo() error = %v", err)
	}
	todos := service.Snapshot().Todos
	if len(todos) != 1 || todos[0].Title != "整理任务" || todos[0].Status != domain.TodoInbox {
		t.Fatalf("Snapshot().Todos = %+v, want one trimmed inbox todo", todos)
	}
	id := todos[0].ID
	if err := service.CompleteTodo(id); err != nil {
		t.Fatalf("CompleteTodo(%q) error = %v", id, err)
	}
	todos = service.Snapshot().Todos
	if len(todos) != 1 || todos[0].ID != id || todos[0].Status != domain.TodoCompleted {
		t.Fatalf("Snapshot().Todos after completion = %+v", todos)
	}
	if err := service.CompleteTodo("missing"); err == nil {
		t.Fatal("CompleteTodo() for an unknown ID succeeded")
	}
}

func TestTriggerSimulationConcurrentRequestsEmitUniqueEvents(t *testing.T) {
	const count = 250
	service := NewAppService()
	eventStream, unsubscribe := service.bus.Subscribe(count)
	defer unsubscribe()

	start := make(chan struct{})
	results := make(chan error, count)
	var workers sync.WaitGroup
	for i := 0; i < count; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			<-start
			if i%2 == 0 {
				results <- service.TriggerSimulation("zcode", string(domain.StatusRunning))
			} else {
				results <- service.TriggerSimulation("dsh", string(domain.StatusThinking))
			}
		}(i)
	}
	close(start)
	workers.Wait()
	close(results)

	for err := range results {
		if err != nil {
			t.Errorf("TriggerSimulation() error = %v", err)
		}
	}

	ids := make(map[string]bool, count)
	for i := 0; i < count; i++ {
		select {
		case event := <-eventStream:
			if event.ID == "" || ids[event.ID] {
				t.Errorf("event stream contains an empty or duplicate ID %q", event.ID)
			}
			ids[event.ID] = true
			if err := event.Validate(); err != nil {
				t.Errorf("published event %q is invalid: %v", event.ID, err)
			}
		default:
			t.Fatalf("received %d events, want %d", i, count)
		}
	}

	snapshot := service.Snapshot()
	if len(snapshot.Activity) != 30 {
		t.Fatalf("Snapshot().Activity contains %d events, want 30", len(snapshot.Activity))
	}
	if snapshot.Event.ID != snapshot.Activity[0].ID {
		t.Errorf("latest event ID %q differs from first activity ID %q", snapshot.Event.ID, snapshot.Activity[0].ID)
	}
	activityIDs := make(map[string]bool, len(snapshot.Activity))
	for _, event := range snapshot.Activity {
		if !ids[event.ID] || activityIDs[event.ID] {
			t.Errorf("activity ID %q was not published or appears more than once", event.ID)
		}
		activityIDs[event.ID] = true
	}
}

func TestTriggerSimulationKeepsRecentActivitiesInNewestFirstOrder(t *testing.T) {
	const count = 35
	service := NewAppService()
	eventStream, unsubscribe := service.bus.Subscribe(1)
	defer unsubscribe()
	ids := make([]string, 0, count)

	for i := 0; i < count; i++ {
		if err := service.TriggerSimulation("zcode", string(domain.StatusRunning)); err != nil {
			t.Fatalf("TriggerSimulation() call %d error = %v", i, err)
		}
		select {
		case event := <-eventStream:
			ids = append(ids, event.ID)
		default:
			t.Fatalf("TriggerSimulation() call %d did not publish an event", i)
		}
	}

	snapshot := service.Snapshot()
	if len(snapshot.Activity) != 30 {
		t.Fatalf("Snapshot().Activity contains %d events, want 30", len(snapshot.Activity))
	}
	for i, event := range snapshot.Activity {
		if want := ids[count-1-i]; event.ID != want {
			t.Errorf("activity %d has ID %q, want %q", i, event.ID, want)
		}
	}
	if snapshot.Event.ID != ids[count-1] {
		t.Errorf("latest event ID = %q, want %q", snapshot.Event.ID, ids[count-1])
	}
}

func TestTriggerSimulationSupportsDefaultsAndValidStatuses(t *testing.T) {
	tests := []struct {
		name         string
		provider     string
		status       string
		wantProvider string
		wantStatus   domain.AgentStatus
		wantType     domain.EventType
		wantTitle    string
		wantProgress int
		wantAction   bool
	}{
		{"defaults", "", "", "zcode", domain.StatusRunning, domain.EventAgentProgress, "", 42, false},
		{"idle", "dsh", "idle", "dsh", domain.StatusIdle, domain.EventAgentMessage, "当前待机", -1, false},
		{"queued", "zcode", "queued", "zcode", domain.StatusQueued, domain.EventAgentMessage, "", -1, false},
		{"thinking", "zcode", "thinking", "zcode", domain.StatusThinking, domain.EventAgentProgress, "", 58, false},
		{"streaming", "dsh", "streaming", "dsh", domain.StatusStreaming, domain.EventAgentProgress, "", 76, false},
		{"waiting for approval", "zcode", "waiting_approval", "zcode", domain.StatusWaitingApproval, domain.EventAgentWaiting, "", 100, true},
		{"completed", "zcode", "completed", "zcode", domain.StatusCompleted, domain.EventAgentCompleted, "", 100, false},
		{"failed", "dsh", "failed", "dsh", domain.StatusFailed, domain.EventAgentFailed, "", 100, false},
		{"cancelled", "dsh", "cancelled", "dsh", domain.StatusCancelled, domain.EventAgentMessage, "", -1, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service := NewAppService()
			if err := service.TriggerSimulation(test.provider, test.status); err != nil {
				t.Fatalf("TriggerSimulation(%q, %q) error = %v", test.provider, test.status, err)
			}
			snapshot := service.Snapshot()
			event := snapshot.Event
			if event.ProviderID != test.wantProvider || event.Status != test.wantStatus || event.Type != test.wantType {
				t.Errorf("event provider/status/type = %q/%q/%q, want %q/%q/%q", event.ProviderID, event.Status, event.Type, test.wantProvider, test.wantStatus, test.wantType)
			}
			if test.wantTitle != "" && event.Title != test.wantTitle {
				t.Errorf("event title = %q, want %q", event.Title, test.wantTitle)
			}
			if event.RequiresAction != test.wantAction {
				t.Errorf("event RequiresAction = %t, want %t", event.RequiresAction, test.wantAction)
			}
			if test.wantProgress < 0 {
				if event.Progress != nil {
					t.Errorf("event progress = %v, want none", *event.Progress)
				}
			} else if event.Progress == nil || *event.Progress != float64(test.wantProgress) {
				t.Errorf("event progress = %v, want %d", event.Progress, test.wantProgress)
			}
			if len(snapshot.Activity) != 1 || snapshot.Activity[0].ID != event.ID {
				t.Errorf("Snapshot().Activity = %+v, want the latest event", snapshot.Activity)
			}
		})
	}
}

func TestTriggerSimulationRejectsInvalidProviderAndStatus(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		status   string
		wantErr  error
	}{
		{"unknown provider", "other", "running", nil},
		{"whitespace provider", " ", "running", nil},
		{"unknown status", "zcode", "not-a-status", domain.ErrInvalidAgentStatus},
		{"whitespace status", "dsh", " ", domain.ErrInvalidAgentStatus},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service := NewAppService()
			before := service.Snapshot()
			eventStream, unsubscribe := service.bus.Subscribe(1)
			defer unsubscribe()

			err := service.TriggerSimulation(test.provider, test.status)
			if err == nil || (test.wantErr != nil && !errors.Is(err, test.wantErr)) {
				t.Fatalf("TriggerSimulation(%q, %q) error = %v, want rejection", test.provider, test.status, err)
			}
			after := service.Snapshot()
			if after.Event.ID != before.Event.ID || len(after.Activity) != len(before.Activity) {
				t.Errorf("rejected request changed the event snapshot: %+v", after)
			}
			select {
			case event := <-eventStream:
				t.Errorf("rejected request published event %+v", event)
			default:
			}
		})
	}
}

func TestSimulationStartStopAndRestart(t *testing.T) {
	service := NewAppService()
	t.Cleanup(func() {
		if err := service.StopSimulation(); err != nil {
			t.Errorf("cleanup StopSimulation() error = %v", err)
		}
	})
	eventStream, unsubscribe := service.bus.Subscribe(1)
	defer unsubscribe()

	initial := service.Snapshot()
	if !initial.SimulationMode || initial.SimulationActive || initial.Event.Status != domain.StatusIdle {
		t.Fatalf("initial snapshot = %+v", initial)
	}
	if err := service.StopSimulation(); err != nil {
		t.Fatalf("StopSimulation() before start error = %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := service.StartSimulation(); err != nil {
			t.Fatalf("StartSimulation() call %d error = %v", i+1, err)
		}
	}
	if !service.Snapshot().SimulationActive {
		t.Fatal("simulation is not active after starting")
	}

	select {
	case event := <-eventStream:
		if err := event.Validate(); err != nil {
			t.Fatalf("automatic simulation published an invalid event: %v", err)
		}
		if event.ProviderID != "zcode" || event.Status != domain.StatusThinking {
			t.Errorf("first automatic event provider/status = %q/%q", event.ProviderID, event.Status)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("started simulation did not publish an event")
	}

	for i := 0; i < 2; i++ {
		if err := service.StopSimulation(); err != nil {
			t.Fatalf("StopSimulation() call %d error = %v", i+1, err)
		}
	}
	if service.Snapshot().SimulationActive {
		t.Fatal("simulation is still active after stopping")
	}
	if err := service.TriggerSimulation("dsh", string(domain.StatusIdle)); err != nil {
		t.Fatalf("manual simulation after stopping error = %v", err)
	}
	if got := service.Snapshot().Event; got.ProviderID != "dsh" || got.Status != domain.StatusIdle {
		t.Errorf("manual event after stopping = %+v", got)
	}
	if err := service.StartSimulation(); err != nil {
		t.Fatalf("StartSimulation() after stopping error = %v", err)
	}
	if !service.Snapshot().SimulationActive {
		t.Fatal("simulation is not active after restarting")
	}
	if err := service.StopSimulation(); err != nil {
		t.Fatalf("StopSimulation() after restarting error = %v", err)
	}
	if service.Snapshot().SimulationActive {
		t.Fatal("simulation is still active after stopping the restart")
	}
}
