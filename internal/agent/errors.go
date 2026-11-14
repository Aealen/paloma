package agent

import "errors"

var (
	ErrNilProvider           = errors.New("provider is nil")
	ErrMissingProviderID     = errors.New("provider manifest id is required")
	ErrDuplicateProvider     = errors.New("provider is already registered")
	ErrProviderNotRegistered = errors.New("provider is not registered")
	ErrNilRuntime            = errors.New("provider returned a nil runtime")
	ErrRuntimeNotRunning     = errors.New("provider is not running")
	ErrRuntimeBufferFull     = errors.New("runtime event buffer is full")
	ErrUnsupportedCapability = errors.New("capability is not supported by the simulated provider")
	ErrSourceAlreadyRunning  = errors.New("event source is already running")
	ErrNilEventHandler       = errors.New("event handler is nil")
)
