# 上架 DSH 插件市场：完整步骤

> 结论先说：**没有"上传"按钮。** 上架 = GitHub 仓库 + npm 包 + 往 `awesome-dsh-plugin` 提一个 YAML 文件的 PR。
> 市场每天从那份清单自动拉取，合并后通常一天内出现。

---

## 0. 上架前检查表

| 项 | 现状 | 要求 |
|---|---|---|
| `package.json` 里有 `dsh.bundle` | ✅ | 必须有，否则不可安装 |
| 有 `cordis.patch.yml` | ✅ | 与 `dsh.bundle.patch` 路径一致 |
| 有真实可跑的代码 | ✅ | 占位/纯 README 仓库不收 |
| LICENSE | ✅ MIT | 建议有 |
| GitHub 仓库 | ❌ 还没建 | 公开仓库，**创建满 1 天**才能提 PR |
| 仓库 topic `dsh-plugin` | ❌ | 提交前加上 |
| npm 包 | ❌ 还没发 | 可选，但市场优先用 npm 安装 |
| 描述与代码一致 | ✅ | 夸大是主要拒因 |

---

## 1. 建 GitHub 仓库

```bash
cd /Users/chougenyan/Desktop/xuexi/dsh-info-tools
git init
git add .
git commit -m "feat: dsh-info-tools 0.1.0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/dsh-info-tools.git
git push -u origin main
```

然后在 GitHub 仓库页：

- **About → Topics** 加 `dsh-plugin`；
- 确认 `package.json`、`cordis.patch.yml`、`lib/` 都在根目录。

> 仓库必须**创建满 1 天**才能过 CI。今天建好、明天提 PR 最稳。

---

## 2. 发布 npm 包（推荐）

包名 `dsh-info-tools` 目前在 npm 上**未被占用**（`npm view` 返回 404）。

```bash
npm login          # 浏览器授权，可能需要 2FA
npm publish --access public
```

发布前本地验证包内容：

```bash
npm pack --dry-run
```

应该看到 15 个文件、约 17 KB（`lib/`、`cordis.patch.yml`、README、LICENSE 等）。

发布后任何人可以：

```bash
dsh plugin --profile web add dsh-info-tools
```

> 如果之后包名被占，改用 scope：`@<你的npm名>/dsh-info-tools`，并同步改 `package.json` 的 `name`。

---

## 3. 提交到市场清单（关键一步）

市场列表来自 **[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)**，不是 dshmarket 仓库。

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 新建一个文件：`data/plugins/<你的GitHub用户名>__dsh-info-tools.yml`
3. 内容：

```yaml
url: https://github.com/<你的GitHub用户名>/dsh-info-tools
name: <你的GitHub用户名>/dsh-info-tools
category: tools
description:
  en: "Cross-domain search and A-share data for DSH: arXiv, Crossref, GitHub, Hacker News, Hugging Face, Product Hunt, plus stock quotes, klines and announcements."
  zh: "DSH 的跨领域信息与 A 股工具：arXiv、Crossref、GitHub、Hacker News、Hugging Face、Product Hunt，以及行情、走势与公告。"
```

4. 提 PR，标题类似 `Add dsh-info-tools`。

**注意**：

- YAML 里 `url` 必须与仓库地址**完全一致**；
- 描述里如果有 `: `（冒号+空格），必须加引号（上面已加）；
- 一个插件一个文件，不要改 README（README 是脚本生成的）；
- 文件名里的 `<owner>__<repo>` 用双下划线连接。

---

## 4. 审核会看什么

- 代码是否真的做了描述里说的事（工具数量、源的数量要对得上）；
- 分类是否合理（不会因为分类被打回，维护者会直接改）；
- 是否是真实可用的代码，不是空壳；
- 仓库是否满 1 天、是否活跃维护。

通过后合并，站点和市场的索引会自动刷新，**通常一天内**就能在市场的「发现」里搜到。

---

## 5. 不想等？自建索引（可选）

如果你只想自己或朋友能装，可以不做 PR：

1. 生成一个 format 1 的市场索引 `index.json`（列出包名、版本、描述、仓库）；
2. 托管到 GitHub Pages，或随 npm 包发布后用 `https://cdn.jsdelivr.net/npm/<包名>/index.json`；
3. 在 DSH：**插件 → 发现 → 索引源** 里添加这个 URL。

> 注意：dshmarket 的安装白名单只认精选清单里的来源；自建索引适合自用/小范围，正式上架仍建议走 PR。

---

## 6. 上架后怎么更新

- 改代码 → 升 `version`（0.1.0 → 0.1.1）；
- `npm publish`；
- 市场会按 npm 版本检测更新，不需要再提 PR；
- 如果改了插件名或仓库地址，才需要更新 YAML。

---

## 7. 常见被拒原因

| 原因 | 怎么避免 |
|---|---|
| 只声明了 `dsh.client`，没有 `dsh.bundle` | 必须有 `dsh.bundle.patch` |
| 仓库刚建几分钟 | 等满 1 天 |
| 描述夸大（"最强/全能/46 个工具"） | 只写实际有的 |
| 纯 README / 占位仓库 | 放真实代码 |
| 描述里有未加引号的 `: ` | 加引号 |
| 分类乱选 | 选最接近的，维护者会改 |
