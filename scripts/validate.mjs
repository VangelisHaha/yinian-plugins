#!/usr/bin/env node
/**
 * 索引校验器。零依赖，只用 Node 标准库。
 *
 * 分两档跑：
 *
 * - 默认（离线）：JSON 结构、字段类型、id 规则与唯一性、repo 形态。任何环境都能跑，
 *   本地提 PR 前应先跑一遍。
 * - `--online`：额外去 GitHub 拉每个条目的 yinian-plugin.json，校验它真的存在、
 *   能解析、且 id 与索引里写的一致。CI 在 PR 上跑这一档。
 *
 * 为什么把联网检查做成可选：离线校验必须永远可用且秒回，否则没人会在提交前跑它；
 * 而联网检查依赖 GitHub 可达与限流，让它决定「校验器能不能用」是本末倒置。
 *
 * 退出码：0 全部通过，1 有错误。警告不影响退出码。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = join(ROOT, "plugins.json");

/** 与 schema.json 保持一致，改这里必须同步改 schema。 */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const CONTRIBUTES = new Set(["sync:task", "sync:event", "notify", "hooks"]);
const REQUIRED = ["id", "name", "author", "description", "repo"];
const OPTIONAL = ["contributes", "homepage"];
const MAX_LENGTHS = { name: 64, author: 64, description: 200 };

const errors = [];
const warnings = [];

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

function readIndex() {
  let raw;
  try {
    raw = readFileSync(INDEX_PATH, "utf8");
  } catch (error) {
    fail("plugins.json", `读不出来：${error.message}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    // 手改 JSON 最常见的错就是尾随逗号，直接把原始报错抛给作者最省事
    fail("plugins.json", `不是合法 JSON：${error.message}`);
    return null;
  }
}

function validateEntry(entry, index) {
  const where = `plugins.json[${index}]`;
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    fail(where, "每个条目必须是对象");
    return;
  }

  for (const key of REQUIRED) {
    const value = entry[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(where, `缺少必填字段 ${key}（或不是非空字符串）`);
    }
  }

  for (const key of Object.keys(entry)) {
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) {
      // 多余字段一律拒绝，而不是忽略：索引是给所有客户端读的，
      // 放行未知字段等于默许每人加一套私有约定
      fail(where, `不认识的字段 ${key}`);
    }
  }

  for (const [key, max] of Object.entries(MAX_LENGTHS)) {
    if (typeof entry[key] === "string" && entry[key].length > max) {
      fail(where, `${key} 超过 ${max} 字符`);
    }
  }

  if (typeof entry.id === "string" && !ID_PATTERN.test(entry.id)) {
    fail(where, `id「${entry.id}」不符合 ^[a-z0-9][a-z0-9-]{1,62}$`);
  }

  if (typeof entry.repo === "string" && !REPO_PATTERN.test(entry.repo)) {
    fail(where, `repo「${entry.repo}」必须是 owner/name，不要带 https:// 或 .git`);
  }

  if (entry.contributes !== undefined) {
    if (!Array.isArray(entry.contributes)) {
      fail(where, "contributes 必须是数组");
    } else {
      const seen = new Set();
      for (const item of entry.contributes) {
        if (!CONTRIBUTES.has(item)) {
          fail(
            where,
            `contributes 不认识「${item}」，合法值：${[...CONTRIBUTES].join(" / ")}`,
          );
        }
        if (seen.has(item)) fail(where, `contributes 有重复项「${item}」`);
        seen.add(item);
      }
      if (entry.contributes.length === 0) {
        warn(where, "contributes 为空数组，市场列表里不会有任何能力标签");
      }
    }
  } else {
    warn(where, "没写 contributes，市场列表里不会有能力标签");
  }

  if (entry.homepage !== undefined && !/^https?:\/\//.test(entry.homepage)) {
    fail(where, "homepage 必须以 http:// 或 https:// 开头");
  }
}

function validateUniqueness(entries) {
  const byId = new Map();
  const byRepo = new Map();
  entries.forEach((entry, index) => {
    if (typeof entry?.id === "string") {
      if (byId.has(entry.id)) {
        fail(
          `plugins.json[${index}]`,
          `id「${entry.id}」与第 ${byId.get(entry.id)} 条重复`,
        );
      } else {
        byId.set(entry.id, index);
      }
    }
    if (typeof entry?.repo === "string") {
      const key = entry.repo.toLowerCase();
      if (byRepo.has(key)) {
        fail(
          `plugins.json[${index}]`,
          `repo「${entry.repo}」与第 ${byRepo.get(key)} 条重复`,
        );
      } else {
        byRepo.set(key, index);
      }
    }
  });
}

/** 索引按 name 排序，纯粹为了让 PR diff 只出现新增的那一行。 */
function validateOrder(entries) {
  const names = entries
    .map((entry) => entry?.name)
    .filter((name) => typeof name === "string");
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "zh"));
  if (names.join("\u0000") !== sorted.join("\u0000")) {
    warn("plugins.json", "条目未按 name 排序，建议排好以减少后续 PR 的冲突");
  }
}

async function fetchManifest(repo) {
  // 两个默认分支都试：新仓库是 main，老仓库可能还是 master
  for (const branch of ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/yinian-plugin.json`;
    const response = await fetch(url);
    if (response.ok) return { url, text: await response.text() };
    if (response.status !== 404) {
      throw new Error(`${url} 返回 ${response.status}`);
    }
  }
  throw new Error(
    `main / master 分支的根目录都没有 yinian-plugin.json（必须在仓库根，不能放子目录）`,
  );
}

async function validateOnline(entries) {
  for (const [index, entry] of entries.entries()) {
    const where = `plugins.json[${index}]`;
    if (typeof entry?.repo !== "string" || typeof entry?.id !== "string") {
      continue;
    }
    try {
      const { url, text } = await fetchManifest(entry.repo);
      let manifest;
      try {
        manifest = JSON.parse(text);
      } catch (error) {
        fail(where, `${url} 不是合法 JSON：${error.message}`);
        continue;
      }
      if (manifest.id !== entry.id) {
        fail(
          where,
          `manifest 里的 id 是「${manifest.id}」，与索引里的「${entry.id}」不一致`,
        );
      }
      if (manifest.manifestVersion !== 1) {
        fail(where, `manifestVersion 必须是 1，实际是 ${manifest.manifestVersion}`);
      }
      for (const key of ["name", "version", "author", "minHostVersion"]) {
        if (typeof manifest[key] !== "string" || !manifest[key]) {
          fail(where, `manifest 缺少必填字段 ${key}`);
        }
      }
    } catch (error) {
      fail(where, `拉取 ${entry.repo} 的 manifest 失败：${error.message}`);
    }
  }
}

async function main() {
  const online = process.argv.includes("--online");
  const entries = readIndex();

  if (entries === null) {
    report();
    return;
  }
  if (!Array.isArray(entries)) {
    fail("plugins.json", "顶层必须是数组");
    report();
    return;
  }

  entries.forEach(validateEntry);
  validateUniqueness(entries);
  validateOrder(entries);
  if (online) await validateOnline(entries);

  if (errors.length === 0) {
    console.log(
      `校验通过：${entries.length} 个插件${online ? "（含联网检查）" : "（离线检查）"}`,
    );
  }
  report();
}

function report() {
  for (const message of warnings) console.warn(`[warn] ${message}`);
  for (const message of errors) console.error(`[error] ${message}`);
  if (errors.length > 0) {
    console.error(`\n共 ${errors.length} 个错误`);
    process.exitCode = 1;
  }
}

await main();
