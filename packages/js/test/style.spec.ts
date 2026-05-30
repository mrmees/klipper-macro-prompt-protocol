import { describe, it, expect } from 'vitest'
import { normalizeStyle } from '../src/style'

describe('normalizeStyle', () => {
  it('keeps known styles, lower-cased and trimmed', () => {
    expect(normalizeStyle('primary')).toBe('primary')
    expect(normalizeStyle('  Warning ')).toBe('warning')
    expect(normalizeStyle('SUCCESS')).toBe('success')
  })
  it('falls back to secondary for missing/empty/unknown', () => {
    expect(normalizeStyle(undefined)).toBe('secondary')
    expect(normalizeStyle('')).toBe('secondary')
    expect(normalizeStyle('purple')).toBe('secondary')
  })
})
