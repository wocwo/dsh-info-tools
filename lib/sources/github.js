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
  // 未认证 10 次/分钟；设置 GITHUB_TOKEN 可提到 30 次/分钟（搜索配额）
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}
  const data = await getJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(limit * 2, 30)}`,
    { headers },
  )
  return (data?.items || []).map(toItem)
}

export async function search(q, { days = 30, limit = 5 } = {}) {
  return (await query(`${q} created:>${isoDate(daysAgo(days))}`, limit)).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  return (await query(`created:>${isoDate(daysAgo(7))}`, limit)).slice(0, limit)
}
