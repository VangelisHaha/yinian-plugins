# AGENTS.md — yinian-plugins

[一念（Yinian）](https://github.com/VangelisHaha/nikou-agenda)的**插件索引仓库**。只有一份 `plugins.json` 和它的校验器，没有业务代码。

## 必须遵守

- 中文回复，中文编写文档。
- 改 `plugins.json` 或 `scripts/validate.mjs` 后必须跑 `node scripts/validate.mjs`，联网档 `--online` 视情况。
- 校验规则改动必须同步改三处：`scripts/validate.mjs`、`schema.json`、`README.md` 的字段速查表。三者不一致就是 bug。
- 不要往索引里加版本号、下载地址、校验和、宿主兼容区间。理由见 README「为什么索引这么小」——加进来就会过期。
- 不要放宽「不认识的字段一律拒绝」这条。索引是给所有客户端读的，放行未知字段等于默许每人加一套私有约定。

## 索引契约的权威位置

| 内容 | 权威文件 |
|---|---|
| 索引字段与约束 | 本仓库 `schema.json` |
| 插件 manifest、RPC、权限、错误码 | 主仓库 `docs/11-plugin-architecture.md` |

索引只认 manifest 的 `id`。其余插件元信息（版本、扩展点细节、权限）以插件仓库的 manifest 为准；索引里的 `contributes` 只是给列表页用的缓存，不一致时以 manifest 为准。

## 校验器设计约束

- **零依赖**，只用 Node 标准库。这个仓库不该有 `node_modules`。
- 离线档必须永远可用且秒回，联网检查只能是可选的 `--online`。让 GitHub 可达性决定「校验器能不能用」是本末倒置。
- 警告不影响退出码，只有错误才让 CI 失败。排序、缺 `contributes` 这类属于警告。

## CI 额度

`validate.yml` 只在 `plugins.json` / `schema.json` / `scripts/**` / 工作流本身变动时触发。不要扩大 paths 范围，也不要加构建矩阵——这个仓库没有需要跨平台验证的东西。
