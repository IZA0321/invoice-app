#!/usr/bin/env node
/**
 * 書類API（/api/documents/create・/api/documents/delete）を呼ぶCLI。
 * 秘密キーは ~/.config/iza-secretary/docs_api_secret から読む（コマンド行には出さない）。
 *
 *   node scripts/docs-api.mjs create doc.json                 # PDF作成→Drive保存→履歴登録
 *   node scripts/docs-api.mjs create doc.json --dry-run out.pdf  # 保存せずPDFだけ作って確認
 *   cat doc.json | node scripts/docs-api.mjs create -          # 標準入力から
 *   node scripts/docs-api.mjs delete <書類のid>               # 履歴削除＋DriveのPDFをゴミ箱へ
 *
 * 接続先は既定で本番。--base http://localhost:3100 または環境変数 DOCS_API_BASE で変更。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRET_FILE = join(homedir(), ".config/iza-secretary/docs_api_secret");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = (opt("--base") || process.env.DOCS_API_BASE || "https://invoice-app-theta-henna.vercel.app").replace(/\/$/, "");
const dryRunOut = opt("--dry-run");
const [cmd, target] = args;

function die(msg) {
  console.error(msg);
  process.exit(1);
}
if (!cmd || !target) die("使い方: node scripts/docs-api.mjs create <doc.json|-> [--dry-run out.pdf] | delete <id>");

let secret;
try {
  secret = readFileSync(SECRET_FILE, "utf8").trim();
} catch {
  die(`秘密キーが読めません: ${SECRET_FILE}`);
}
const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

if (cmd === "create") {
  const body = JSON.parse(readFileSync(target === "-" ? 0 : target, "utf8"));
  if (dryRunOut) body.dry_run = true;
  const res = await fetch(`${base}/api/documents/create`, { method: "POST", headers, body: JSON.stringify(body) });
  if (dryRunOut && res.ok) {
    writeFileSync(dryRunOut, Buffer.from(await res.arrayBuffer()));
    console.log(JSON.stringify({ ok: true, dry_run: true, saved: dryRunOut, doc_number: res.headers.get("x-doc-number"), file_name: decodeURIComponent(res.headers.get("x-file-name") || "") }, null, 2));
  } else {
    const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    console.log(JSON.stringify(json, null, 2));
    if (!res.ok) process.exit(1);
  }
} else if (cmd === "delete") {
  const res = await fetch(`${base}/api/documents/delete`, { method: "POST", headers, body: JSON.stringify({ id: target }) });
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
} else {
  die(`不明なコマンド: ${cmd}`);
}
