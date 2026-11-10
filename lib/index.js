/**
 * dsh-info-tools —— 跨领域前沿信息 + A 股行情，一套工具。
 *
 * 信息层是一个「源注册表」：每个源导出 meta + search()/trending()，
 * 新增领域只需加一个文件并在 SOURCES 里注册，不改工具代码。
 */

import {
  fetchAnnouncements, fetchKline, fetchQuote,
  formatAnnouncements, formatQuote, summarizeKline,
} from './sources/eastmoney.js'
import * as arxiv from './sources/arxiv.js'
import * as crossref from './sources/crossref.js'
import * as github from './sources/github.js'
import * as hn from './sources/hn.js'
import * as huggingface from './sources/huggingface.js'
import * as producthunt from './sources/producthunt.js'
import { dedupeGroups, isBlocked, pickHighlights } from './util.js'
import { daysAgo, isoDate } from './http.js'

export const name = 'info-tools'
export const inject = ['tools']

const SOURCES = [arxiv, crossref, github, hn, huggingface, producthunt]

const DOMAINS = ['ai', 'academic', 'opensource', 'community', 'models', 'product']

const DOMAIN_LABEL = {
  ai: 'AI / 机器学习',
  academic: '学术论文',
  opensource: '开源项目',
  community: '技术社区',
  models: '模型 / 数据集',
  product: '新产品',
}

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: String(value) }],
}

const CODE_DESC = '6 位代码，如 600519（贵州茅台）、300750（宁德时代）、510300（沪深300ETF）。指数用 sh000001、sh000300。'

function fail(err) {
  return `查询失败：${err instanceof Error ? err.message : String(err)}`
}

function sourcesFor(domains, capability) {
  const set = new Set(domains?.length ? domains : DOMAINS)
  return SOURCES.filter((s) => s.meta[capability] && s.meta.domains.some((d) => set.has(d)))
}

async function gather(sources, method, args) {
  const results = await Promise.allSettled(
    sources.map((s) => (method === 'search' ? s.search(args.query, args) : s.trending(args))),
  )
  const groups = []
  const failed = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const items = (r.value || []).filter((it) => !isBlocked(it))
      if (items.length) groups.push([sources[i].meta.name, items])
    } else {
      failed.push(sources[i].meta.name)
    }
  })
  return { groups: dedupeGroups(groups), failed }
}

/** 统一按 days 过滤：有的源（如 Hugging Face）不支持日期查询，在这里兜底。 */
function filterRecent(groups, days) {
  const cutoff = isoDate(daysAgo(days))
  return groups.map(([name, items]) => [name, items.filter((it) => !it.date || it.date >= cutoff)])
}

function noteOf(failed) {
  return failed.length ? `（${failed.join('、')} 暂时不可用，其余源正常）` : ''
}

function renderItem(it) {
  const meta = [
    it.date,
    it.metrics?.stars != null ? `★${it.metrics.stars}` : '',
    it.metrics?.points != null ? `${it.metrics.points} points` : '',
    it.metrics?.likes != null ? `♥${it.metrics.likes}` : '',
    it.metrics?.citations != null ? `引用 ${it.metrics.citations}` : '',
  ].filter(Boolean).join(' · ')
  return `- [${it.title}](${it.url})${meta ? ` — ${meta}` : ''}${it.summary ? `\n  ${it.summary}` : ''}`
}

function renderGroups(groups, note) {
  const parts = []
  for (const [source, items] of groups) {
    if (!items.length) continue
    const label = `${source}（${DOMAIN_LABEL[items[0].domain] || items[0].domain}）`
    parts.push(`### ${label}`)
    for (const it of items) parts.push(renderItem(it))
    parts.push('')
  }
  if (!parts.length) return note || '没有找到结果。可以换关键词，或放宽 days。'
  return (note ? note + '\n\n' : '') + parts.join('\n')
}

function capPerGroup(groups, limit) {
  const active = groups.filter(([, items]) => items.length).length || 1
  const per = Math.max(2, Math.ceil(limit / active))
  for (const [, items] of groups) items.splice(per)
  return groups
}

function groupByDomain(items) {
  const buckets = new Map()
  for (const it of items) {
    if (!buckets.has(it.domain)) buckets.set(it.domain, [])
    buckets.get(it.domain).push(it)
  }
  return DOMAINS.filter((d) => buckets.has(d)).map((d) => [d, buckets.get(d)])
}

function renderBrief(topic, days, flat, picks, note) {
  const counts = new Map()
  for (const it of flat) counts.set(it.domain, (counts.get(it.domain) || 0) + 1)
  const stat = DOMAINS.filter((d) => counts.has(d))
    .map((d) => `${DOMAIN_LABEL[d]} ${counts.get(d)}`)
    .join(' · ')

  const lines = [
    `# 主题简报：${topic}`,
    `过去 ${days} 天 · ${flat.length} 条 · ${stat}`,
  ]
  if (note) lines.push(note)

  if (picks.length) {
    lines.push('', '## 优先看')
    picks.forEach((it, i) => {
      lines.push(`${i + 1}. [${it.title}](${it.url}) — ${it.source} · ${it.date}`)
      if (it.summary) lines.push(`   ${it.summary}`)
    })
  }

  lines.push('', '## 按领域')
  for (const [domain, items] of groupByDomain(flat)) {
    lines.push(`### ${DOMAIN_LABEL[domain] || domain}`)
    for (const it of items) {
      lines.push(`- [${it.title}](${it.url}) — ${it.source} · ${it.date}`)
    }
    lines.push('')
  }

  lines.push('---', '> 由 dsh-info-tools 聚合公开来源，未做观点加工；结论请点原文核对。')
  return lines.join('\n')
}

export function apply(ctx) {
  // ---------- 跨领域信息 ----------

  ctx.tools.register({
    name: 'info_search',
    description:
      '跨领域搜索前沿信息：AI 论文（arXiv）、全学科论文（Crossref）、开源项目（GitHub）、技术社区（Hacker News）、模型（Hugging Face）。' +
      '返回标题、日期、链接、摘要和热度指标，已跨源去重。适合“最近有什么新进展/这个方向有哪些项目/有没有相关论文”。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，英文效果更好，如 "agent memory"、"diffusion policy"。' },
        domains: {
          type: 'array',
          items: { type: 'string', enum: DOMAINS },
          description: '限定领域，默认全部。可选：ai、academic、opensource、community、models。',
        },
        days: { type: 'integer', description: '回看天数，默认 60。' },
        limit: { type: 'integer', description: '总条数，默认 8，最多 20。' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20)
        const days = Math.min(Math.max(Number(args.days) || 60, 1), 365)
        const sources = sourcesFor(args.domains, 'search')
        if (!sources.length) return '没有匹配的源。'
        const { groups, failed } = await gather(sources, 'search', { query: args.query, days, limit })
        return renderGroups(capPerGroup(filterRecent(groups, days), limit), noteOf(failed))
      } catch (err) {
        return fail(err)
      }
    },
  })

  ctx.tools.register({
    name: 'info_trending',
    description:
      '查看某个领域最近在热什么（不需要关键词）：AI 论文、开源新项目、Hacker News 首页、Hugging Face 趋势模型、Product Hunt 新产品。' +
      '适合“今天有什么值得看的/最近流行什么”。',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: DOMAINS, description: '领域，默认 ai。' },
        limit: { type: 'integer', description: '总条数，默认 8，最多 20。' },
      },
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20)
        const domain = args.domain || 'ai'
        const sources = SOURCES.filter((s) => s.meta.trending && s.meta.domains.includes(domain))
        if (!sources.length) return `领域 ${domain} 暂不支持趋势。`
        const { groups, failed } = await gather(sources, 'trending', { limit })
        return renderGroups(capPerGroup(groups, limit), noteOf(failed))
      } catch (err) {
        return fail(err)
      }
    },
  })

  ctx.tools.register({
    name: 'info_brief',
    description:
      '围绕一个主题生成一页纸简报：多源聚合（论文/项目/社区/模型），跨源去重，按领域分组，并挑出 3 条“优先看”。' +
      '适合“帮我扫一下最近 X 的进展/给我一页纸摘要”。比 info_search 更适合直接读或转发。',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '主题，如 "embodied ai"、"RAG"、"world model"。' },
        domains: {
          type: 'array',
          items: { type: 'string', enum: DOMAINS },
          description: '限定领域，默认全部可搜索的源。',
        },
        days: { type: 'integer', description: '回看天数，默认 30，最多 365。' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const days = Math.min(Math.max(Number(args.days) || 30, 1), 365)
        const sources = sourcesFor(args.domains, 'search')
        if (!sources.length) return '没有匹配的源。'
        const { groups, failed } = await gather(sources, 'search', { query: args.topic, days, limit: 3 })
        const flat = filterRecent(groups, days).flatMap(([source, items]) => items.map((it) => ({ ...it, source })))
        if (!flat.length) {
          return `没有找到「${args.topic}」近 ${days} 天的内容。可以换关键词、放宽 days，或换 domains。`
        }
        const picks = pickHighlights(flat, 3)
        return renderBrief(args.topic, days, flat, picks, noteOf(failed))
      } catch (err) {
        return fail(err)
      }
    },
  })

  ctx.tools.register({
    name: 'info_sources',
    description: '列出当前可用的信息源与领域，以及每个源支持搜索还是趋势。当用户问“你能查哪些数据”时使用。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: TEXT_OUTPUT,
    async execute() {
      const lines = SOURCES.map((s) =>
        `- **${s.meta.name}**（${s.meta.domains.join(' / ')}）：${[s.meta.search ? '搜索' : '', s.meta.trending ? '趋势' : ''].filter(Boolean).join('、')}`)
      return `可用信息源：\n${lines.join('\n')}\n\n另有 A 股：stock_quote / stock_kline / stock_announcements。`
    },
  })

  // ---------- A 股（保持原有能力） ----------

  ctx.tools.register({
    name: 'stock_quote',
    description:
      '查询 A 股/ETF 的最新行情快照：价格、涨跌幅、开高低、PE、PB、总市值。' +
      '当用户问“某只股票现在多少钱/估值多少/今天涨跌”时使用。',
    parameters: {
      type: 'object',
      properties: {
        codes: { type: 'array', items: { type: 'string' }, description: `代码列表（1~10 个）。${CODE_DESC}` },
      },
      required: ['codes'],
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const codes = (args.codes || []).slice(0, 10)
        if (!codes.length) return '请至少提供一个股票代码。'
        const quotes = []
        for (const c of codes) {
          quotes.push(await fetchQuote(c))
          await new Promise((r) => setTimeout(r, 120))
        }
        return quotes.map(formatQuote).join('\n\n')
      } catch (err) {
        return fail(err)
      }
    },
  })

  ctx.tools.register({
    name: 'stock_kline',
    description:
      '查询 A 股/ETF 的日线走势摘要：区间收益、年化波动、最大回撤、MA20/MA60 位置。' +
      '当用户问“最近走势如何/趋势有没有走坏/波动多大”时使用。',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: CODE_DESC },
        days: { type: 'integer', description: '回看交易日数，默认 120，范围 20~500。' },
      },
      required: ['code'],
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const days = Math.min(Math.max(Number(args.days) || 120, 20), 500)
        return summarizeKline(await fetchKline(args.code, days), days)
      } catch (err) {
        return fail(err)
      }
    },
  })

  ctx.tools.register({
    name: 'stock_announcements',
    description:
      '查询 A 股最近 N 天的公司公告（业绩、回购、减持、诉讼等），带原文链接，已过滤 H 股月报表等噪音。' +
      '当用户问“最近有什么公告/有没有雷/为什么跌”时使用。',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: CODE_DESC },
        days: { type: 'integer', description: '回看天数，默认 7，范围 1~30。' },
      },
      required: ['code'],
      additionalProperties: false,
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
        const list = await fetchAnnouncements(args.code, days)
        return formatAnnouncements(args.code, list)
      } catch (err) {
        return fail(err)
      }
    },
  })
}
