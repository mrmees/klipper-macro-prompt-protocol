import { describe, it, expect } from 'vitest'
import { parseMarkup, markupToPlainText } from '../src/markup'

describe('markupToPlainText', () => {
  it('strips tags and decodes entities once', () => {
    expect(markupToPlainText('<b><color:#22c55e>Ready &amp; safe</color></b>')).toBe('Ready & safe')
    expect(markupToPlainText('Use &lt;care&gt;')).toBe('Use <care>')
    expect(markupToPlainText('line1\\nline2')).toBe('line1\nline2')        // backslash-n token → newline
    expect(markupToPlainText('&amp;lt;')).toBe('&lt;')                      // decoded once, not re-parsed
  })
})

describe('parseMarkup', () => {
  it('builds a nested AST for known tags', () => {
    expect(parseMarkup('<b>Hi</b>')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'Hi' }] }
    ])
    expect(parseMarkup('<color:#22c55e>x</color>')).toEqual([
      { type: 'tag', tag: 'color', value: '#22c55e', children: [{ type: 'text', text: 'x' }] }
    ])
  })
  it('strips unknown tags and invalid values, preserving inner text', () => {
    expect(parseMarkup('<blink>hey</blink>')).toEqual([{ type: 'text', text: 'hey' }])
    expect(parseMarkup('<color:red>z</color>')).toEqual([{ type: 'text', text: 'z' }])
    expect(parseMarkup('<size:huge>z</size>')).toEqual([{ type: 'text', text: 'z' }])
  })
})

// Extra robustness cases
describe('parseMarkup extra robustness', () => {
  it('handles nested mixed tags: b > color > text', () => {
    const result = parseMarkup('<b><color:#22c55e>Ready</color></b>')
    expect(result).toEqual([
      {
        type: 'tag',
        tag: 'b',
        children: [
          {
            type: 'tag',
            tag: 'color',
            value: '#22c55e',
            children: [{ type: 'text', text: 'Ready' }]
          }
        ]
      }
    ])
  })
})

describe('markupToPlainText extra robustness', () => {
  it('converts backslash-n to newline in plain text', () => {
    expect(markupToPlainText('<b>A</b>\\nB')).toBe('A\nB')
  })
  it('strips size tag and preserves surrounding text', () => {
    expect(markupToPlainText('<size:small>x</size> y')).toBe('x y')
  })
})
