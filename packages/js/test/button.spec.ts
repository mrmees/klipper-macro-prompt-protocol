import { describe, it, expect } from 'vitest'
import { parseButtonFields } from '../src/button'

describe('parseButtonFields', () => {
  it('parses all three fields', () => {
    expect(parseButtonFields('Home|G28|primary')).toEqual({ label: 'Home', gcode: 'G28', style: 'primary' })
  })
  it('defaults gcode to label and style to secondary', () => {
    expect(parseButtonFields('Home')).toEqual({ label: 'Home', gcode: 'Home', style: 'secondary' })
    expect(parseButtonFields('Home|')).toEqual({ label: 'Home', gcode: 'Home', style: 'secondary' })
  })
  it('trims label and returns null when label is empty', () => {
    expect(parseButtonFields('  Go  |G1')).toEqual({ label: 'Go', gcode: 'G1', style: 'secondary' })
    expect(parseButtonFields('')).toBeNull()
    expect(parseButtonFields('  |G28|primary')).toBeNull()
  })
})
