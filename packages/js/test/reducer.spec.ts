import { describe, it, expect } from 'vitest'
import { initialPromptState, reducePrompt } from '../src/reducer'
import { parseAction, disconnectEvent } from '../src/parse-action'
import { promptView } from '../src/view'
import type { EngineOptions } from '../src/types'

const OPTS: EngineOptions = { frontendId: 'mainsail', frontendCategories: ['web'] }
function run (lines: string[], opts: EngineOptions = OPTS) {
  let s = initialPromptState(opts)
  for (const l of lines) {
    const ev = l === '__disconnect__' ? disconnectEvent() : parseAction(l)
    if (ev) s = reducePrompt(s, ev)
  }
  return s
}

describe('reducer lifecycle', () => {
  it('builds, shows, and ends a prompt', () => {
    const v = promptView(run([
      '// action:prompt_begin Hi', '// action:prompt_text One', '// action:prompt_show'
    ]))
    expect(v).toMatchObject({ visible: true, title: 'Hi', items: [{ type: 'text', text: 'One' }] })
    const ended = promptView(run([
      '// action:prompt_begin Hi', '// action:prompt_show', '// action:prompt_end'
    ]))
    expect(ended).toMatchObject({ visible: false, title: '', items: [] })
  })

  it('ignores content before begin; show before begin is a no-op', () => {
    expect(promptView(run(['// action:prompt_text x', '// action:prompt_show'])))
      .toMatchObject({ visible: false, items: [] })
  })
})

describe('reducer live-append', () => {
  const seq = ['// action:prompt_begin T', '// action:prompt_text A', '// action:prompt_show', '// action:prompt_text B']
  it('appends post-show content by default', () => {
    expect(promptView(run(seq)).items).toHaveLength(2)
  })
  it('snapshots when liveAppend is false', () => {
    expect(promptView(run(seq, { ...OPTS, liveAppend: false })).items).toHaveLength(1)
  })
})

describe('reducer targeting + size', () => {
  it('suppresses a non-matching prompt but still consumes pending size', () => {
    const s = run([
      '// action:prompt_size large', '// action:prompt_target fluidd',
      '// action:prompt_begin X', '// action:prompt_text hidden', '// action:prompt_show'
    ])
    expect(promptView(s).visible).toBe(false)
    // pending size consumed (not leaked to a later prompt)
    const s2 = reducePrompt(s, parseAction('// action:prompt_begin Y')!)
    expect(promptView(s2).size).toBeNull()
  })
  it('empty target list suppresses for target-aware frontends', () => {
    expect(promptView(run([
      '// action:prompt_target   ', '// action:prompt_begin X', '// action:prompt_show'
    ])).visible).toBe(false)
  })
})

describe('reducer containers', () => {
  it('groups buttons and rows', () => {
    const v = promptView(run([
      '// action:prompt_begin G',
      '// action:prompt_button_group_start',
      '// action:prompt_button +1|_J1', '// action:prompt_button -1|_J2',
      '// action:prompt_button_group_end',
      '// action:prompt_show'
    ]))
    expect(v.items).toEqual([
      { type: 'button_group', children: [
        { type: 'button', label: '+1', gcode: '_J1', style: 'secondary' },
        { type: 'button', label: '-1', gcode: '_J2', style: 'secondary' }
      ] }
    ])
  })
  it('ignores a stray row_end', () => {
    const v = promptView(run([
      '// action:prompt_begin S', '// action:prompt_text One',
      '// action:prompt_row_end', '// action:prompt_text Two', '// action:prompt_show'
    ]))
    expect(v.items).toEqual([{ type: 'text', text: 'One' }, { type: 'text', text: 'Two' }])
  })
})

describe('reducer images', () => {
  it('keeps valid images; falls back invalid path to alt text; drops if no alt', () => {
    const v = promptView(run([
      '// action:prompt_begin I',
      '// action:prompt_image config/a.png|good|1',
      '// action:prompt_image http://x/b.png|use me|1',
      '// action:prompt_image http://x/c.png||1',
      '// action:prompt_show'
    ]))
    expect(v.items).toEqual([
      { type: 'image', path: 'config/a.png', alt: 'good', scale: 1 },
      { type: 'text', text: 'use me' }
    ])
  })
})

describe('reducer disconnect', () => {
  it('resets active prompt and pending metadata', () => {
    const v = promptView(run([
      '// action:prompt_size large', '// action:prompt_begin W', '// action:prompt_show', '__disconnect__'
    ]))
    expect(v).toMatchObject({ visible: false, title: '', size: null, items: [] })
  })
})

describe('epoch', () => {
  it('bumps on each begin', async () => {
    const { promptEpoch } = await import('../src/view')
    const s1 = run(['// action:prompt_begin A'])
    const s2 = reducePrompt(s1, parseAction('// action:prompt_begin B')!)
    expect(promptEpoch(s2)).toBe(promptEpoch(s1) + 1)
  })
})
