import type { PromptState, PromptStateData, PromptView } from './types.js'

// Dependency-free deep clone for the view's plain-JSON structure (nested objects,
// arrays, strings, numbers, booleans, null — no Date/Map/Set/functions ever appear
// in the view). Deliberately avoids structuredClone, which is unavailable on older
// runtimes some consumers still target (e.g. Mainsail's Safari 12 / embedded WebViews)
// and is NOT polyfilled by bundlers (they transpile syntax, not runtime globals).
function deepClone<T> (value: T): T {
  if (Array.isArray(value)) return value.map(deepClone) as unknown as T
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        out[key] = deepClone((value as Record<string, unknown>)[key])
      }
    }
    return out as T
  }
  return value
}

// Canonical semantic view — the conformance/interop/render-source shape.
export function promptView (state: PromptState): PromptView {
  const d = state as unknown as PromptStateData
  return deepClone({
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
