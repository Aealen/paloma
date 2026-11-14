package agent

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"paloma/internal/domain"
)

type Registry struct {
	mu        sync.RWMutex
	providers map[string]domain.AgentProvider
}

func NewRegistry() *Registry {
	return &Registry{providers: make(map[string]domain.AgentProvider)}
}

func (r *Registry) Register(provider domain.AgentProvider) error {
	if provider == nil {
		return ErrNilProvider
	}
	manifest := provider.Manifest()
	if strings.TrimSpace(manifest.ID) == "" {
		return ErrMissingProviderID
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.providers[manifest.ID]; exists {
		return fmt.Errorf("%w: %q", ErrDuplicateProvider, manifest.ID)
	}
	r.providers[manifest.ID] = provider
	return nil
}

func (r *Registry) Manifests() []domain.ProviderManifest {
	r.mu.RLock()
	providers := make([]domain.AgentProvider, 0, len(r.providers))
	for _, provider := range r.providers {
		providers = append(providers, provider)
	}
	r.mu.RUnlock()

	manifests := make([]domain.ProviderManifest, 0, len(providers))
	for _, provider := range providers {
		manifests = append(manifests, provider.Manifest())
	}
	sort.Slice(manifests, func(i, j int) bool { return manifests[i].ID < manifests[j].ID })
	return manifests
}

func (r *Registry) Connect(ctx context.Context, providerID string, config domain.ProviderConfig) (domain.AgentRuntime, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	provider, ok := r.providers[providerID]
	r.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotRegistered, providerID)
	}

	runtime, err := provider.Connect(ctx, config)
	if err != nil {
		return nil, err
	}
	if runtime == nil {
		return nil, ErrNilRuntime
	}
	return runtime, nil
}

type SimulatedProvider struct {
	manifest domain.ProviderManifest
}

func NewSimulatedProvider(id, displayName string) *SimulatedProvider {
	return &SimulatedProvider{manifest: domain.ProviderManifest{
		ID:              id,
		DisplayName:     displayName,
		ProtocolVersion: domain.SchemaVersion,
		Transports:      []domain.Transport{domain.TransportEmbedded},
		Capabilities:    []domain.Capability{domain.CapabilityHealth},
	}}
}

func (p *SimulatedProvider) Manifest() domain.ProviderManifest {
	manifest := p.manifest
	manifest.Transports = append([]domain.Transport(nil), p.manifest.Transports...)
	manifest.Capabilities = append([]domain.Capability(nil), p.manifest.Capabilities...)
	return manifest
}

func (p *SimulatedProvider) Connect(ctx context.Context, _ domain.ProviderConfig) (domain.AgentRuntime, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	manifest := p.Manifest()
	if strings.TrimSpace(manifest.ID) == "" {
		return nil, ErrMissingProviderID
	}
	return &SimulatedRuntime{
		providerID: manifest.ID,
		events:     make(chan domain.AgentEvent, 16),
	}, nil
}

type SimulatedRuntime struct {
	mu         sync.RWMutex
	providerID string
	running    bool
	sequence   uint64
	events     chan domain.AgentEvent
}

func (r *SimulatedRuntime) Start(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	r.running = true
	r.mu.Unlock()
	return nil
}

func (r *SimulatedRuntime) Stop(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	r.running = false
	r.mu.Unlock()
	return nil
}

func (r *SimulatedRuntime) Send(ctx context.Context, request domain.RunRequest) (domain.RunHandle, error) {
	if err := ctx.Err(); err != nil {
		return domain.RunHandle{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.running {
		return domain.RunHandle{}, ErrRuntimeNotRunning
	}
	if err := ctx.Err(); err != nil {
		return domain.RunHandle{}, err
	}

	r.sequence++
	runID := fmt.Sprintf("demo-run-%03d", r.sequence)
	now := time.Now().UTC()
	progress := 0.0
	event := domain.AgentEvent{
		SchemaVersion: domain.SchemaVersion,
		ID:            fmt.Sprintf("%s-event-%03d", runID, r.sequence),
		ProviderID:    r.providerID,
		AgentID:       r.providerID + "-agent",
		RunID:         runID,
		Type:          domain.EventAgentStarted,
		Status:        domain.StatusRunning,
		Title:         "Agent started",
		Content:       request.Prompt,
		Progress:      &progress,
		CreatedAt:     now,
	}
	if err := event.Validate(); err != nil {
		return domain.RunHandle{}, err
	}

	select {
	case r.events <- event:
		return domain.RunHandle{RunID: runID}, nil
	case <-ctx.Done():
		return domain.RunHandle{}, ctx.Err()
	default:
		return domain.RunHandle{}, ErrRuntimeBufferFull
	}
}

func (r *SimulatedRuntime) Cancel(ctx context.Context, _ string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return ErrUnsupportedCapability
}

func (r *SimulatedRuntime) Subscribe() <-chan domain.AgentEvent { return r.events }

func (r *SimulatedRuntime) Health(ctx context.Context) domain.HealthStatus {
	if err := ctx.Err(); err != nil {
		return domain.HealthStatus{Connected: false, Message: err.Error()}
	}
	r.mu.RLock()
	running := r.running
	r.mu.RUnlock()
	if !running {
		return domain.HealthStatus{Connected: false, Message: "stopped"}
	}
	return domain.HealthStatus{Connected: true, Message: "simulation"}
}
