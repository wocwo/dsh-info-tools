## 新增插件

- 仓库：https://github.com/wocwo/chougenyan
- 条目文件：`data/plugins/wocwo__chougenyan.yml`
- 分类：`tools`

## 插件做什么

DSH 的跨领域信息与 A 股工具，共 6 个工具、7 个数据源：

- `info_search` / `info_trending` / `info_sources`
- `stock_quote` / `stock_kline` / `stock_announcements`

数据源：arXiv、Crossref、GitHub、Hacker News、Hugging Face、Product Hunt、东方财富。
全部使用公开接口，不需要 API Key。

## 检查

- [x] `package.json` 声明 `dsh.bundle.patch`
- [x] 仓库根目录有 `cordis.patch.yml`
- [x] 仓库创建满 1 天
- [x] 已加 `dsh-plugin` topic
- [x] npm 已发布 `dsh-info-tools@0.1.0`
