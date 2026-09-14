# yinian-plugins

[安时（Nuncta）](https://github.com/VangelisHaha/nikou-agenda)的插件索引。

安时应用里的「插件市场」读的就是本仓库的 [`plugins.json`](plugins.json)。**这个仓库只存索引，不存插件代码**——每个插件住在自己的仓库里，通过 GitHub Release 分发 zip。

## 为什么索引这么小

`plugins.json` 只有 id、名字、作者、一句话说明、仓库地址和能力标签。会随发版变化的东西——版本号、宿主兼容区间、下载地址、校验和——**一概不在这里**，安时在展示详情和安装时直接从插件仓库现取。

理由很简单：任何写进索引的版本信息，都意味着插件作者每次发版都要回来改这个仓库，而忘了改就是「市场里显示的版本和实际装到的不一样」。索引里没有的东西不会过期。

## 提交一个插件

1. 你的插件仓库根目录必须有 `yinian-plugin.json`，格式见[插件契约](https://github.com/VangelisHaha/nikou-agenda/blob/main/docs/11-plugin-architecture.md)。
2. 用 GitHub Release 发布单个 zip，**tag 必须与 manifest 里的 `version` 完全一致**。zip 解压后顶层就是插件包结构，不要多包一层目录。
3. Fork 本仓库，往 `plugins.json` 末尾加一条，按 `name` 排好序：

```json
{
  "id": "yinian-feishu",
  "name": "飞书任务",
  "author": "vangelis",
  "description": "把飞书任务同步进安时，完成状态双向回写",
  "repo": "VangelisHaha/yinian-plugin-feishu",
  "contributes": ["sync:task", "hooks"]
}
```

4. 提交前本地跑一遍校验：

```bash
node scripts/validate.mjs            # 离线：结构、字段、id 唯一性
node scripts/validate.mjs --online   # 联网：去你的仓库拉 manifest 核对
```

5. 开 PR。CI 会跑联网档校验。

字段含义与约束见 [`schema.json`](schema.json)。

## 字段速查

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 与 manifest 的 `id` 完全一致，`^[a-z0-9][a-z0-9-]{1,62}$` |
| `name` | ✅ | 显示名，≤ 64 字符 |
| `author` | ✅ | ≤ 64 字符 |
| `description` | ✅ | 一句话，≤ 200 字符。写清「从哪同步什么」 |
| `repo` | ✅ | GitHub `owner/name`，不带 `https://` 与 `.git` |
| `contributes` | — | `sync:task` / `sync:event` / `notify` / `hooks`，只用于列表标签 |
| `homepage` | — | 缺省用 `https://github.com/<repo>` |

## 安全须知

插件是**用户态子进程，拿到的是你的完整用户权限**。安时在安装前会把 manifest 声明的权限原样摊给用户看，但收录进本索引**不代表代码经过安全审计**。

收录的判断标准只有三条：manifest 合法、仓库公开可读、说明与实际行为一致。装之前请自己看代码。

## 许可

索引数据以 MIT 许可发布。各插件的许可由其自己的仓库决定。
