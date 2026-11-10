/**
 * 东方财富行情数据的最小封装（无第三方依赖，Node 18+ 自带 fetch）。
 *
 * 只覆盖三件事：快照、日线、公告。接口是公开网页接口，可能变动；
 * 仅供个人研究，商用请自行确认数据授权。
 */

import dns from 'node:dns'

// 部分网络下 fetch 会优先 IPv6 导致连不上东财，固定 IPv4。
try { dns.setDefaultResultOrder('ipv4first') } catch {}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

const SH_INDEX = new Set(['000001', '000016', '000300', '000688', '000852', '000905', '000906'])

/** 6 位代码 → 东财 secid（1=沪市，0=深市）。支持 sh/sz 前缀。 */
export function toSecid(code) {
  let raw = String(code || '').trim().toLowerCase()
  let prefix = ''
  if (raw.startsWith('sh') || raw.startsWith('sz')) {
    prefix = raw.slice(0, 2)
    raw = raw.slice(2)
  }
  raw = raw.padStart(6, '0')
  if (!/^\d{6}$/.test(raw)) throw new Error(`无效代码：${code}`)
  let market
  if (prefix) market = prefix === 'sh' ? 1 : 0
  else if (SH_INDEX.has(raw)) market = 1
  else market = '569'.includes(raw[0]) ? 1 : 0
  return `${market}.${raw}`
}

async function getJson(url, params, attempts = 2, timeoutMs = 12000) {
  const qs = new URLSearchParams(params).toString()
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${url}?${qs}`, {
        headers: { 'User-Agent': UA, Referer: 'https://quote.eastmoney.com/' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw lastErr
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 腾讯行情（东财不可用时的备源）。GBK 编码，字段用 ~ 分隔。 */
export async function fetchQuoteTencent(code) {
  const secid = toSecid(code)
  const [mkt, code6] = secid.split('.')
  const symbol = (mkt === '1' ? 'sh' : 'sz') + code6
  let text = ''
  let lastErr
  for (const base of ['https://qt.gtimg.cn', 'http://qt.gtimg.cn']) {
    try {
      const res = await fetch(`${base}/q=${symbol}`, {
        headers: { Referer: 'https://gu.qq.com/' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      text = new TextDecoder('gbk').decode(await res.arrayBuffer())
      if (text.includes('="')) break
    } catch (err) {
      lastErr = err
    }
  }
  const m = text.match(/="([^"]*)"/)
  if (!m) throw lastErr || new Error(`腾讯接口未返回 ${code}`)
  const f = m[1].split('~')
  const pick = (i) => num(f[i])
  return {
    code: f[2] || String(code),
    name: f[1] || String(code),
    price: pick(3),
    prevClose: pick(4),
    open: pick(5),
    changePct: pick(32),
    high: pick(33),
    low: pick(34),
    pe: pick(39) || null,   // ETF 会返回 0
    pb: pick(46) || null,
    marketCap: pick(45) == null ? null : pick(45) * 1e8,  // 亿 → 元
  }
}

/** 行情快照：以日线收盘为底（稳定可用），再尽量补 PE/PB/市值。 */
export async function fetchQuote(code) {
  const k = await fetchKline(code, 5)
  const last = k.rows.at(-1)
  const prev = k.rows.at(-2)
  if (!last) throw new Error(`未找到 ${code} 的行情`)
  const base = {
    code: String(code),
    name: k.name,
    price: last.close,
    high: last.high,
    low: last.low,
    open: last.open,
    prevClose: prev?.close ?? null,
    changePct: prev ? (last.close / prev.close - 1) * 100 : null,
    pe: null,
    pb: null,
    marketCap: null,
  }
  try {
    const t = await fetchQuoteTencent(code)
    return {
      ...base,
      pe: t.pe ?? null,
      pb: t.pb ?? null,
      marketCap: t.marketCap ?? null,
    }
  } catch {
    return base
  }
}

/** 日线（前复权）。返回按时间升序的数组。 */
export async function fetchKline(code, days = 120) {
  const secid = toSecid(code)
  const n = Math.min(Math.max(Math.round(days), 20), 500)
  const end = '20500101'
  const begDate = new Date(Date.now() - n * 2.2 * 86400000)
  const beg = begDate.toISOString().slice(0, 10).replaceAll('-', '')
  const payload = await getJson('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57',
    klt: '101',
    fqt: '1',
    beg,
    end,
    lmt: '100000',
  })
  const data = payload?.data
  const lines = data?.klines || []
  if (!lines.length) throw new Error(`未找到 ${code} 的日线`)
  const rows = lines.map((line) => {
    const [date, open, close, high, low, volume, amount] = line.split(',')
    return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume, amount: +amount }
  })
  return { name: String(data?.name || code), rows }
}

// 公告噪音：H 股月报表、法律意见书这类对投资判断几乎没有增量信息
const ANN_NOISE = ['H股公告', '月报表', '翌日披露', '法律意见书', '决议公告', '会议通知',
  '公司章程', '管理制度', '独立董事', '监事会', '持续督导', '保荐', '募集资金',
  '内部控制', '投资者关系活动', '会计师事务所']
// 命中这些强信号词时，即使标题里有噪音词也保留
const ANN_STRONG = ['回购', '增持', '减持', '中标', '合同', '重组', '收购', '业绩',
  '分红', '权益变动', '换股', '诉讼', '处罚', '停牌', '经营数据', '产销']

export function isMaterialAnnouncement(title) {
  if (ANN_STRONG.some((w) => title.includes(w))) return true
  return !ANN_NOISE.some((w) => title.includes(w))
}

/** 最近 N 天公告（A 股），已过滤噪音。 */
export async function fetchAnnouncements(code, days = 7) {
  let raw = String(code || '').trim().toLowerCase()
  if (raw.startsWith('sh') || raw.startsWith('sz')) raw = raw.slice(2)
  const payload = await getJson('https://np-anotice-stock.eastmoney.com/api/security/ann', {
    sr: '-1',
    page_size: '50',
    page_index: '1',
    ann_type: 'A',
    client_source: 'web',
    stock_list: raw,
  })
  const cutoff = Date.now() - Math.min(Math.max(days, 1), 60) * 86400000
  const out = []
  for (const item of payload?.data?.list || []) {
    const date = String(item.notice_date || '').slice(0, 10)
    const t = Date.parse(`${date}T00:00:00+08:00`)
    if (!Number.isFinite(t) || t < cutoff) continue
    const title = String(item.title || '').split(':').slice(-1)[0].trim()
    if (!isMaterialAnnouncement(title)) continue
    out.push({
      date,
      title,
      column: item.columns?.[0]?.column_name || '',
      url: `https://data.eastmoney.com/notices/detail/${raw}/${item.art_code}.html`,
    })
  }
  return out
}

/** 把快照格式化成模型易读的 Markdown。 */
export function formatQuote(q) {
  const pct = q.changePct == null ? '—' : `${q.changePct > 0 ? '+' : ''}${q.changePct.toFixed(2)}%`
  const cap = q.marketCap == null ? '—' : `${(q.marketCap / 1e8).toFixed(0)} 亿`
  return [
    `**${q.name}（${q.code}）**`,
    `- 最新价：${q.price ?? '—'}（${pct}）`,
    `- 今开/最高/最低：${q.open ?? '—'} / ${q.high ?? '—'} / ${q.low ?? '—'}`,
    `- PE(TTM)：${q.pe ?? '—'}　PB：${q.pb ?? '—'}　总市值：${cap}`,
  ].join('\n')
}

/** 用日线计算趋势摘要。 */
export function summarizeKline(k, days) {
  const all = k.rows
  const rows = all.slice(-Math.min(days, all.length))
  const closes = all.map((r) => r.close)
  const last = closes.at(-1)
  const prev = closes.at(-2)
  const ret = (n) => (closes.length > n ? (last / closes.at(-1 - n) - 1) * 100 : null)
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const ma = (n) => (closes.length >= n ? mean(closes.slice(-n)) : null)
  const windowCloses = rows.map((r) => r.close)
  const returns = windowCloses.slice(1).map((c, i) => c / windowCloses[i] - 1)
  const vol = returns.length > 5 ? Math.sqrt(mean(returns.map((r) => (r - mean(returns)) ** 2))) * Math.sqrt(252) * 100 : null
  let peak = windowCloses[0]
  let mdd = 0
  for (const c of windowCloses) {
    peak = Math.max(peak, c)
    mdd = Math.min(mdd, c / peak - 1)
  }
  const fmt = (v, suffix = '%') => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}${suffix}`)
  const rel = (m) => (m == null ? '—' : last > m ? '上方' : '下方')
  return [
    `**${k.name}** 最近 ${rows.length} 个交易日（${rows[0].date} → ${rows.at(-1).date}）`,
    `- 收盘：${last.toFixed(2)}（当日 ${fmt(prev ? (last / prev - 1) * 100 : null)}）`,
    `- 区间收益：5 日 ${fmt(ret(5))}　20 日 ${fmt(ret(20))}　60 日 ${fmt(ret(60))}`,
    `- 年化波动：${vol == null ? '—' : `${vol.toFixed(1)}%`}　区间最大回撤：${(mdd * 100).toFixed(1)}%`,
    `- MA20 ${ma(20)?.toFixed(2) ?? '—'}（价在${rel(ma(20))}）　MA60 ${ma(60)?.toFixed(2) ?? '—'}（价在${rel(ma(60))}）`,
  ].join('\n')
}

/** 格式化公告列表。 */
export function formatAnnouncements(code, list) {
  if (!list.length) return `${code} 近期没有需要关注的公告（已过滤 H 股月报表等噪音）。`
  const lines = list.slice(0, 12).map((a) => `- ${a.date}［${a.column || '公告'}］[${a.title}](${a.url})`)
  return `**${code} 近期公告（${list.length} 条，已过滤噪音）**\n${lines.join('\n')}`
}
