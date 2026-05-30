import { describe, it, expect } from 'vitest'
import doc from '../../../fixtures/fixtures.json'
import { initialPromptState, reducePrompt, parseAction, disconnectEvent, promptView } from '../src/index'

const EXACT_VIEW_KEYS = ['footer_buttons', 'items', 'size', 'targets', 'title', 'visible']

const fixtures = (doc as any).fixtures as Array<{
  id: string; level: 'core' | 'optional'; events: string[]
  expected?: any; expected_by_frontend?: Record<string, any>; skip?: boolean
}>

function runFixture (events: string[], frontendId: string, frontendCategories: string[]) {
  let s = initialPromptState({ frontendId, frontendCategories })
  for (const line of events) {
    const ev = line === '__disconnect__' ? disconnectEvent() : parseAction(line)
    if (ev) s = reducePrompt(s, ev)
  }
  return promptView(s)
}

describe.each(fixtures.filter(f => f.skip !== true))('fixture: $id ($level)', (fx) => {
  if (fx.expected_by_frontend) {
    // Per-frontend: iterate each frontend key in expected_by_frontend
    for (const [frontendKey, expectedForFrontend] of Object.entries(fx.expected_by_frontend)) {
      const frontendCategories = frontendKey === 'klipperscreen' ? ['touch'] : ['web']

      it(`matches expected view for frontend: ${frontendKey}`, () => {
        const view = runFixture(fx.events, frontendKey, frontendCategories)

        // Exact shape: no leaked internal fields
        expect(Object.keys(view).sort()).toEqual(EXACT_VIEW_KEYS)

        // Value conformance (partial: only fields asserted by expected)
        expect(view).toMatchObject(expectedForFrontend)
      })
    }
  } else {
    // Single run with default fluidd/web identity
    it('produces the expected normalized view', () => {
      if (!fx.expected) throw new Error(`fixture ${fx.id} has no expected state`)
      const view = runFixture(fx.events, 'fluidd', ['web'])

      // Exact shape: no leaked internal fields
      expect(Object.keys(view).sort()).toEqual(EXACT_VIEW_KEYS)

      // Value conformance (partial)
      expect(view).toMatchObject(fx.expected)
    })
  }
})
