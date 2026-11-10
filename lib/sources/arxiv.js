import { clean, clip, getText, isoDate, daysAgo } from '../http.js'

export const meta = { id: 'arxiv', name: 'arXiv', domains: ['ai', 'academic'], search: true, trending: true }

function parse(xml) {
  const items = []
  for (const block of xml.split('<entry>').slice(1)) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
      return m ? clean(m[1]) : ''
    }
    const id = pick('id')
    if (!id) continue
    items.push({
      source: 'arXiv', domain: 'ai',
      title: pick('title'),
      url: id.replace('http://', 'https://'),
      date: pick('published').slice(0, 10),
      summary: clip(pick('summary'), 200),
      metrics: {},
    })
  }
  return items
}

async function query(searchQuery, limit, sortBy = 'relevance') {
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${Math.min(limit * 4, 40)}&sortBy=${sortBy}&sortOrder=descending`
  return parse(await getText(url))
}

export async function search(q, { days = 30, limit = 5 } = {}) {
  // 用 arXiv 的日期区间语法，保证“最近 N 天”是真的 N 天
  const from = isoDate(daysAgo(days)).replaceAll('-', '')
  const to = isoDate(new Date()).replaceAll('-', '')
  return (await query(`all:"${q}" AND submittedDate:[${from} TO ${to}]`, limit)).slice(0, limit)
}

export async function trending({ limit = 5 } = {}) {
  return (await query('cat:cs.AI OR cat:cs.CL OR cat:cs.LG', limit, 'submittedDate')).slice(0, limit)
}
