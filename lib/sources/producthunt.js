import { clean, clip, getText } from '../http.js'

export const meta = { id: 'producthunt', name: 'Product Hunt', domains: ['product'], search: false, trending: true }

/** 解析 Product Hunt 的 Atom feed；导出以便测试。 */
export function parseFeed(xml, limit = 20) {
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

export async function trending({ limit = 5 } = {}) {
  return parseFeed(await getText('https://www.producthunt.com/feed'), limit)
}
