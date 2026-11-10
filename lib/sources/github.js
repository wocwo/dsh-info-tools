import { clip, getJson, isoDate, daysAgo } from '../http.js'

export const meta = { id: 'github', name: 'GitHub', domains: ['opensource', 'ai'], search: true, trending: true }

function toItem(r) {
  return {
    source: 'GitHub', domain: 'opensource',
    title: r.full_name,
    url: r.html_url,
    date: String(r.created_at || '').slice(0, 10),
    summary: clip(r.description || '', 160),
    metrics: { stars: r.stargazers_count ?? 0, lang: r.language || '' },
  }
}

async function query(q, limit) {
  const data = await getJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(limit * 2, 30)}`)
  return (data?.items || []).map(toItem)
}

export async function search(q, { days = 30, limit = 5 } = {}) {
  return (await query(`${q} created:>${isoDate(daysAgo(days))}`, limit)).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  return (await query(`created:>${isoDate(daysAgo(7))}`, limit)).slice(0, limit)
}
