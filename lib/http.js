/** 统一的 HTTP 小工具：IPv4 优先、超时、重试、UA。 */
import dns from 'node:dns'

try { dns.setDefaultResultOrder('ipv4first') } catch {}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

export async function getText(url, { headers = {}, timeoutMs = 12000, attempts = 2 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
      if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw lastErr
}

export async function getJson(url, options) {
  const text = await getText(url, options)
  return JSON.parse(text)
}

/** 去掉 XML/HTML 标签、压缩空白。 */
export function clean(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function daysAgo(n) {
  return new Date(Date.now() - n * 86400000)
}

export function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

/** 截断摘要，避免工具输出过长。 */
export function clip(text, n = 180) {
  const s = clean(text)
  return s.length <= n ? s : s.slice(0, n) + '…'
}
