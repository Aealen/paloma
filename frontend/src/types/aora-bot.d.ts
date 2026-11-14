import type * as React from 'react'

type AoraBotAttributes = {
  character?: string
  shape?: string
  color?: string
  face?: string
  nose?: string
  state?: string
  'style-id'?: string
  variant?: string
  'style-options'?: string
  seed?: string
  size?: string | number
  'eye-color'?: string
  'badge-color'?: string
  'eye-scale'?: string | number
  'line-weight'?: string | number
  'reduced-motion'?: boolean
  paused?: boolean
  emphasis?: boolean
  antics?: boolean
  'auto-pause'?: boolean
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'aora-bot': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & AoraBotAttributes, HTMLElement>
    }
  }
}

export {}
