package agent

import (
	"context"
	"errors"
	"testing"
	"time"

	"paloma/internal/domain"
)

func TestRegistryRejectsNilDuplicateAndUnknownProviders(t *testing.T) {
	registry := NewRegistry()
	if err := registry.Register(nil); !errors.Is(err, ErrNilProvider) {
		t.Fatalf("Register(nil) error = %v", err)
	}
	provider := NewSimulatedProvider("demo", "Demo")
	if err := registry.Register(provider); err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if err := registry.Register(provider); !errors.Is(err, ErrDuplicateProvider) {
		t.Fatalf("duplicate Register() error = %v", err)
	}
	if _, err := registry.Connect(context.Background(), "missing", nil); !errors.Is(err, ErrProviderNotRegistered) {
		t.Fatalf("unknown Connect() error = %v", err)
	}
	if _, err := registry.Connect(context.Background(), "demo", nil); err != nil {
		t.Fatalf("registered Connect() error = %v", err)
	}
}

func TestSimulatedRuntimeLifecycleBackpressureAndCapabilities(t *testing.T) {
	provider := NewSimulatedProvider("demo", "Demo")
	for _, unsupported := range []domain.Capability{domain.CapabilityChat, domain.CapabilityStream, domain.CapabilityCancel} {
		if provider.Manifest().HasCapability(unsupported) {
			t.Fatalf("simulated provider falsely advertises %q", unsupported)
		}
	}
	runtime, err := provider.Connect(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := runtime.Send(context.Background(), domain.RunRequest{Prompt: "hello"}); !errors.Is(err, ErrRuntimeNotRunning) {
		t.Fatalf("Send before Start() error = %v", err)
	}
	if err := runtime.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 16; i++ {
		if _, err := runtime.Send(context.Background(), domain.RunRequest{Prompt: "hello"}); err != nil {
			t.Fatalf("Send(%d) error = %v", i, err)
		}
	}
	if _, err := runtime.Send(context.Background(), domain.RunRequest{Prompt: "overflow"}); !errors.Is(err, ErrRuntimeBufferFull) {
		t.Fatalf("Send with full buffer error = %v", err)
	}
	if err := runtime.Cancel(context.Background(), "demo-run-001"); !errors.Is(err, ErrUnsupportedCapability) {
		t.Fatalf("Cancel() error = %v", err)
	}
	if err := runtime.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	if health := runtime.Health(context.Background()); health.Connected {
		t.Fatalf("Health after Stop() = %+v", health)
	}
	if _, err := runtime.Send(context.Background(), domain.RunRequest{}); !errors.Is(err, ErrRuntimeNotRunning) {
		t.Fatalf("Send after Stop() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := runtime.Start(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("Start with canceled context error = %v", err)
	}
}

func TestSimulatedRuntimeSendHonorsCanceledContext(t *testing.T) {
	runtime, err := NewSimulatedProvider("demo", "Demo").Connect(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := runtime.Send(ctx, domain.RunRequest{}); !errors.Is(err, context.Canceled) {
		t.Fatalf("Send() error = %v, want context.Canceled", err)
	}
}

func TestMockSourceLifecycleAndCancellation(t *testing.T) {
	source := NewMockSource()
	source.interval = time.Millisecond
	started := make(chan struct{}, 1)
	if err := source.Start(context.Background(), func(domain.AgentEvent) error {
		select {
		case started <- struct{}{}:
		default:
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if err := source.Start(context.Background(), func(domain.AgentEvent) error { return nil }); !errors.Is(err, ErrSourceAlreadyRunning) {
		t.Fatalf("duplicate Start() error = %v", err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("source did not emit an event")
	}
	if err := source.Stop(context.Background()); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
	if err := source.Stop(context.Background()); err != nil {
		t.Fatalf("repeated Stop() error = %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := source.Start(ctx, func(domain.AgentEvent) error { return nil }); !errors.Is(err, context.Canceled) {
		t.Fatalf("Start() with canceled context error = %v", err)
	}
}
