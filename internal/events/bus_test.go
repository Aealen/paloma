package events

import (
	"sync"
	"testing"

	"paloma/internal/domain"
)

func TestUnsubscribeIsSafeWhilePublishing(t *testing.T) {
	bus := NewBus()
	_, unsubscribe := bus.Subscribe(1)
	var publishers sync.WaitGroup
	publishers.Add(4)
	for i := 0; i < 4; i++ {
		go func() {
			defer publishers.Done()
			for j := 0; j < 1000; j++ {
				bus.Publish(domain.AgentEvent{ID: "event"})
			}
		}()
	}
	unsubscribe()
	unsubscribe()
	publishers.Wait()
}
