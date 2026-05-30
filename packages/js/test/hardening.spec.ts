import { describe, it, expect } from 'vitest'
import { initialPromptState, reducePrompt } from '../src/reducer'
import { parseAction } from '../src/parse-action'
import { promptView } from '../src/view'
import { parseMarkup, markupToPlainText as markupToPlainTextDirect } from '../src/markup'
import { markupToPlainText } from '../src/index'

// Helper: apply a sequence of raw action lines to an initial state.
function run (lines: string[], opts = { frontendId: 'mainsail', frontendCategories: ['web'] as string[] }) {
  let s = initialPromptState(opts)
  for (const l of lines) {
    const ev = parseAction(l)
    if (ev) s = reducePrompt(s, ev)
  }
  return s
}

// Test 1 — view immutability
describe('view immutability', () => {
  it('mutating returned items array does not corrupt subsequent promptView calls', () => {
    const s = run([
      '// action:prompt_begin T',
      '// action:prompt_text Hello',
      '// action:prompt_show'
    ])
    const v1 = promptView(s)
    v1.items.push({ type: 'text', text: 'X' })
    const v2 = promptView(s)
    expect(v2.items.map(i => (i as any).text)).not.toContain('X')
    expect(v2.items).toHaveLength(1)
  })
})

// Test 1b — deep view immutability: mutating nested fields must not corrupt state
describe('deep view immutability', () => {
  it('mutating a top-level item text does not corrupt subsequent promptView calls', () => {
    const s = run([
      '// action:prompt_begin T',
      '// action:prompt_text Hello',
      '// action:prompt_show'
    ])
    const v1 = promptView(s)
    ;(v1.items[0] as any).text = 'X'   // mutate returned item in-place
    const v2 = promptView(s)
    expect((v2.items[0] as any).text).toBe('Hello')
  })

  it('mutating a row children array does not corrupt subsequent promptView calls', () => {
    const s = run([
      '// action:prompt_begin T',
      '// action:prompt_row_start',
      '// action:prompt_text Inside row',
      '// action:prompt_row_end',
      '// action:prompt_show'
    ])
    const v1 = promptView(s)
    const row = v1.items[0]
    if (row.type === 'row') {
      row.children.push({ type: 'text', text: 'INJECTED' } as any)
    }
    const v2 = promptView(s)
    const row2 = v2.items[0]
    expect(row2.type).toBe('row')
    if (row2.type === 'row') {
      expect(row2.children).toHaveLength(1)
      expect(row2.children.map(c => (c as any).text)).not.toContain('INJECTED')
    }
  })
})

// Test 2 — markupToPlainText importable from barrel
describe('markupToPlainText barrel export', () => {
  it('is importable from the package barrel and converts markup to plain text', () => {
    expect(typeof markupToPlainText).toBe('function')
    expect(markupToPlainText('<b>Hi &amp; bye</b>')).toBe('Hi & bye')
  })
})

// Test 3 — container left open at show, then post-show content
describe('container open at show with liveAppend', () => {
  it('appends text inside open row, then closes, then appends top-level text', () => {
    const s = run([
      '// action:prompt_begin T',
      '// action:prompt_row_start',
      '// action:prompt_show',
      '// action:prompt_text A',
      '// action:prompt_row_end',
      '// action:prompt_text B'
    ])
    const v = promptView(s)
    expect(v.visible).toBe(true)
    expect(v.items).toEqual([
      { type: 'row', children: [{ type: 'text', text: 'A' }] },
      { type: 'text', text: 'B' }
    ])
  })
})

// Test 4 — button_group rejects non-button children
describe('button_group rejects non-button children', () => {
  it('drops text inside button_group and does not promote it to top level', () => {
    const s = run([
      '// action:prompt_begin G',
      '// action:prompt_button_group_start',
      '// action:prompt_text nope',
      '// action:prompt_button Yes|Y',
      '// action:prompt_button_group_end',
      '// action:prompt_show'
    ])
    const v = promptView(s)
    expect(v.items).toEqual([
      {
        type: 'button_group',
        children: [{ type: 'button', label: 'Yes', gcode: 'Y', style: 'secondary' }]
      }
    ])
  })
})

// Test 5 — suppressed prompt does not leak content to the next prompt
describe('suppressed prompt isolation', () => {
  it('suppressed content is not visible in the following matched prompt', () => {
    const s = run([
      '// action:prompt_target fluidd',
      '// action:prompt_begin A',
      '// action:prompt_text secret',
      '// action:prompt_begin B',
      '// action:prompt_show'
    ], { frontendId: 'mainsail', frontendCategories: [] })
    const v = promptView(s)
    expect(v.visible).toBe(true)
    expect(v.title).toBe('B')
    expect(v.items).toEqual([])
  })
})

// Test 6 — bare-pipes empty label drops the button
describe('parseAction button empty label', () => {
  it('returns null for a button with empty label (bare pipes)', () => {
    expect(parseAction('// action:prompt_button ||')).toBeNull()
  })
})

// Test 7 — markup tag-name case sensitivity
describe('markup tag-name case sensitivity', () => {
  it('treats <B> as unknown (case-sensitive) and preserves inner text', () => {
    expect(parseMarkup('<B>x</B>')).toEqual([{ type: 'text', text: 'x' }])
  })
  it('accepts size tag with uppercase value (case-insensitive value, not tag)', () => {
    expect(parseMarkup('<size:SMALL>x</size>')).toEqual([
      { type: 'tag', tag: 'size', value: 'small', children: [{ type: 'text', text: 'x' }] }
    ])
  })
})

// Test 8 — promptView must not depend on structuredClone (older-runtime safe, e.g. Safari 12)
describe('promptView old-runtime safety', () => {
  it('still deep-clones the view when structuredClone is unavailable', () => {
    const saved = (globalThis as Record<string, unknown>).structuredClone
    delete (globalThis as Record<string, unknown>).structuredClone
    try {
      const s = run([
        '// action:prompt_begin T',
        '// action:prompt_row_start',
        '// action:prompt_text child',
        '// action:prompt_row_end',
        '// action:prompt_show'
      ])
      const v = promptView(s)
      expect(v.items[0]).toEqual({ type: 'row', children: [{ type: 'text', text: 'child' }] })
      // and the returned view is still a deep copy (mutation does not corrupt state)
      const row = v.items[0]
      if (row.type === 'row') (row.children[0] as any).text = 'X'
      const row2 = promptView(s).items[0]
      if (row2.type === 'row') expect((row2.children[0] as any).text).toBe('child')
    } finally {
      ;(globalThis as Record<string, unknown>).structuredClone = saved
    }
  })
})
