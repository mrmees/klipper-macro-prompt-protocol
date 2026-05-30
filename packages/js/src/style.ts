import type { PromptStyle } from './types.js'

const STYLES: readonly PromptStyle[] = ['primary', 'secondary', 'info', 'warning', 'error', 'success']

export function normalizeStyle (raw: string | undefined): PromptStyle {
  const v = (raw ?? '').trim().toLowerCase()
  return (STYLES as readonly string[]).includes(v) ? (v as PromptStyle) : 'secondary'
}
