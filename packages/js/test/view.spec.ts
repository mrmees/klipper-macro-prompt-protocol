import { describe, it, expect } from 'vitest'
import { initialPromptState, reducePrompt, parseAction, promptView, promptEpoch } from '../src/index'

describe('promptView', () => {
  it('exposes only the canonical shape (no internal fields)', () => {
    let s = initialPromptState({ frontendId: 'mainsail', frontendCategories: ['web'] })
    for (const l of ['// action:prompt_begin T', '// action:prompt_text x', '// action:prompt_show']) {
      const ev = parseAction(l); if (ev) s = reducePrompt(s, ev)
    }
    const v = promptView(s) as any
    expect(Object.keys(v).sort()).toEqual(['footer_buttons', 'items', 'size', 'targets', 'title', 'visible'])
    expect(v.lifecycle).toBeUndefined()
    expect(v.opts).toBeUndefined()
    expect(promptEpoch(s)).toBe(1)
  })
})
