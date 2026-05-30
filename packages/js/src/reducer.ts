import type {
  EngineOptions, PromptAlign, PromptEvent, PromptItem, PromptInlineItem, PromptButtonItem,
  PromptState, PromptStateData
} from './types.js'
import { isValidImagePath } from './image.js'

export function initialPromptState (opts: EngineOptions): PromptState {
  return freshIdle(0, {
    frontendId: opts.frontendId,
    frontendCategories: [...opts.frontendCategories],
    liveAppend: opts.liveAppend ?? true
  })
}

function freshIdle (epoch: number, opts: Required<EngineOptions>): PromptState {
  return {
    lifecycle: 'idle', epoch, title: '', size: null, activeTargets: ['all'],
    items: [], footerButtons: [], activeContainer: null,
    pendingTargets: null, pendingSize: null, currentAlign: 'center', opts
  } as unknown as PromptState
}

function targetsMatch (targets: string[], opts: Required<EngineOptions>): boolean {
  if (targets.includes('all')) return true
  if (targets.includes(opts.frontendId.toLowerCase())) return true
  return opts.frontendCategories.some(c => targets.includes(c.toLowerCase()))
}

export function reducePrompt (state: PromptState, event: PromptEvent): PromptState {
  const d = state as unknown as PromptStateData

  switch (event.kind) {
    case 'target': return patch(d, { pendingTargets: event.targets })
    case 'size': return patch(d, { pendingSize: event.size })
    case 'disconnect':
    case 'end':
      return d.lifecycle === 'idle' && d.pendingTargets === null && d.pendingSize === null
        ? state
        : freshIdle(d.epoch, d.opts)
    case 'begin': {
      const targets = d.pendingTargets ?? ['all']
      const matched = targetsMatch(targets, d.opts)
      return {
        ...freshIdle(d.epoch + 1, d.opts),
        lifecycle: matched ? 'building' : 'suppressed',
        title: event.title,
        size: d.pendingSize,
        activeTargets: targets,
        currentAlign: 'center'
      } as unknown as PromptState
    }
    case 'show':
      return d.lifecycle === 'building' ? patch(d, { lifecycle: 'shown' }) : state
    case 'align':
      return event.align !== null ? patch(d, { currentAlign: event.align }) : state
  }

  // Content events below require an active, matching prompt.
  const lc = d.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state
  if (!d.opts.liveAppend && lc === 'shown') return state   // snapshot-at-show

  switch (event.kind) {
    case 'text': return appendContent(d, { type: 'text', text: event.text })
    case 'markup': return appendContent(d, { type: 'markup', markup: event.markup, plain_text: event.plain_text })
    case 'button': return appendContent(d, { type: 'button', label: event.label, gcode: event.gcode, style: event.style })
    case 'image':
      if (isValidImagePath(event.path)) {
        return appendContent(d, { type: 'image', path: event.path, alt: event.alt, scale: event.scale })
      }
      if (event.alt.length === 0) return state
      return appendContent(d, { type: 'text', text: event.alt })
    case 'footer_button':
      return patch(d, { footerButtons: [...d.footerButtons, { label: event.label, gcode: event.gcode, style: event.style }] })
    case 'row_start': return openContainer(d, 'row')
    case 'row_end': return closeContainer(d, 'row')
    case 'button_group_start': return openContainer(d, 'button_group')
    case 'button_group_end': return closeContainer(d, 'button_group')
  }
  return state
}

function patch (d: PromptStateData, p: Partial<PromptStateData>): PromptState {
  return { ...d, ...p } as unknown as PromptState
}

function openContainer (d: PromptStateData, kind: 'row' | 'button_group'): PromptState {
  if (d.activeContainer !== null) return d as unknown as PromptState   // already open: ignore nested start
  const empty: PromptItem = kind === 'row' ? { type: 'row', children: [] } : { type: 'button_group', children: [] }
  return patch(d, { activeContainer: kind, items: [...d.items, stampAlign(empty, d.currentAlign)] })
}

function closeContainer (d: PromptStateData, kind: 'row' | 'button_group'): PromptState {
  if (d.activeContainer !== kind) return d as unknown as PromptState   // stray end: ignore
  return patch(d, { activeContainer: null })
}

function stampAlign (item: PromptItem, align: PromptAlign): PromptItem {
  if (align === 'center') return item
  return { ...item, align } as PromptItem
}

function appendContent (d: PromptStateData, item: PromptItem): PromptState {
  if (d.activeContainer === 'row') {
    if (item.type === 'row' || item.type === 'button_group') return d as unknown as PromptState
    return appendToLastContainer(d, item as PromptInlineItem)
  }
  if (d.activeContainer === 'button_group') {
    if (item.type !== 'button') return d as unknown as PromptState
    return appendToLastContainer(d, item as PromptButtonItem)
  }
  return patch(d, { items: [...d.items, stampAlign(item, d.currentAlign)] })
}

function appendToLastContainer (d: PromptStateData, child: PromptInlineItem | PromptButtonItem): PromptState {
  const items = d.items.slice()
  const last = items[items.length - 1]
  if (!last || (last.type !== 'row' && last.type !== 'button_group')) return d as unknown as PromptState
  items[items.length - 1] = { ...last, children: [...(last as any).children, child] } as PromptItem
  return patch(d, { items })
}
