package notify

import "paloma/internal/domain"

type Decision struct {
	ShowBubble       bool `json:"showBubble"`
	ShowSystemNotice bool `json:"showSystemNotice"`
	KeepVisible      bool `json:"keepVisible"`
}

type Policy interface {
	Decide(domain.AgentEvent) Decision
}
