package scheduler

import (
	"context"

	"paloma/internal/domain"
)

type Scheduler interface {
	Add(context.Context, domain.Automation) error
	Remove(context.Context, string) error
	Start(context.Context) error
	Stop(context.Context) error
}
