# AGENTS.md — yinian-plugins

[安时（Nuncta）](https://github.com/VangelisHaha/nikou-agenda)插件**索引仓库**：只有 `plugins.json` 与它的校验器，没有业务代码。

- 中文回复，中文编写文档。改 `plugins.json` 或 `scripts/validate.mjs` 后必须跑 `node scripts/validate.mjs`（联网档 `--online` 视情况）。
- 校验规则改动必须同步三处：`scripts/validate.mjs`、`schema.json`、`README.md` 字段速查表。
- 不要往索引里加版本号、下载地址、校验和、宿主兼容区间（会过期）；不要放宽「不认识的字段一律拒绝」。
- 索引只认 manifest 的 `id`；其余元信息以插件仓库 manifest 为准，索引里的 `contributes` 只是列表页缓存。
- 校验器**零依赖**（仅 Node 标准库）；离线档必须永远可用，联网只能是可选 `--online`；警告不影响退出码。
- CI 只在 `plugins.json` / `schema.json` / `scripts/**` / 工作流变动时触发，不要扩大 paths、不加构建矩阵。
