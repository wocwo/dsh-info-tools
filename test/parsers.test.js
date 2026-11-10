import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEntries } from '../lib/sources/arxiv.js'
import { toItem as crossrefItem } from '../lib/sources/crossref.js'
import { toItem as hnItem } from '../lib/sources/hn.js'
import { toItem as hfItem } from '../lib/sources/huggingface.js'
import { parseFeed as parsePh } from '../lib/sources/producthunt.js'

test('arXiv 解析标题/日期/链接', () => {
  const xml = `<feed>
    <entry><id>http://arxiv.org/abs/2611.00001v1</id><title>Test
      Paper One</title><summary>Abstract one.</summary><published>2026-11-01T00:00:00Z</published></entry>
    <entry><id>http://arxiv.org/abs/2611.00002v1</id><title>Paper Two</title><summary>Abstract two.</summary><published>2026-11-02T00:00:00Z</published></entry>
  </feed>`
  const items = parseEntries(xml)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Test Paper One')
  assert.equal(items[0].date, '2026-11-01')
  assert.equal(items[0].url, 'https://arxiv.org/abs/2611.00001v1')
})

test('Crossref 丢弃 2203 年这种假日期', () => {
  const bad = crossrefItem({ title: ['X'], URL: 'https://doi.org/x', published: { 'date-parts': [[2203, 10]] } })
  assert.equal(bad.date, '')
  const ok = crossrefItem({ title: ['Y'], URL: 'https://doi.org/y', published: { 'date-parts': [[2026, 10, 1]] }, 'is-referenced-by-count': 3 })
  assert.ok(ok.date.startsWith('2026'))
  assert.equal(ok.metrics.citations, 3)
})

test('HN 没有外链时回退到讨论页', () => {
  const item = hnItem({ title: 'Ask HN', objectID: '123', created_at: '2026-11-01T00:00:00Z', points: 7 })
  assert.equal(item.url, 'https://news.ycombinator.com/item?id=123')
  assert.equal(item.metrics.points, 7)
})

test('Hugging Face 模型地址与指标', () => {
  const item = hfItem({ id: 'org/model', likes: 5, downloads: 10, tags: ['text-generation'], createdAt: '2026-10-01T00:00:00Z' })
  assert.equal(item.url, 'https://huggingface.co/org/model')
  assert.equal(item.metrics.likes, 5)
})

test('Product Hunt feed 解析并去掉噪音', () => {
  const xml = `<feed><entry><title>Watchflows</title><link rel="alternate" href="https://www.producthunt.com/products/watchflows"/><published>2026-11-01T00:00:00Z</published><content>Visual automation. Discussion | Link</content></entry></feed>`
  const items = parsePh(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Watchflows')
  assert.equal(items[0].summary, 'Visual automation.')
})
