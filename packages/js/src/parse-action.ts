import type { PromptEvent, PromptSize } from './types.js'
import { parseButtonFields } from './button.js'
import { parseImageScale } from './image.js'
import { markupToPlainText } from './markup.js'

const SIZES: readonly PromptSize[] = ['small', 'normal', 'large', 'x-large', 'full-screen']
const PREFIX = '// action:prompt_'

export function disconnectEvent (): PromptEvent { return { kind: 'disconnect' } }

export function parseAction (line: string): PromptEvent | null {
  if (!line.startsWith(PREFIX)) return null
  const rest = line.slice(PREFIX.length)
  const sp = rest.indexOf(' ')
  const cmd = sp === -1 ? rest : rest.slice(0, sp)
  const arg = sp === -1 ? '' : rest.slice(sp + 1)

  switch (cmd) {
    case 'begin': return { kind: 'begin', title: arg }
    case 'text': return { kind: 'text', text: arg }
    case 'show': return { kind: 'show' }
    case 'end': return { kind: 'end' }
    case 'row_start': return { kind: 'row_start' }
    case 'row_end': return { kind: 'row_end' }
    case 'button_group_start': return { kind: 'button_group_start' }
    case 'button_group_end': return { kind: 'button_group_end' }
    case 'markup': return { kind: 'markup', markup: arg, plain_text: markupToPlainText(arg) }
    case 'button': {
      const b = parseButtonFields(arg)
      return b ? { kind: 'button', ...b } : null
    }
    case 'footer_button': {
      const b = parseButtonFields(arg)
      return b ? { kind: 'footer_button', ...b } : null
    }
    case 'image': {
      const parts = arg.split('|')
      return {
        kind: 'image',
        path: (parts[0] ?? '').trim(),
        alt: (parts[1] ?? '').trim(),
        scale: parseImageScale(parts[2])
      }
    }
    case 'target': {
      const targets = arg.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
      return { kind: 'target', targets }
    }
    case 'size': {
      const v = arg.trim().toLowerCase()
      return { kind: 'size', size: (SIZES as readonly string[]).includes(v) ? (v as PromptSize) : null }
    }
    default: return null   // unknown prompt_* command: ignored
  }
}
