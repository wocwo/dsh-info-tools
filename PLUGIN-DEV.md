# 给 DeepSeek Harness 写插件：最小手册

> 以 `dsh-info-tools` 为例。看完你应该能自己加工具、命令，或做一个带 UI 的插件。

## 1. 一个 DSH 插件 = 一个 npm 包 + 一份挂载声明

```
my-plugin/
├── package.json          # 关键：dsh.bundle.patch 指向挂载文件
├── cordis.patch.yml      # 挂载声明：往 profile 里 insert 一行
├── lib/index.js          # 插件本体（cordis 插件）
└── README.md
```

`package.json`：

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "files": ["lib", "cordis.patch.yml", "README.md"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: my-plugin        # profile 里的唯一 id
      name: my-plugin      # 要加载的模块名（= 包名）
```

## 2. 插件本体：三个导出

```js
export const name = 'my-plugin'
export const inject = ['tools']   // 依赖的服务；拿不到就不会启动

export function apply(ctx, config) {
  // 在这里注册工具、命令、UI、事件监听
}
```

`ctx` 是 cordis 上下文，常用的服务：

| 服务 | 用途 |
|---|---|
| `ctx.tools` | 注册模型可调用的工具 |
| `ctx.commands` | 注册斜杠命令 |
| `ctx.on('session/event', ...)` | 监听会话事件 |
| `ctx.credentials` | 读写凭据 |
| `ctx.webServer` | 注册 HTTP 路由 / 注入页面 |
| `ctx.get('xxx')` | 可选服务，拿不到返回 undefined |

## 3. 注册一个工具

```js
ctx.tools.register({
  name: 'my_tool',
  description: '一句话告诉模型什么时候用它。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '查询内容' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  },
  async execute(args, exec) {
    return `你查的是：${args.query}`
  },
})
```

要点：

- `parameters` 是 **JSON Schema**（不是 TypeScript 类型）；注册时会校验；
- `output.schema` + `output.render` 必填；
- `execute` 返回的东西必须符合 `output.schema`；
- **不要在工具里 throw**：捕获后返回一句人话，模型能继续；
- 工具描述要写“什么时候用”，这是模型选工具的依据。

## 4. 安装与调试

```bash
# 本地 link 安装
dsh plugin --profile web add link:/absolute/path/to/my-plugin

# 发布后
dsh plugin --profile web add my-plugin
```

> 改完代码后，**在插件管理里禁用再启用**（或重启 DSH）。ESM 会缓存旧模块，HMR 不一定重载 `import` 进来的子模块——这次改 `sources/arxiv.js` 就遇到过。

调试顺序：

1. **先脱离 DSH 测**：`node scripts/smoke.js` 直接跑数据层，别在会话里盲试；
2. `node --check lib/index.js` 查语法；
3. 安装后看插件是否 `active`；
4. 工具报错时，先看是不是网络（fetch failed 很常见）。

## 5. 三种插件形态

| 形态 | 注册方式 | 例子 |
|---|---|---|
| 工具插件 | `ctx.tools.register` | 本项目的搜索/趋势/行情 |
| 命令插件 | `ctx.commands.register` | `/brief` 生成晨报 |
| UI 插件 | 客户端 bundle + 插槽 | 小鲸鱼挂件、主题 |

**建议从工具插件开始**：不需要前端构建，最容易跑通。

## 6. 发布

1. `npm publish`（包名唯一，`dsh.bundle` 字段必须保留）；
2. 在 DSH 插件市场里可被搜索到（取决于市场索引）；
3. README 写清楚：装了什么、怎么用、数据来源、限制。

## 7. 这个插件踩过的坑

- **Node fetch 连不上东财**：`dns.setDefaultResultOrder('ipv4first')`；
- **接口偶发超时**：重试 + 换主机 + 用日线收盘兜底；
- **公告噪音**：H 股月报表、法律意见书要过滤，否则工具输出没法用；
- **不要 import `@deepseek-ai/*`**：profile 里没有这些包，运行时会解析失败。只依赖 `ctx` 提供的服务。

## 8. 下一步可以加什么

- 新信息源（政策、专利、招聘、电商）：在 `lib/sources/` 加文件，`meta` 里声明领域；
- `info_brief`：一次聚合多个源，输出一页纸简报；
- `stock_screen`：全市场按 PE/涨幅/成交额筛选；
- 命令 `/trending ai`：不经过模型，直接出结果。
