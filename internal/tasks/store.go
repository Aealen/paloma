package tasks

import (
	"fmt"
	"sort"
	"sync"

	"paloma/internal/domain"
)

type TodoRepository interface {
	Create(domain.Todo) error
	List() []domain.Todo
	Update(domain.Todo) error
}

type AutomationRepository interface {
	CreateAutomation(domain.Automation) error
	ListAutomations() []domain.Automation
}

type MemoryStore struct {
	mu          sync.RWMutex
	todos       map[string]domain.Todo
	automations map[string]domain.Automation
}

var (
	_ TodoRepository       = (*MemoryStore)(nil)
	_ AutomationRepository = (*MemoryStore)(nil)
)

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		todos:       make(map[string]domain.Todo),
		automations: make(map[string]domain.Automation),
	}
}

func (s *MemoryStore) Create(todo domain.Todo) error {
	if err := todo.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.todos[todo.ID]; exists {
		return fmt.Errorf("%w: %q", domain.ErrDuplicateTodoID, todo.ID)
	}
	s.todos[todo.ID] = todo
	return nil
}

func (s *MemoryStore) List() []domain.Todo {
	s.mu.RLock()
	items := make([]domain.Todo, 0, len(s.todos))
	for _, todo := range s.todos {
		items = append(items, todo)
	}
	s.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool { return items[i].UpdatedAt.After(items[j].UpdatedAt) })
	return items
}

func (s *MemoryStore) Update(todo domain.Todo) error {
	if err := todo.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.todos[todo.ID]; !ok {
		return fmt.Errorf("%w: %q", domain.ErrTodoNotFound, todo.ID)
	}
	s.todos[todo.ID] = todo
	return nil
}

func (s *MemoryStore) CreateAutomation(automation domain.Automation) error {
	if err := automation.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.automations[automation.ID]; exists {
		return fmt.Errorf("%w: %q", domain.ErrDuplicateAutomationID, automation.ID)
	}
	s.automations[automation.ID] = automation
	return nil
}

func (s *MemoryStore) ListAutomations() []domain.Automation {
	s.mu.RLock()
	items := make([]domain.Automation, 0, len(s.automations))
	for _, automation := range s.automations {
		items = append(items, automation)
	}
	s.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool { return items[i].Title < items[j].Title })
	return items
}
