/** 跨源去重、热度排序等纯函数。 */

/** 归一化标题：小写、去掉标点/空格/符号，用于判重。 */
export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

/** 跨源去重：保留第一次出现的条目（SOURCES 顺序即优先级）。 */
export function dedupeGroups(groups) {
  const seen = new Set()
  return groups.map(([name, items]) => [
    name,
    (items || []).filter((item) => {
      const key = normalizeTitle(item.title)
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ])
}

const BLOCKED = /(^|[^a-z])(nsfw|porn|xxx)([^a-z]|$)|色情|成人|人机恋|裸聊|约炮|情色/i

/** 基础安全过滤：公开插件不该把成人内容推到“优先看”。 */
export function isBlocked(item) {
  return BLOCKED.test(`${item.title || ''} ${item.summary || ''}`)
}

/** 粗略热度分：不同源指标不同，取对数后可比。 */
export function heat(item) {
  const m = item.metrics || {}
  if (m.stars != null) return Math.log10(m.stars + 1) * 2
  if (m.points != null) return Math.log10(m.points + 1) * 2
  if (m.likes != null) return Math.log10(m.likes + 1)
  if (m.citations != null) return Math.log10(m.citations + 1)
  return 0
}

/** 挑“优先看”的条目：先保证领域多样，再按热度/日期补足。 */
export function pickHighlights(items, n = 3) {
  const domainBonus = { ai: 1, academic: 0.8, community: 0.6, models: 0.4, opensource: 0, product: 0.2 }
  const score = (item) => {
    let s = heat(item) + (domainBonus[item.domain] ?? 0)
    if (item.summary) s += 0.3           // 有摘要的更可读
    if (item.source === 'GitHub' && (item.metrics?.stars || 0) < 50) s -= 2  // 小仓库不进“优先看”
    return s
  }
  const sorted = [...items].sort(
    (a, b) => score(b) - score(a) || String(b.date).localeCompare(String(a.date)),
  )
  const out = []
  const domains = new Set()
  for (const item of sorted) {
    if (out.length >= n) break
    if (!domains.has(item.domain)) {
      out.push(item)
      domains.add(item.domain)
    }
  }
  for (const item of sorted) {
    if (out.length >= n) break
    if (!out.includes(item)) out.push(item)
  }
  return out
}
