/**
 * サーバー側の書類作成まわり（APIルートからのみ使う）
 * - 認証（サーバー専用secret か 書類アプリにログイン中のオーナーのトークン）
 * - Google Drive（AI秘書Botと同じOAuthクライアント／refresh token）
 * - Supabase（secretキーで documents に読み書き）
 * - PDF生成（ヘッドレスChromeで /render を開き、画面と同じ DocumentPreview を印刷）
 *
 * 必要な環境変数（Vercel）:
 *   DOCS_API_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
 *   SUPABASE_SECRET_KEY（＋既存の NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）
 */
import { timingSafeEqual } from "crypto";
import {
  DOC_TYPES,
  IZA_COMPANY,
  IZA_DEFAULT_BANK,
  IZA_LOGO,
  IZA_STAMP,
  totalOf,
  type Currency,
  type DocData,
  type DocType,
  type DocumentPreviewProps,
  type Honorific,
  type Item,
  type Lang,
  type TaxCat,
  type TaxMode,
} from "@/components/DocumentPreview";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const ALLOWED_EMAILS = ["iza.japan2025@gmail.com", "k.takahashi@iza-japan.com"];

// 各書類タイプの保存先Driveフォルダ（経理フォルダ 10sI9KGIg-EVI86aAxo3SET1abOlfO4R0 内）
const DRIVE_FOLDER_IDS: Record<DocType, string> = {
  receipt: "19PVh_2WVPlTi0pi0WfopZqYBpC1Tm4YT",
  invoice: "1FyHzhK7Y9znK-SCz9MJMHZ0MnhgQ_v4v",
  quotation: "1aT-fy4eWznnX7-Ermkk0z2Tj3CvXaYdg",
  delivery: "1QX_iqO4_9cHo8t67P6lBSuTj4JeYO031",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `環境変数 ${name} が未設定です`);
  return v;
}

// ---------- 認証 ----------
export async function authorize(authHeader: string | null): Promise<"secret" | "owner"> {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "unauthorized");
  const secret = process.env.DOCS_API_SECRET || "";
  if (secret) {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return "secret";
  }
  // 書類アプリにログイン中のオーナーのSupabaseトークン
  if (SUPABASE_URL && SUPABASE_ANON_KEY && token.split(".").length === 3) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const user = await res.json();
      if (ALLOWED_EMAILS.includes(String(user?.email || "").toLowerCase())) return "owner";
    }
  }
  throw new HttpError(401, "unauthorized");
}

// ---------- 入力 → 書類データ ----------
export interface CreateDocInput {
  doc_type: DocType;
  recipient_name: string;
  recipient_honorific?: Honorific;
  requester_name?: string | null;
  subject?: string;
  issue_date?: string; // YYYY-MM-DD（省略時は今日・日本時間）
  extra_date?: string; // 有効期限／検収期限／振込期限（省略時は issue_date）
  items: { name?: string; description?: string; quantity?: number; unit_price?: number; unitPrice?: number; tax_cat?: TaxCat; taxCat?: TaxCat }[];
  tax_mode?: TaxMode; // 既定: inclusive（税込入力）
  payment_method?: string; // 請求書・領収書は省略時「銀行振込」
  remarks?: string; // 請求書・領収書は省略時に振込先を自動入力。"" なら空欄
  doc_number?: string; // 省略時は自動採番（例 EST-20261029001）
  total_amount_override?: number;
  currency?: Currency;
  lang?: Lang;
}

export function todayJst(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeInput(raw: unknown): { input: CreateDocInput; data: DocData; taxMode: TaxMode; lang: Lang } {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "JSONオブジェクトを送ってください");
  const b = raw as CreateDocInput;
  if (!DOC_TYPES[b.doc_type]) throw new HttpError(400, "doc_type は quotation / delivery / invoice / receipt のいずれか");
  if (!b.recipient_name || typeof b.recipient_name !== "string") throw new HttpError(400, "recipient_name は必須です");
  if (!Array.isArray(b.items) || b.items.length === 0) throw new HttpError(400, "items は1件以上必要です");
  const issueDate = b.issue_date || todayJst();
  const extraDate = b.extra_date || issueDate;
  if (!DATE_RE.test(issueDate) || !DATE_RE.test(extraDate)) throw new HttpError(400, "日付は YYYY-MM-DD で指定してください");
  if (b.recipient_honorific && b.recipient_honorific !== "御中" && b.recipient_honorific !== "様") {
    throw new HttpError(400, "recipient_honorific は 御中 / 様");
  }
  if (b.tax_mode && b.tax_mode !== "inclusive" && b.tax_mode !== "exclusive") throw new HttpError(400, "tax_mode は inclusive / exclusive");

  const items: Item[] = b.items.map((it, i) => {
    const taxCat = (it.tax_cat ?? it.taxCat ?? "10") as TaxCat;
    if (!["10", "8", "0"].includes(taxCat)) throw new HttpError(400, `items[${i}].tax_cat は "10" / "8" / "0"`);
    const quantity = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unit_price ?? it.unitPrice ?? 0);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) throw new HttpError(400, `items[${i}] の数量・単価が数値ではありません`);
    return { id: i + 1, name: String(it.name ?? it.description ?? ""), quantity, unitPrice, taxCat };
  });

  const billing = b.doc_type === "invoice" || b.doc_type === "receipt";
  const data: DocData = {
    recipientName: b.recipient_name.trim(),
    recipientHonorific: b.recipient_honorific || "御中",
    subject: b.subject || "",
    docNumber: "",
    issueDate,
    extraDate,
    // 画面と同じ既定値：請求書・領収書は「銀行振込」＋振込先
    paymentMethod: b.doc_type === "quotation" ? "" : b.payment_method ?? (billing ? "銀行振込" : ""),
    remarks: b.remarks ?? (billing ? IZA_DEFAULT_BANK : ""),
    items,
    totalAmountOverride: Number(b.total_amount_override || 0),
    currency: b.currency || "JPY",
  };
  return { input: b, data, taxMode: b.tax_mode || "inclusive", lang: b.lang || "ja" };
}

export function withPrefix(docType: DocType, num: string): string {
  if (/^(REC|INV|EST|DLV)-/i.test(num)) return num;
  return `${DOC_TYPES[docType].prefix}-${num}`;
}
export function stripPrefix(num: string): string {
  return num.replace(/^(REC|INV|EST|DLV)-/i, "");
}

export function fileNameFor(docType: DocType, data: DocData, lang: Lang): string {
  const title = DOC_TYPES[docType][lang].title;
  const name = `${data.issueDate.replace(/-/g, "")}_${data.recipientName} ${data.recipientHonorific}_${title}.pdf`;
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

// ---------- Supabase（secretキー） ----------
function sbHeaders(extra: Record<string, string> = {}) {
  const key = env("SUPABASE_SECRET_KEY");
  // sb_secret_ 形式のキーは apikey ヘッダーのみで送る
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.split(".").length === 3) h.Authorization = `Bearer ${key}`; // 旧形式(JWT)のservice_roleキー
  return h;
}

async function sb(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}) {
  if (!SUPABASE_URL) throw new HttpError(500, "NEXT_PUBLIC_SUPABASE_URL が未設定です");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: sbHeaders(extraHeaders) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, body };
}

export async function nextDocNumber(docType: DocType): Promise<string> {
  const datePrefix = todayJst().replace(/-/g, "");
  const prefix = `${DOC_TYPES[docType].prefix}-`;
  const q = `documents?select=doc_number&doc_type=eq.${docType}&doc_number=like.*${datePrefix}*&order=doc_number.desc&limit=1`;
  const r = await sb(q);
  if (!r.ok) throw new HttpError(500, `採番の検索に失敗 (${r.status})`);
  const last = r.body?.[0]?.doc_number as string | undefined;
  const seq = last ? (parseInt(last.slice(-3), 10) || 0) + 1 : 1;
  return `${prefix}${datePrefix}${String(seq).padStart(3, "0")}`;
}

export async function insertDocument(rec: Record<string, unknown>): Promise<{ id: string } | { duplicate: true }> {
  const r = await sb("documents", { method: "POST", body: JSON.stringify(rec) }, { Prefer: "return=representation" });
  if (r.ok) return { id: r.body[0].id };
  const msg = JSON.stringify(r.body || {});
  if (r.status === 409 || msg.includes("23505")) return { duplicate: true };
  throw new HttpError(500, `履歴の登録に失敗 (${r.status}): ${msg.slice(0, 300)}`);
}

export async function updateDocument(id: string, fields: Record<string, unknown>) {
  const r = await sb(`documents?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fields) }, { Prefer: "return=minimal" });
  if (!r.ok) throw new HttpError(500, `履歴の更新に失敗 (${r.status})`);
}

export async function getDocument(id: string): Promise<{ id: string; doc_number: string; drive_file_id: string | null } | null> {
  const r = await sb(`documents?select=id,doc_number,drive_file_id&id=eq.${encodeURIComponent(id)}`);
  if (!r.ok) throw new HttpError(500, `履歴の取得に失敗 (${r.status})`);
  return r.body?.[0] ?? null;
}

export async function deleteDocumentRow(id: string) {
  const r = await sb(`documents?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
  if (!r.ok) throw new HttpError(500, `履歴の削除に失敗 (${r.status})`);
}

// ---------- Google Drive ----------
async function googleAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new HttpError(502, `Google認証に失敗: ${data.error || res.status}`);
  return data.access_token;
}

export async function uploadPdfToDrive(pdf: Uint8Array, fileName: string, docType: DocType): Promise<{ id: string; webViewLink: string }> {
  const token = await googleAccessToken();
  const boundary = `izaboundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  const meta = { name: fileName, mimeType: "application/pdf", parents: [DRIVE_FOLDER_IDS[docType]] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    Buffer.from(pdf),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new HttpError(502, `Driveアップロード失敗 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const uploaded = await res.json();
  // 画面からの保存と同じく「リンクを知っている全員が閲覧可」（LINE等で共有するため）
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions?supportsAllDrives=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  }).catch(() => undefined);
  return uploaded;
}

/** Driveのファイルをゴミ箱へ（完全削除はしない。30日間は復元可能） */
export async function trashDriveFile(fileId: string): Promise<boolean> {
  const token = await googleAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  return res.ok || res.status === 404;
}

// ---------- PDF生成 ----------
const A4_W = 794; // px（96dpi で 210mm）
const A4_H = 1123; // px（96dpi で 297mm）

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  // Vercel（Linux）では同梱のChromium。.env.local に VERCEL=1 が入るので環境変数ではなくOSで判定する
  if (process.platform === "linux" && !process.env.CHROME_PATH) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  // ローカル開発（Mac）は手元の Google Chrome を使う
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
}

export function previewProps(docType: DocType, data: DocData, taxMode: TaxMode, lang: Lang): DocumentPreviewProps {
  return { docType, lang, data, company: IZA_COMPANY, taxMode, logo: IZA_LOGO, stamp: IZA_STAMP };
}

export async function renderPdf(origin: string, props: DocumentPreviewProps): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: A4_W, height: A4_H, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument((p) => {
      (window as unknown as { __IZA_RENDER__: unknown }).__IZA_RENDER__ = p;
    }, props as unknown as Record<string, unknown>);
    await page.goto(`${origin}/render`, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector('html[data-render-ready="1"]', { timeout: 20000 });
    const height = await page.$eval("#preview-area", (el) => (el as HTMLElement).scrollHeight);
    // 画面からの保存と同じく、A4 1ページに収まらなければ中央寄せで縮小
    if (height > A4_H) {
      const scale = (A4_H - 12) / height; // 丸め誤差で2ページ目に溢れないよう少し余裕を持たせる
      await page.$eval(
        "#preview-area",
        (el, s) => {
          const e = el as HTMLElement;
          // transform だと印刷時の改ページ位置が変わらず下が切れるため、レイアウトごと縮める zoom を使う
          e.style.zoom = String(s);
          e.style.margin = "0 auto";
        },
        scale
      );
    }
    const pdf = await page.pdf({
      width: "210mm",
      height: "297mm",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      pageRanges: "1",
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

export { totalOf };
