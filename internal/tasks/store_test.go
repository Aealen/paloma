package tasks

import (
	"errors"
	"testing"
	"time"

	"paloma/internal/domain"
)

func validTodo(id string) domain.Todo {
	now := time.Now()
	return domain.Todo{ID: id, Title: "Task", Status: domain.TodoInbox, CreatedAt: now, UpdatedAt: now}
}

func validAutomation(id string) domain.Automation {
	return domain.Automation{
		ID: id, Title: "Reminder", Kind: domain.ScheduleOnce,
		Schedule: "2026-11-13T10:00:00Z", Timezone: "UTC",
		Action: domain.AutomationAction{Kind: "notify"},
	}
}

func TestMemoryStoreCreateAndUpdateTodo(t *testing.T) {
	store := NewMemoryStore()
	if err := store.Create(domain.Todo{Title: "Missing ID", Status: domain.TodoInbox}); !errors.Is(err, domain.ErrMissingTodoID) {
		t.Fatalf("Create() invalid todo error = %v", err)
	}
	original := validTodo("todo-1")
	if err := store.Create(original); err != nil {
		t.Fatal(err)
	}
	if err := store.Create(original); !errors.Is(err, domain.ErrDuplicateTodoID) {
		t.Fatalf("Create() duplicate error = %v", err)
	}
	updated := original
	updated.Title = "Updated"
	if err := store.Update(updated); err != nil {
		t.Fatalf("Update() existing todo error = %v", err)
	}
	if got := store.List(); len(got) != 1 || got[0].Title != "Updated" {
		t.Fatalf("List() = %+v", got)
	}
	if err := store.Update(validTodo("missing")); !errors.Is(err, domain.ErrTodoNotFound) {
		t.Fatalf("Update() missing todo error = %v", err)
	}
}

func TestMemoryStoreAutomationRepositoryMethods(t *testing.T) {
	var repository AutomationRepository = NewMemoryStore()
	automation := validAutomation("automation-1")
	if err := repository.CreateAutomation(automation); err != nil {
		t.Fatal(err)
	}
	if err := repository.CreateAutomation(automation); !errors.Is(err, domain.ErrDuplicateAutomationID) {
		t.Fatalf("CreateAutomation() duplicate error = %v", err)
	}
	if got := repository.ListAutomations(); len(got) != 1 || got[0].ID != automation.ID {
		t.Fatalf("ListAutomations() = %+v", got)
	}
}
