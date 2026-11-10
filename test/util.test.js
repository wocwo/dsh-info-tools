import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTitle, dedupeGroups, pickHighlights, heat, isBlocked } from '../lib/util.js'

test('normalizeTitle 忽略大小写、标点、空格', () => {
  assert.equal(normalizeTitle('Hello, World!'), 'helloworld')
  assert.equal(normalizeTitle('  Agent  Memory  '), 'agentmemory')
})

test('dedupeGroups 跨源去重，保留先出现的', () => {
  const groups = [
    ['arXiv', [{ title: 'Same Paper', source: 'arXiv' }, { title: 'Only A', source: 'arXiv' }]],
    ['Crossref', [{ title: 'same paper!', source: 'Crossref' }]],
  ]
  const out = dedupeGroups(groups)
  assert.equal(out[0][1].length, 2)
  assert.equal(out[1][1].length, 0)
})

test('pickHighlights 优先领域多样', () => {
  const items = [
    { title: 'a', domain: 'ai', metrics: { citations: 100 }, date: '2026-01-01' },
    { title: 'b', domain: 'ai', metrics: { citations: 200 }, date: '2026-02-01' },
    { title: 'c', domain: 'opensource', metrics: { stars: 10 }, date: '2026-03-01' },
    { title: 'd', domain: 'community', metrics: { points: 5 }, date: '2026-04-01' },
  ]
  const picks = pickHighlights(items, 2)
  assert.equal(picks.length, 2)
  assert.notEqual(picks[0].domain, picks[1].domain)
})

test('isBlocked 过滤成人内容', () => {
  assert.equal(isBlocked({ title: 'x', summary: '成人 AI 实验' }), true)
  assert.equal(isBlocked({ title: 'Agent Memory', summary: '向量检索' }), false)
})

test('heat 对不同指标可比', () => {
  assert.ok(heat({ metrics: { stars: 1000 } }) > heat({ metrics: { stars: 10 } }))
  assert.equal(heat({}), 0)
})
