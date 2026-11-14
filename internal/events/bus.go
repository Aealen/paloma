package events

import (
	"sync"

	"paloma/internal/domain"
)

type Bus struct {
	mu          sync.RWMutex
	nextID      uint64
	subscribers map[uint64]chan domain.AgentEvent
}

func NewBus() *Bus {
	return &Bus{subscribers: make(map[uint64]chan domain.AgentEvent)}
}

func (b *Bus) Subscribe(buffer int) (<-chan domain.AgentEvent, func()) {
	if buffer < 1 {
		buffer = 1
	}

	b.mu.Lock()
	b.nextID++
	id := b.nextID
	ch := make(chan domain.AgentEvent, buffer)
	b.subscribers[id] = ch
	b.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			b.mu.Lock()
			if subscribed, ok := b.subscribers[id]; ok {
				delete(b.subscribers, id)
				close(subscribed)
			}
			b.mu.Unlock()
		})
	}
	return ch, cancel
}

func (b *Bus) Publish(event domain.AgentEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, subscriber := range b.subscribers {
		select {
		case subscriber <- event:
		default:
		}
	}
}
