# dsh-info-tools

给 DeepSeek Harness 装一套**跨领域前沿信息 + A 股行情**工具。装好之后可以直接问：

- “最近 agent memory 有什么新论文和新项目？”
- “今天 Hacker News 在热什么？”
- “Hugging Face 上最近最火的模型是哪些？”
- “茅台现在多少钱？最近有什么公告？”

数据全部来自公开接口，不需要任何 API Key。

## 工具

### 跨领域信息

| 工具 | 作用 |
|---|---|
| `info_search` | 跨源搜索：arXiv / Crossref / GitHub / Hacker News / Hugging Face，返回标题、日期、链接、摘要、热度 |
| `info_trending` | 看某个领域最近在热什么，不需要关键词 |
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
info_search("agent memory", domains=["ai","opensource"], days=180)
→ arXiv: MRMMIA（记忆成员推断）、Oracle Agent Memory…
   GitHub: xerj-org/xerj ★18.6k、akitaonrails/ai-memory ★15.5k

info_trending("community")
→ HN: Goldman Sachs is pulling Claude Code… (790 points)

stock_quote(["600519","300750"])
→ 茅台 1444.99 / -0.55% / PE 21.0；宁德 248.64 / -2.19% / PE 13.4
```

## 架构

```
lib/
├── index.js            # 注册工具（信息 + A股）
├── http.js             # fetch 封装：IPv4 优先、超时、重试、清洗
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

- **无 API Key**：全部用公开接口；代价是速率限制（GitHub 未认证 10 次/分钟）和偶发不可用。
- **部分失败不影响整体**：`Promise.allSettled`，哪个源挂了就在结果里注明。
- **每个源内部排序**：arXiv 搜索按相关度、趋势按时间；GitHub 按 star；HN 按 points；HF 按 likes/trending。
- **输出给模型读**：Markdown 分组 + 日期 + 热度，摘要截断，避免 token 爆炸。
- **金融源单独处理**：行情以日线收盘为底（稳定），腾讯补 PE/PB；多只股票串行请求，避免东财并发限流。

## 试用

第一次用先看 [试用指南.md](试用指南.md)：8 个可直接复制的提问、结果判断标准、排查表。

## 上架

要发布到插件市场（npm + awesome-dsh-plugin PR），见 [PUBLISH.md](PUBLISH.md)。

## 安装

```bash
# 本地 link
dsh plugin --profile web add link:/absolute/path/to/dsh-info-tools

# 发布后
dsh plugin --profile web add dsh-info-tools
```

桌面端在会话里让 DSH 安装。

## 限制与合规

- 公开接口可能变动、限流、延迟；重要结论请点原文核对。
- 论文摘要、产品描述等为第三方内容，引用时保留链接。
- A 股行情约 15 分钟延迟，不构成投资建议。

## 已验证（2026-11-09，本机 DSH）

- `info_search("agent memory")`：arXiv / GitHub / Hugging Face 均有结果；
- `info_trending("community")`：HN 首页 5 条，含 points；
- `info_search` 部分源失败时会显示“（xx 暂时不可用）”；
- `stock_quote` / `stock_kline` / `stock_announcements` 迁移后正常。

## 下一步

- 加 `policy` 源（国务院/部委政策）→ 需要处理 HTML 抓取与日期解析；
- 加 `finance_news` 源（财联社/东财快讯）→ 复用 `stock-agent-starter` 里的过滤逻辑；
- 加 `info_brief` 工具：一次调用聚合多源，输出一页纸简报；
- 给每个源加缓存（10~30 分钟），减少限流。
