import { clean, clip, getText } from '../http.js'

export const meta = { id: 'producthunt', name: 'Product Hunt', domains: ['product'], search: false, trending: true }

export async function trending({ limit = 5 } = {}) {
  const xml = await getText('https://www.producthunt.com/feed')
  const items = []
  for (const block of xml.split('<entry>').slice(1)) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
      return m ? clean(m[1]) : ''
    }
    const link = block.match(/<link[^>]*href="([^"]+)"/)?.[1] || ''
    const title = pick('title')
    if (!title || !link) continue
    items.push({
      source: 'Product Hunt', domain: 'product',
      title, url: link,
      date: pick('published').slice(0, 10),
      summary: clip((pick('content') || pick('summary')).replace(/Discussion\s*\|\s*Link/g, ''), 160),
      metrics: {},
    })
  }
  return items.slice(0, limit)
}

export async function search() {
  return []
}
