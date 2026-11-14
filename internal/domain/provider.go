package domain

import "context"

type Transport string

const (
	TransportEmbedded  Transport = "embedded"
	TransportStdio     Transport = "stdio"
	TransportHTTP      Transport = "http"
	TransportWebSocket Transport = "websocket"
)

type Capability string

const (
	CapabilityChat     Capability = "chat"
	CapabilityStream   Capability = "stream"
	CapabilityCancel   Capability = "cancel"
	CapabilityApproval Capability = "approval"
	CapabilityTool     Capability = "tool"
	CapabilityUsage    Capability = "usage"
	CapabilityFiles    Capability = "files"
	CapabilitySchedule Capability = "schedule"
	CapabilityHealth   Capability = "health"
)

type ProviderManifest struct {
	ID              string       `json:"id"`
	DisplayName     string       `json:"displayName"`
	ProtocolVersion string       `json:"protocolVersion"`
	Transports      []Transport  `json:"transports"`
	Capabilities    []Capability `json:"capabilities"`
	ConfigSchema    any          `json:"configSchema,omitempty"`
}

func (m ProviderManifest) HasCapability(capability Capability) bool {
	for _, candidate := range m.Capabilities {
		if candidate == capability {
			return true
		}
	}
	return false
}

type ProviderConfig map[string]any

type RunRequest struct {
	ConversationID string         `json:"conversationId,omitempty"`
	Prompt         string         `json:"prompt"`
	Context        map[string]any `json:"context,omitempty"`
}

type RunHandle struct {
	RunID string `json:"runId"`
}

type HealthStatus struct {
	Connected bool   `json:"connected"`
	Message   string `json:"message,omitempty"`
}

type AgentRuntime interface {
	Start(context.Context) error
	Stop(context.Context) error
	Send(context.Context, RunRequest) (RunHandle, error)
	Cancel(context.Context, string) error
	Subscribe() <-chan AgentEvent
	Health(context.Context) HealthStatus
}

type AgentProvider interface {
	Manifest() ProviderManifest
	Connect(context.Context, ProviderConfig) (AgentRuntime, error)
}

type EventSource interface {
	ID() string
	Start(context.Context, func(AgentEvent) error) error
	Stop(context.Context) error
}
