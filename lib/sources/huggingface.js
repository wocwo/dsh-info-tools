import { clip, getJson, isoDate, daysAgo } from '../http.js'

export const meta = { id: 'huggingface', name: 'Hugging Face', domains: ['models', 'ai'], search: true, trending: true }

function toItem(m) {
  return {
    source: 'Hugging Face', domain: 'models',
    title: m.id,
    url: `https://huggingface.co/${m.id}`,
    date: String(m.createdAt || '').slice(0, 10),
    summary: clip((m.tags || []).filter((t) => !t.includes(':')).slice(0, 8).join(', '), 120),
    metrics: { likes: m.likes ?? 0, downloads: m.downloads ?? 0 },
  }
}

async function query(search, limit, sort = 'trendingScore') {
  const q = search ? `search=${encodeURIComponent(search)}&` : ''
  const url = `https://huggingface.co/api/models?${q}sort=${sort}&direction=-1&limit=${Math.min(limit * 2, 30)}`
  return ((await getJson(url)) || []).map(toItem)
}

export async function search(q, { days = 60, limit = 5 } = {}) {
  const items = await query(q, limit, 'likes')
  const cutoff = isoDate(daysAgo(days))
  const recent = items.filter((x) => x.date >= cutoff)
  return (recent.length ? recent : items).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  return (await query('', limit)).slice(0, limit)
}
