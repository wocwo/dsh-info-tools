import * as arxiv from './lib/sources/arxiv.js'
import * as crossref from './lib/sources/crossref.js'
import * as github from './lib/sources/github.js'
import * as hn from './lib/sources/hn.js'
import * as hf from './lib/sources/huggingface.js'
import * as ph from './lib/sources/producthunt.js'

const sources = [arxiv, crossref, github, hn, hf]
for (const s of sources) {
  try {
    const items = await s.search('agent', { days: 90, limit: 3 })
    console.log(s.meta.name, 'search:', items.length, items[0]?.title?.slice(0, 60))
  } catch (e) {
    console.log(s.meta.name, 'search ERR', e.message)
  }
}
for (const s of [github, hn, hf, ph]) {
  try {
    const items = await s.trending({ limit: 3 })
    console.log(s.meta.name, 'trending:', items.length, items[0]?.title?.slice(0, 60))
  } catch (e) {
    console.log(s.meta.name, 'trending ERR', e.message)
  }
}
