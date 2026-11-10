import test from 'node:test'
import assert from 'node:assert/strict'
import { getText, clearCache, cacheSize } from '../lib/http.js'

test('相同 URL 在 TTL 内只请求一次，清缓存后重新请求', async () => {
  clearCache()
  let calls = 0
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    calls += 1
    return { ok: true, text: async () => `body-${calls}` }
  }
  try {
    assert.equal(await getText('https://example.test/a'), 'body-1')
    assert.equal(await getText('https://example.test/a'), 'body-1')
    assert.equal(calls, 1)
    assert.equal(cacheSize(), 1)

    clearCache()
    assert.equal(await getText('https://example.test/a'), 'body-2')
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = original
    clearCache()
  }
})

test('cache:false 绕过缓存', async () => {
  clearCache()
  let calls = 0
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    calls += 1
    return { ok: true, text: async () => 'x' }
  }
  try {
    await getText('https://example.test/b', { cache: false })
    await getText('https://example.test/b', { cache: false })
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = original
    clearCache()
  }
})
