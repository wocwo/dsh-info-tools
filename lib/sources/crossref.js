import { clip, getJson, isoDate, daysAgo } from '../http.js'

export const meta = { id: 'crossref', name: 'Crossref', domains: ['academic'], search: true, trending: false }

export function toItem(w) {
  let date = w.published?.['date-parts']?.[0]?.join('-') || w.created?.['date-time']?.slice(0, 10) || ''
  // Crossref 偶有错误日期（如 2203 年），直接丢弃
  if (!/^\d{4}-\d{2}/.test(date) || Number(date.slice(0, 4)) > new Date().getFullYear()) date = ''
  return {
    source: 'Crossref', domain: 'academic',
    title: (w.title && w.title[0]) || '(untitled)',
    url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : ''),
    date: String(date).slice(0, 10),
    summary: clip(w.abstract || (w['container-title'] && w['container-title'][0]) || '', 180),
    metrics: { citations: w['is-referenced-by-count'] ?? 0 },
  }
}

async function query(q, rows, from, sort = 'relevance') {
  const base = 'https://api.crossref.org/works?rows=' + rows + '&sort=' + sort + '&order=desc&filter=from-pub-date:' + from
  const url = q ? `${base}&query=${encodeURIComponent(q)}` : base
  const data = await getJson(url)
  return (data?.message?.items || []).map(toItem).filter((x) => x.title && x.url && x.date)
}

export async function search(q, { days = 60, limit = 5 } = {}) {
  return (await query(q, Math.min(limit * 2, 30), isoDate(daysAgo(days)))).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  return (await query('', Math.min(limit * 2, 30), isoDate(daysAgo(14)), 'published')).slice(0, limit)
}
