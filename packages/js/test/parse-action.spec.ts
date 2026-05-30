import { describe, it, expect } from 'vitest'
import { parseAction, disconnectEvent } from '../src/parse-action'

describe('parseAction', () => {
  it('returns null for non-prompt lines', () => {
    expect(parseAction('// action:foo')).toBeNull()
    expect(parseAction('ok T:200')).toBeNull()
  })
  it('parses lifecycle + content commands', () => {
    expect(parseAction('// action:prompt_begin Load Filament')).toEqual({ kind: 'begin', title: 'Load Filament' })
    expect(parseAction('// action:prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
    expect(parseAction('// action:prompt_show')).toEqual({ kind: 'show' })
    expect(parseAction('// action:prompt_end')).toEqual({ kind: 'end' })
    expect(parseAction('// action:prompt_button Go|G28|primary'))
      .toEqual({ kind: 'button', label: 'Go', gcode: 'G28', style: 'primary' })
    expect(parseAction('// action:prompt_button   |G28')).toBeNull()   // empty label → dropped
  })
  it('computes plain_text for markup and parses image fields', () => {
    expect(parseAction('// action:prompt_markup <b>Hi &amp; bye</b>'))
      .toEqual({ kind: 'markup', markup: '<b>Hi &amp; bye</b>', plain_text: 'Hi & bye' })
    expect(parseAction('// action:prompt_image config/x.png|alt|0.5'))
      .toEqual({ kind: 'image', path: 'config/x.png', alt: 'alt', scale: 0.5 })
    expect(parseAction('// action:prompt_image config/x.png||0.5'))
      .toEqual({ kind: 'image', path: 'config/x.png', alt: '', scale: 0.5 })
  })
  it('parses target (empty arg → empty list) and size (unknown → null)', () => {
    expect(parseAction('// action:prompt_target mainsail, touch'))
      .toEqual({ kind: 'target', targets: ['mainsail', 'touch'] })
    expect(parseAction('// action:prompt_target   ')).toEqual({ kind: 'target', targets: [] })
    expect(parseAction('// action:prompt_size Large')).toEqual({ kind: 'size', size: 'large' })
    expect(parseAction('// action:prompt_size huge')).toEqual({ kind: 'size', size: null })
  })
})

describe('disconnectEvent', () => {
  it('produces a disconnect event', () => {
    expect(disconnectEvent()).toEqual({ kind: 'disconnect' })
  })
})
