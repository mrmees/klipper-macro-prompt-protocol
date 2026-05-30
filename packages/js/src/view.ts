import type { PromptState, PromptStateData, PromptView } from './types'

// Canonical semantic view — the conformance/interop/render-source shape.
export function promptView (state: PromptState): PromptView {
  const d = state as PromptStateData
  return {
    visible: d.lifecycle === 'shown',
    title: d.title,
    targets: d.activeTargets.slice(),
    size: d.size,
    items: d.items.slice(),
    footer_buttons: d.footerButtons.slice()
  }
}

// Render-key hint (NOT part of the conformance contract): bumps on each prompt_begin.
export function promptEpoch (state: PromptState): number {
  return (state as PromptStateData).epoch
}
