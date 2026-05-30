export function isValidImagePath (path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('~')) return false
  if (!path.startsWith('config/')) return false
  if (path.includes('\\')) return false
  const segments = path.split('/')
  for (const seg of segments) {
    if (seg.length === 0) return false        // no empty segments (also catches '//')
    if (seg === '.' || seg === '..') return false
    if (seg.includes(':')) return false
  }
  return true
}

export function parseImageScale (raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || /[,]/.test(trimmed)) return null
  if (!/^[0-9]*\.?[0-9]+$/.test(trimmed)) return null   // digits with optional single dot; no sign/exp/Infinity
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
