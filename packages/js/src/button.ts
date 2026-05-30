import type { PromptStyle } from './types'
import { normalizeStyle } from './style'

export interface ButtonFields { label: string; gcode: string; style: PromptStyle }

export function parseButtonFields (raw: string): ButtonFields | null {
  const parts = raw.split('|')
  const label = (parts[0] ?? '').trim()
  if (label.length === 0) return null
  const gcodeRaw = (parts[1] ?? '').trim()
  const gcode = gcodeRaw.length > 0 ? gcodeRaw : label
  return { label, gcode, style: normalizeStyle(parts[2]) }
}
