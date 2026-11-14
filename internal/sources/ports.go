package sources

import (
	"context"

	"paloma/internal/domain"
)

type Source interface {
	ID() string
	Start(context.Context, func(domain.AgentEvent) error) error
	Stop(context.Context) error
}

type WebhookConfig struct {
	BindAddress       string `json:"bindAddress"`
	Path              string `json:"path"`
	SecretConfigured  bool   `json:"secretConfigured"`
	SignatureRequired bool   `json:"signatureRequired"`
}
