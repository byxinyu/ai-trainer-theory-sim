export function normalizeText(input: string) {
  return input
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .replace(/[。；;,.，、：:]/g, '')
    .trim()
}

export function createHash(input: string) {
  let hash = 0
  const normalized = normalizeText(input)

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
