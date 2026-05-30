import { describe, it, expect } from 'vitest'
import { parseAction } from '../src/parse-action'
import { initialPromptState, reducePrompt } from '../src/reducer'
import { promptView } from '../src/view'
import type { EngineOptions } from '../src/types'

const OPTS: EngineOptions = { frontendId: 'mainsail', frontendCategories: ['web'] }

function run (lines: string[], opts: EngineOptions = OPTS) {
  let s = initialPromptState(opts)
  for (const l of lines) {
    const ev = parseAction(l)
    if (ev) s = reducePrompt(s, ev)
  }
  return s
}

// ---- parse-action tests ----

describe('parseAction prompt_align', () => {
  it('parses left', () => {
    expect(parseAction('// action:prompt_align left')).toEqual({ kind: 'align', align: 'left' })
  })
  it('parses center', () => {
    expect(parseAction('// action:prompt_align center')).toEqual({ kind: 'align', align: 'center' })
  })
  it('parses right', () => {
    expect(parseAction('// action:prompt_align right')).toEqual({ kind: 'align', align: 'right' })
  })
  it('normalises uppercase input', () => {
    expect(parseAction('// action:prompt_align LEFT')).toEqual({ kind: 'align', align: 'left' })
    expect(parseAction('// action:prompt_align RIGHT')).toEqual({ kind: 'align', align: 'right' })
  })
  it('returns align:null for unknown value', () => {
    expect(parseAction('// action:prompt_align justify')).toEqual({ kind: 'align', align: null })
  })
  it('returns align:null for empty arg', () => {
    expect(parseAction('// action:prompt_align')).toEqual({ kind: 'align', align: null })
  })
  it('returns align:null for whitespace-only arg', () => {
    expect(parseAction('// action:prompt_align   ')).toEqual({ kind: 'align', align: null })
  })
})

// ---- reducer / hardening tests ----

describe('prompt_align sticky alignment', () => {
  it('align right stamps subsequent top-level text items with align:right', () => {
    const v = promptView(run([
      '// action:prompt_begin Align Test',
      '// action:prompt_align right',
      '// action:prompt_text Right-aligned text',
      '// action:prompt_show'
    ]))
    expect(v.items[0]).toMatchObject({ type: 'text', text: 'Right-aligned text', align: 'right' })
  })

  it('alignment is sticky across multiple subsequent items', () => {
    const v = promptView(run([
      '// action:prompt_begin Sticky',
      '// action:prompt_align right',
      '// action:prompt_text First',
      '// action:prompt_text Second',
      '// action:prompt_show'
    ]))
    expect(v.items[0]).toMatchObject({ align: 'right' })
    expect(v.items[1]).toMatchObject({ align: 'right' })
  })

  it('alignment changes when a second prompt_align is emitted', () => {
    const v = promptView(run([
      '// action:prompt_begin Switch',
      '// action:prompt_align right',
      '// action:prompt_text Right',
      '// action:prompt_align left',
      '// action:prompt_text Left',
      '// action:prompt_show'
    ]))
    expect(v.items[0]).toMatchObject({ align: 'right' })
    expect(v.items[1]).toMatchObject({ align: 'left' })
  })
})

describe('prompt_align center (default) — no align field emitted', () => {
  it('items have no align field when default center is in effect', () => {
    const v = promptView(run([
      '// action:prompt_begin Default',
      '// action:prompt_text Center default',
      '// action:prompt_show'
    ]))
    expect((v.items[0] as any).align).toBeUndefined()
  })

  it('align center explicitly also omits the field', () => {
    const v = promptView(run([
      '// action:prompt_begin Explicit Center',
      '// action:prompt_align center',
      '// action:prompt_text Centered text',
      '// action:prompt_show'
    ]))
    expect((v.items[0] as any).align).toBeUndefined()
  })
})

describe('prompt_align resets to center at prompt_begin', () => {
  it('align from prior prompt does not bleed into next prompt', () => {
    const v = promptView(run([
      '// action:prompt_begin First',
      '// action:prompt_align right',
      '// action:prompt_text Right',
      '// action:prompt_show',
      '// action:prompt_begin Second',
      '// action:prompt_text Should be center',
      '// action:prompt_show'
    ]))
    // Only the second prompt is visible; its item must have no align field
    expect(v.title).toBe('Second')
    expect((v.items[0] as any).align).toBeUndefined()
  })
})

describe('prompt_align does not stamp container children', () => {
  it('children inside a row do not receive an align field', () => {
    const v = promptView(run([
      '// action:prompt_begin Row Test',
      '// action:prompt_align right',
      '// action:prompt_row_start',
      '// action:prompt_text Inside row',
      '// action:prompt_row_end',
      '// action:prompt_show'
    ]))
    const row = v.items[0]
    expect(row.type).toBe('row')
    // The row itself gets the align stamp
    expect((row as any).align).toBe('right')
    // But its children must NOT
    if (row.type === 'row') {
      expect((row.children[0] as any).align).toBeUndefined()
    }
  })

  it('children inside a button_group do not receive an align field', () => {
    const v = promptView(run([
      '// action:prompt_begin Group Test',
      '// action:prompt_align left',
      '// action:prompt_button_group_start',
      '// action:prompt_button OK|G28|primary',
      '// action:prompt_button_group_end',
      '// action:prompt_show'
    ]))
    const grp = v.items[0]
    expect(grp.type).toBe('button_group')
    expect((grp as any).align).toBe('left')
    if (grp.type === 'button_group') {
      expect((grp.children[0] as any).align).toBeUndefined()
    }
  })
})

describe('prompt_align unknown value is ignored (keeps prior)', () => {
  it('unknown align value leaves current alignment unchanged', () => {
    const v = promptView(run([
      '// action:prompt_begin Ignore Bad',
      '// action:prompt_align right',
      '// action:prompt_align justify',  // unknown → ignored
      '// action:prompt_text Still right',
      '// action:prompt_show'
    ]))
    expect(v.items[0]).toMatchObject({ align: 'right' })
  })

  it('empty align value on first use leaves alignment as center', () => {
    const v = promptView(run([
      '// action:prompt_begin Empty Align',
      '// action:prompt_align',           // empty → ignored
      '// action:prompt_text Still center',
      '// action:prompt_show'
    ]))
    expect((v.items[0] as any).align).toBeUndefined()
  })
})
