/** 统一的 HTTP 小工具：IPv4 优先、超时、重试、UA、TTL 缓存。 */
import dns from 'node:dns'
import tls from 'node:tls'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

try { dns.setDefaultResultOrder('ipv4first') } catch {}

// 有些网络（代理/公司网关）会替换证书链，Node 只信任自带的 CA 就会报
// UNABLE_TO_VERIFY_LEAF_SIGNATURE。把系统钥匙串里的 CA 合并进来，保持默认 CA 不丢。
try {
  if (typeof tls.getCACertificates === 'function' && typeof tls.setDefaultCACertificates === 'function') {
    const merged = [...tls.getCACertificates('default'), ...tls.getCACertificates('system')]
    tls.setDefaultCACertificates([...new Set(merged)])
  }
} catch {}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

// 缓存：同一 URL 在 TTL 内只请求一次，并发请求合并成一个。
// 默认 10 分钟；DSH_INFO_CACHE_TTL=0 可关闭（秒）。
const TTL_MS = Math.max(0, Number(process.env.DSH_INFO_CACHE_TTL ?? 600)) * 1000
const MAX_ENTRIES = 200
const store = new Map()
const inflight = new Map()

function cached(key, load) {
  if (TTL_MS === 0) return load()
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value)
  if (inflight.has(key)) return inflight.get(key)
  const pending = load()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + TTL_MS })
      if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value)
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, pending)
  return pending
}

/** 清空缓存（测试用）。 */
export function clearCache() {
  store.clear()
  inflight.clear()
}

/** 当前缓存条目数（诊断用）。 */
export function cacheSize() {
  return store.size
}

const execFileAsync = promisify(execFile)

// 有些网络有 TLS 中间人（代理/杀软），Node 自带 CA 不认，但系统 curl 认。
// 遇到证书类错误时用 curl 兜底；DSH_INFO_NO_CURL=1 可关闭。
const TLS_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
])

function isTlsError(err) {
  const code = err?.cause?.code || err?.code || ''
  return TLS_ERRORS.has(code)
}

async function curlText(url, headers, timeoutMs) {
  const args = ['-sSL', '--compressed', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-A', UA]
  for (const [key, value] of Object.entries(headers)) args.push('-H', `${key}: ${value}`)
  args.push(url)
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs + 2000 })
  return stdout
}

async function fetchText(url, { headers = {}, timeoutMs = 12000, attempts = 2 } = {}) {
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
      if (isTlsError(err) && process.env.DSH_INFO_NO_CURL !== '1') {
        try {
          return await curlText(url, headers, timeoutMs)
        } catch {
          // curl 也失败时继续重试/抛出原始错误
        }
      }
      if (i + 1 < attempts) {
        const wait = /HTTP 429/.test(String(err?.message)) ? 1500 * (i + 1) : 300
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
}

export async function getText(url, options = {}) {
  const { cache = true, ...rest } = options
  const load = () => fetchText(url, rest)
  return cache ? cached(`text:${url}`, load) : load()
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
