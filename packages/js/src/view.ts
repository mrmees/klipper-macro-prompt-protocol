import type { PromptState, PromptStateData, PromptView } from './types.js'

// structuredClone is available in Node ≥17 and all modern browsers;
// TS ships it only inside lib.dom / lib.webworker so we declare it here.
declare function structuredClone<T>(value: T): T

// Canonical semantic view — the conformance/interop/render-source shape.
export function promptView (state: PromptState): PromptView {
  const d = state as unknown as PromptStateData
  return structuredClone({
    visible: d.lifecycle === 'shown',
    title: d.title,
    targets: d.activeTargets,
    size: d.size,
    items: d.items,
    footer_buttons: d.footerButtons
  })
}

// Render-key hint (NOT part of the conformance contract): bumps on each prompt_begin.
export function promptEpoch (state: PromptState): number {
  return (state as unknown as PromptStateData).epoch
}
