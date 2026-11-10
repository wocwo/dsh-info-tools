import { clip, getJson } from '../http.js'

export const meta = { id: 'hn', name: 'Hacker News', domains: ['community', 'tech'], search: true, trending: true }

export function toItem(h) {
  return {
    source: 'Hacker News', domain: 'community',
    title: h.title || h.story_title || '(untitled)',
    url: h.url || h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    date: String(h.created_at || '').slice(0, 10),
    summary: clip(h.comment_text || '', 160),
    metrics: { points: h.points ?? 0, comments: h.num_comments ?? 0 },
  }
}

export async function search(q, { days = 30, limit = 5 } = {}) {
  const since = Math.floor((Date.now() - days * 86400000) / 1000)
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${Math.min(limit * 2, 30)}&numericFilters=created_at_i>${since}`
  return ((await getJson(url))?.hits || []).map(toItem).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  const url = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${Math.min(limit * 2, 30)}`
  return ((await getJson(url))?.hits || []).map(toItem).slice(0, limit)
}
