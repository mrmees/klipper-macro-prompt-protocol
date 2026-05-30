import { describe, it, expect } from 'vitest'
import { isValidImagePath, parseImageScale } from '../src/image'

describe('isValidImagePath', () => {
  it('accepts config-rooted forward-slash paths', () => {
    expect(isValidImagePath('config/images/spool.svg')).toBe(true)
    expect(isValidImagePath('config/prompt-assets/nozzle.png')).toBe(true)
  })
  it('rejects unsafe paths', () => {
    for (const p of [
      '/config/x.png', '~/x.png', 'config/../secret', 'config//x.png',
      'config/./x.png', 'http://h/x.png', 'C:/x.png', 'images/x.png', 'config/a:b/x.png'
    ]) expect(isValidImagePath(p)).toBe(false)
  })
})

describe('parseImageScale', () => {
  it('parses positive finite floats', () => {
    expect(parseImageScale('0.75')).toBe(0.75)
    expect(parseImageScale('2')).toBe(2)
  })
  it('returns null for invalid/zero/negative/comma/missing', () => {
    for (const s of ['', '0', '-1', 'abc', '0,35', 'Infinity', undefined]) {
      expect(parseImageScale(s)).toBeNull()
    }
  })
})
