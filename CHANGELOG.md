# Changelog

## 0.2.0

- 新增 `info_brief`：多源聚合、跨源去重、按领域分组、挑 3 条"优先看"。
- 新增 TTL 缓存（默认 10 分钟，`DSH_INFO_CACHE_TTL` 可调），并发请求合并。
- 新增跨源去重（归一化标题），同一论文不再重复出现。
- 新增日期兜底过滤：Hugging Face 等不支持日期查询的源按 `days` 二次过滤。
- 新增基础安全过滤：成人内容不进入结果。
- 修复 Node 在 TLS 中间人网络下 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`：启动时合并系统 CA，失败再走 curl。
- 支持 `GITHUB_TOKEN`（搜索配额 10 → 30 次/分钟）。
- Crossref 去掉假 mailto，429 时退避重试。
- 新增 `npm test`：12 个用例覆盖解析、缓存、去重、排序。
- 新增 `scripts/smoke.js`：真实接口冒烟。

## 0.1.0

- 首个版本：arXiv / Crossref / GitHub / Hacker News / Hugging Face / Product Hunt / 东方财富。
- 6 个工具：`info_search`、`info_trending`、`info_sources`、`stock_quote`、`stock_kline`、`stock_announcements`。
