import type { MarkupNode, PromptTextSize } from './types'

const SIZES: readonly string[] = ['small', 'normal', 'large', 'x-large']
const TEXT_TAGS: readonly string[] = ['b', 'i', 'u']

function decodeEntities (s: string): string {
  // Single pass, left-to-right; decoded output is never re-scanned.
  let out = ''
  for (let i = 0; i < s.length;) {
    if (s.startsWith('&lt;', i)) { out += '<'; i += 4 }
    else if (s.startsWith('&gt;', i)) { out += '>'; i += 4 }
    else if (s.startsWith('&amp;', i)) { out += '&'; i += 5 }
    else if (s.startsWith('\\n', i)) { out += '\n'; i += 2 }
    else { out += s[i]; i += 1 }
  }
  return out
}

interface OpenTag { node: Extract<MarkupNode, { type: 'tag' }> | null; children: MarkupNode[] }

export function parseMarkup (raw: string): MarkupNode[] {
  const root: OpenTag = { node: null, children: [] }
  const stack: OpenTag[] = [root]
  let buf = ''
  const flush = () => { if (buf) { top().children.push({ type: 'text', text: decodeEntities(buf) }); buf = '' } }
  function top () { return stack[stack.length - 1] }

  for (let i = 0; i < raw.length;) {
    if (raw[i] === '<') {
      const close = raw.indexOf('>', i)
      if (close === -1) { buf += raw[i]; i += 1; continue }
      const inner = raw.slice(i + 1, close)
      i = close + 1
      if (inner.startsWith('/')) {                 // closing tag
        flush()
        const name = inner.slice(1).trim()
        const open = top()
        if (open.node && open.node.tag === name) { stack.pop() }
        // mismatched/extra close: ignore, content already flushed to current level
        continue
      }
      const node = makeTagNode(inner)              // opening tag
      flush()
      if (node) { top().children.push(node); stack.push({ node, children: node.children }) }
      // unknown/invalid tag: skip the tag itself, keep accumulating inner text at current level
      continue
    }
    buf += raw[i]; i += 1
  }
  flush()
  // Any unclosed tags simply keep whatever children they collected.
  return root.children
}

function makeTagNode (inner: string): Extract<MarkupNode, { type: 'tag' }> | null {
  if (TEXT_TAGS.includes(inner)) {
    return { type: 'tag', tag: inner as 'b' | 'i' | 'u', children: [] }
  }
  const colon = inner.indexOf(':')
  if (colon === -1) return null
  const name = inner.slice(0, colon)
  const value = inner.slice(colon + 1)
  if (name === 'color' || name === 'bgcolor') {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return null
    return { type: 'tag', tag: name, value, children: [] }
  }
  if (name === 'size') {
    const v = value.toLowerCase()
    if (!SIZES.includes(v)) return null
    return { type: 'tag', tag: 'size', value: v as PromptTextSize, children: [] }
  }
  return null
}

export function markupToPlainText (raw: string): string {
  return flatten(parseMarkup(raw))
}

function flatten (nodes: MarkupNode[]): string {
  let out = ''
  for (const n of nodes) out += n.type === 'text' ? n.text : flatten(n.children)
  return out
}
