# dsh-info-tools

给 DeepSeek Harness 装一套**跨领域前沿信息 + A 股行情**工具。装好之后可以直接问：

- "最近 agent memory 有什么新论文和新项目？"
- "帮我扫一下 world model 最近 30 天的进展，给我一页纸。"
- "今天 Hacker News 在热什么？"
- "茅台现在多少钱？最近有什么公告？"

数据全部来自公开接口，不需要任何 API Key。

## 工具

### 跨领域信息

| 工具 | 作用 |
|---|---|
| `info_search` | 跨源搜索：arXiv / Crossref / GitHub / Hacker News / Hugging Face，返回标题、日期、链接、摘要、热度，已跨源去重 |
| `info_trending` | 看某个领域最近在热什么，不需要关键词 |
| `info_brief` | **一页纸简报**：多源聚合 + 去重 + 按领域分组 + 挑 3 条"优先看" |
| `info_sources` | 列出当前可用的源和领域 |

领域：`ai`、`academic`、`opensource`、`community`、`models`、`product`。

### A 股

| 工具 | 作用 |
|---|---|
| `stock_quote` | 最新价、涨跌幅、PE、PB、市值 |
| `stock_kline` | 区间收益、波动、回撤、MA20/MA60 |
| `stock_announcements` | 最近公告，带原文链接，已过滤 H 股月报表等噪音 |

## 示例

```
info_brief("agent memory", days=30)
→ 10 条 · AI 3 · 学术 3 · 开源 2 · 社区 2
  优先看：graphicle（代码记忆）、HN 的 OpenTelemetry 讨论、arXiv 的 FlyHash

info_search("world model", domains=["ai"], days=60)
→ arXiv 5 条，含 AnyGoal、Context Compaction for World Models

stock_quote(["600519","300750"])
→ 茅台 1444.99 / -0.55% / PE 21.0；宁德 248.64 / -2.19% / PE 13.4
```

## 0.2.0 更新

- **TTL 缓存**：同一 URL 10 分钟内只请求一次，并发合并；`DSH_INFO_CACHE_TTL=0` 可关。GitHub 的 10 次/分钟限制基本不再是问题。
- **跨源去重**：同一篇论文在 arXiv / Crossref 都出现时只保留一条。
- **`info_brief`**：一条命令出一页纸，按领域分组，自动挑"优先看"。
- **日期兜底**：Hugging Face 这类不支持日期查询的源，统一按 `days` 再过滤一次。
- **基础安全过滤**：成人内容不会进入结果和"优先看"。
- **测试**：`npm test`，12 个用例覆盖解析、缓存、去重、排序。

## 架构

```
lib/
├── index.js            # 注册工具（信息 + A股）
├── http.js             # fetch 封装：IPv4 优先、系统 CA、超时、重试、TTL 缓存
├── util.js             # 去重、热度、优先看、安全过滤
└── sources/
    ├── arxiv.js        # AI/学术预印本（Atom XML）
    ├── crossref.js     # 全学科论文（JSON）
    ├── github.js       # 开源项目（Search API）
    ├── hn.js           # Hacker News（Algolia API）
    ├── huggingface.js  # 模型（Hub API）
    ├── producthunt.js  # 新产品（Atom feed）
    └── eastmoney.js    # A股行情/公告（东财 + 腾讯备源）
```

每个源导出统一接口：

```js
export const meta = { id, name, domains: ['ai'], search: true, trending: true }
export async function search(query, { days, limit }) { return items }
export async function trending({ limit }) { return items }
```

**加一个新领域 = 加一个文件 + 在 `lib/index.js` 的 `SOURCES` 里注册一行。**

## 设计取舍

- **无 API Key**：全部公开接口；代价是速率限制和偶发不可用。
- **部分失败不影响整体**：`Promise.allSettled`，哪个源挂了就在结果里注明。
- **系统 CA 兜底**：有些代理会替换证书链，启动时把系统钥匙串 CA 并进 Node 默认列表；极端情况再用 `curl` 兜底。
- **输出给模型读**：Markdown 分组 + 日期 + 热度，摘要截断，避免 token 爆炸。
- **金融源单独处理**：行情以日线收盘为底，腾讯补 PE/PB；多只股票串行请求，避免东财并发限流。
- **可选 GitHub Token**：设置 `GITHUB_TOKEN` 可把搜索配额从 10 次/分钟提到 30 次/分钟。

## 安装

```bash
# 本地 link
dsh plugin --profile web add link:/absolute/path/to/dsh-info-tools

# npm
dsh plugin --profile web add dsh-info-tools
```

桌面端在会话里让 DSH 安装。

## 测试与冒烟

```bash
npm test                  # 12 个用例，约 0.2s
node scripts/smoke.js     # 打真实接口，看每个源是否可用
```

## 限制与合规

- 公开接口可能变动、限流、延迟；重要结论请点原文核对。
- 论文摘要、产品描述等为第三方内容，引用时保留链接。
- A 股行情约 15 分钟延迟，不构成投资建议。
- Product Hunt 在部分网络下会解析失败，工具会自动跳过并注明。

## 上架

要发布到插件市场（npm + awesome-dsh-plugin PR），见 [PUBLISH.md](PUBLISH.md)。

## 试用

第一次用先看 [试用指南.md](试用指南.md)：8 个可直接复制的提问、结果判断标准、排查表。

## License

MIT
