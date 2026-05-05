"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listDocuments, DocumentRecord, supabase,
  deleteDocument, getMonthlySummary, MonthlySummary, updatePaymentStatus,
} from "@/lib/supabase";

type Filter = "all" | "receipt" | "invoice" | "quotation" | "unpaid" | "overdue";
type DocType = "receipt" | "invoice" | "quotation";

interface CustomerExtra {
  tel: string;
  email: string;
  contact: string;
  memo: string;
}

interface Template {
  id: string;
  name: string;
  doc_type: DocType;
  recipient_name: string;
  recipient_honorific: string;
  subject: string;
  payment_method: string;
  remarks: string;
  items: unknown[];
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  receipt:   { label: "領収書", color: "#10b981" },
  invoice:   { label: "請求書", color: "#3b82f6" },
  quotation: { label: "見積書", color: "#f59e0b" },
};

const TODAY = new Date().toISOString().split("T")[0];

// ---------- localStorage helpers ----------
function loadCustomerExtras(): Record<string, CustomerExtra> {
  try { return JSON.parse(localStorage.getItem("izaCustomers") || "{}"); } catch { return {}; }
}
function saveCustomerExtras(data: Record<string, CustomerExtra>) {
  try { localStorage.setItem("izaCustomers", JSON.stringify(data)); } catch {}
}
function loadTemplates(): Template[] {
  try { return JSON.parse(localStorage.getItem("izaTemplates") || "[]"); } catch { return []; }
}
function saveTemplates(tpls: Template[]) {
  try { localStorage.setItem("izaTemplates", JSON.stringify(tpls)); } catch {}
}

// ---------- navigate helpers ----------
function prefillAndNavigate(d: DocumentRecord, newType: DocType, router: ReturnType<typeof useRouter>, extra?: { fromDocType?: string; fromDocNumber?: string }) {
  const prefill = {
    docType: newType,
    fromDocType: extra?.fromDocType,
    fromDocNumber: extra?.fromDocNumber,
    recipientName: d.recipient_name,
    recipientHonorific: d.recipient_honorific || "御中",
    subject: d.subject || "",
    paymentMethod: d.payment_method || "",
    remarks: d.remarks || "",
    items: d.items || [],
  };
  sessionStorage.setItem("izaPrefill", JSON.stringify(prefill));
  router.push("/documents");
}

function buildMailtoHref(d: DocumentRecord): string {
  const t = TYPE_LABEL[d.doc_type];
  const subject = encodeURIComponent(`${t.label}（${d.doc_number}）_IZA株式会社`);
  const body = encodeURIComponent(
    `${d.recipient_name} ${d.recipient_honorific || "御中"}\n\nお世話になっております。IZA株式会社の高橋でございます。\n\n${t.label}をお送りいたします。\n下記URLよりご確認ください。\n\n${d.pdf_url || ""}\n\n何卒よろしくお願い申し上げます。\n\n--\nIZA株式会社\n高橋賢太朗\n〒180-0022 東京都武蔵野市境1-15-10 イストワール302\nTEL: 090-7542-9315\niza.japan2025@gmail.com`
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

// ---------- CSV export ----------
function exportCSV(docs: DocumentRecord[]) {
  const headers = ["日付", "種別", "書類番号", "宛名", "件名", "金額", "入金状態", "入金日", "振込期限", "Drive URL"];
  const rows = docs.map((d) => [
    d.issue_date,
    TYPE_LABEL[d.doc_type]?.label || d.doc_type,
    d.doc_number,
    `${d.recipient_name}${d.recipient_honorific || "御中"}`,
    d.subject || "",
    d.total_amount,
    d.doc_type === "invoice" ? (d.payment_status === "paid" ? "入金済" : "未収") : "-",
    d.paid_at || "",
    d.due_date || "",
    d.pdf_url || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IZA_書類一覧_${TODAY}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Main ----------
export default function HistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [paymentUpdating, setPaymentUpdating] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // 顧客マスタ
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [customerExtras, setCustomerExtras] = useState<Record<string, CustomerExtra>>({});
  const [editForm, setEditForm] = useState<CustomerExtra>({ tel: "", email: "", contact: "", memo: "" });

  // テンプレート
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    setCustomerExtras(loadCustomerExtras());
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    if (showSummary) getMonthlySummary(year).then(setSummary);
  }, [showSummary, year]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setDocs(await listDocuments({ limit: 200 }));
      setLoading(false);
    })();
  }, []);

  // ---------- 集計 ----------
  const unpaidCount  = useMemo(() => docs.filter((d) => d.doc_type === "invoice" && d.payment_status !== "paid").length, [docs]);
  const unpaidTotal  = useMemo(() => docs.filter((d) => d.doc_type === "invoice" && d.payment_status !== "paid").reduce((s, d) => s + d.total_amount, 0), [docs]);
  const overdueCount = useMemo(() => docs.filter((d) => d.doc_type === "invoice" && d.payment_status !== "paid" && d.due_date && d.due_date < TODAY).length, [docs]);
  const thisMonthInvoice = useMemo(() => {
    const ym = TODAY.slice(0, 7);
    return docs.filter((d) => d.doc_type === "invoice" && d.issue_date.startsWith(ym)).reduce((s, d) => s + d.total_amount, 0);
  }, [docs]);

  // ---------- フィルター ----------
  const filtered = useMemo(() => {
    let base = docs;
    if (filter === "unpaid")  base = docs.filter((d) => d.doc_type === "invoice" && d.payment_status !== "paid");
    else if (filter === "overdue") base = docs.filter((d) => d.doc_type === "invoice" && d.payment_status !== "paid" && d.due_date && d.due_date < TODAY);
    else if (filter !== "all") base = docs.filter((d) => d.doc_type === filter);
    if (search) base = base.filter(
      (d) =>
        d.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.subject || "").toLowerCase().includes(search.toLowerCase()) ||
        d.doc_number.includes(search)
    );
    return base;
  }, [docs, filter, search]);

  // ---------- ハンドラー ----------
  const handleDelete = async (d: DocumentRecord) => {
    if (!d.id) return;
    if (!confirm(`「${d.recipient_name}」の${TYPE_LABEL[d.doc_type].label}（${d.doc_number}）を削除しますか？\n\n※Google Drive上のPDFは削除されません。`)) return;
    try {
      await deleteDocument(d.id);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      alert("削除に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    }
  };

  const handleTogglePayment = async (d: DocumentRecord) => {
    if (!d.id) return;
    const newStatus = d.payment_status === "paid" ? "unpaid" : "paid";
    setPaymentUpdating(d.id);
    try {
      await updatePaymentStatus(d.id, newStatus);
      setDocs((prev) =>
        prev.map((x) =>
          x.id === d.id
            ? { ...x, payment_status: newStatus, paid_at: newStatus === "paid" ? TODAY : null }
            : x
        )
      );
    } catch (e) {
      alert("更新に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    } finally {
      setPaymentUpdating(null);
    }
  };

  const handleCopyAndMail = (d: DocumentRecord) => {
    prefillAndNavigate(d, d.doc_type as DocType, router);
    if (d.pdf_url) setTimeout(() => { window.open(buildMailtoHref(d), "_self"); }, 300);
  };

  // 顧客マスタ
  const openCustomerEdit = (name: string) => {
    setEditForm(customerExtras[name] || { tel: "", email: "", contact: "", memo: "" });
    setEditingCustomer(name);
  };
  const saveCustomerEdit = () => {
    if (!editingCustomer) return;
    const updated = { ...customerExtras, [editingCustomer]: editForm };
    setCustomerExtras(updated);
    saveCustomerExtras(updated);
    setEditingCustomer(null);
  };

  // テンプレート
  const saveAsTemplate = (d: DocumentRecord) => {
    const name = prompt("テンプレート名を入力してください:", `${d.recipient_name} ${TYPE_LABEL[d.doc_type].label}`);
    if (!name) return;
    const tpl: Template = {
      id: `${Date.now()}`,
      name,
      doc_type: d.doc_type as DocType,
      recipient_name: d.recipient_name,
      recipient_honorific: d.recipient_honorific || "御中",
      subject: d.subject || "",
      payment_method: d.payment_method || "",
      remarks: d.remarks || "",
      items: d.items || [],
    };
    const updated = [tpl, ...templates];
    setTemplates(updated);
    saveTemplates(updated);
    alert(`テンプレート「${name}」を保存しました`);
  };

  const applyTemplate = (tpl: Template) => {
    const prefill = {
      docType: tpl.doc_type,
      recipientName: tpl.recipient_name,
      recipientHonorific: tpl.recipient_honorific,
      subject: tpl.subject,
      paymentMethod: tpl.payment_method,
      remarks: tpl.remarks,
      items: tpl.items,
    };
    sessionStorage.setItem("izaPrefill", JSON.stringify(prefill));
    router.push("/documents");
  };

  const deleteTemplate = (id: string) => {
    if (!confirm("このテンプレートを削除しますか？")) return;
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  // ---------- Render ----------
  return (
    <main className="min-h-screen bg-slate-100">

      {/* 顧客マスタ編集モーダル */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-800">顧客情報編集</h2>
            <p className="text-sm font-semibold text-blue-700">{editingCustomer}</p>
            <div className="space-y-3">
              {(["tel", "email", "contact", "memo"] as const).map((key) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {key === "tel" ? "電話番号" : key === "email" ? "メールアドレス" : key === "contact" ? "担当者名" : "メモ"}
                  </label>
                  {key === "memo" ? (
                    <textarea
                      value={editForm[key]}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      rows={2}
                      placeholder="取引条件、支払サイクルなど"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <input
                      type={key === "email" ? "email" : key === "tel" ? "tel" : "text"}
                      value={editForm[key]}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      placeholder={key === "tel" ? "03-xxxx-xxxx" : key === "email" ? "contact@example.com" : "山田 太郎"}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingCustomer(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">キャンセル</button>
              <button onClick={saveCustomerEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center gap-3 shadow-sm">
        <Link href="/documents" className="text-blue-500 text-lg">‹</Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">書類履歴</h1>
          <p className="text-xs text-slate-400">{filtered.length}件</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 border border-slate-200"
        >
          CSV
        </button>
        <Link href="/documents" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700">
          + 新規作成
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">

        {/* ダッシュボード */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500">今月の請求合計</p>
            <p className="text-lg font-bold text-slate-800">¥{thisMonthInvoice.toLocaleString()}</p>
          </div>
          <div
            className={`rounded-xl p-3 border shadow-sm cursor-pointer transition-colors ${
              unpaidCount > 0 ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-white border-slate-200"
            }`}
            onClick={() => unpaidCount > 0 && setFilter("unpaid")}
          >
            <p className="text-xs text-slate-500">未収入金 ({unpaidCount}件)</p>
            <p className={`text-lg font-bold ${unpaidCount > 0 ? "text-red-700" : "text-slate-400"}`}>
              ¥{unpaidTotal.toLocaleString()}
            </p>
          </div>
          {overdueCount > 0 && (
            <div
              className="col-span-2 bg-orange-50 border border-orange-300 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-orange-100"
              onClick={() => setFilter("overdue")}
            >
              <p className="text-sm font-bold text-orange-800">⚠️ 支払期限超過 {overdueCount}件</p>
              <span className="text-xs text-orange-600 font-semibold">一覧を見る →</span>
            </div>
          )}
        </div>

        {/* テンプレート */}
        {templates.length > 0 && (
          <div>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={`w-full py-2 text-xs font-bold rounded-lg transition-all ${showTemplates ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-200"}`}
            >
              ⭐ 定期テンプレート（{templates.length}件）{showTemplates ? " ▲" : " ▼"}
            </button>
            {showTemplates && (
              <div className="mt-2 space-y-1.5">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="bg-white rounded-xl p-3 border border-indigo-100 flex items-center gap-3">
                    <span className="text-white text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: TYPE_LABEL[tpl.doc_type]?.color }}>
                      {TYPE_LABEL[tpl.doc_type]?.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{tpl.name}</p>
                      <p className="text-xs text-slate-400 truncate">{tpl.recipient_name} · {tpl.subject || "件名なし"}</p>
                    </div>
                    <button onClick={() => applyTemplate(tpl)} className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shrink-0">
                      使う
                    </button>
                    <button onClick={() => deleteTemplate(tpl.id)} className="text-xs px-2 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 shrink-0">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Monthly Summary */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary((v) => !v)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${showSummary ? "bg-purple-600 text-white" : "bg-white text-purple-700 border border-purple-200"}`}
          >
            📊 月次集計を{showSummary ? "閉じる" : "見る"}
          </button>
          {showSummary && (
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
              {[year + 1, year, year - 1, year - 2].map((y) => (<option key={y} value={y}>{y}年</option>))}
            </select>
          )}
        </div>

        {showSummary && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{year}年 月次集計</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left font-semibold text-slate-500">月</th>
                    <th className="p-2 text-right font-semibold text-emerald-600">領収書</th>
                    <th className="p-2 text-right font-semibold text-blue-600">請求書</th>
                    <th className="p-2 text-right font-semibold text-amber-600">見積書</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => {
                    const total = s.receipt_count + s.invoice_count + s.quotation_count;
                    return (
                      <tr key={s.month} className={`border-t border-slate-100 ${total === 0 ? "text-slate-300" : ""}`}>
                        <td className="p-2 font-semibold">{Number(s.month.slice(5))}月</td>
                        <td className="p-2 text-right">{s.receipt_count > 0 ? <><div>{s.receipt_count}件</div><div className="text-slate-400">¥{s.receipt_total.toLocaleString()}</div></> : "—"}</td>
                        <td className="p-2 text-right">{s.invoice_count > 0 ? <><div>{s.invoice_count}件</div><div className="text-slate-400">¥{s.invoice_total.toLocaleString()}</div></> : "—"}</td>
                        <td className="p-2 text-right">{s.quotation_count > 0 ? <><div>{s.quotation_count}件</div><div className="text-slate-400">¥{s.quotation_total.toLocaleString()}</div></> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td className="p-2">合計</td>
                    <td className="p-2 text-right text-emerald-600">{summary.reduce((s, m) => s + m.receipt_count, 0)}件<br/><span className="text-xs">¥{summary.reduce((s, m) => s + m.receipt_total, 0).toLocaleString()}</span></td>
                    <td className="p-2 text-right text-blue-600">{summary.reduce((s, m) => s + m.invoice_count, 0)}件<br/><span className="text-xs">¥{summary.reduce((s, m) => s + m.invoice_total, 0).toLocaleString()}</span></td>
                    <td className="p-2 text-right text-amber-600">{summary.reduce((s, m) => s + m.quotation_count, 0)}件<br/><span className="text-xs">¥{summary.reduce((s, m) => s + m.quotation_total, 0).toLocaleString()}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="grid grid-cols-3 gap-1.5">
          {(["all", "receipt", "invoice", "quotation", "unpaid", "overdue"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                filter === f
                  ? f === "all" ? "bg-slate-800 text-white"
                  : f === "unpaid" ? "bg-red-600 text-white"
                  : f === "overdue" ? "bg-orange-500 text-white"
                  : "text-white shadow"
                  : f === "unpaid" ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                  : f === "overdue" ? "bg-white text-orange-600 border border-orange-200 hover:bg-orange-50"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={filter === f && !["all","unpaid","overdue"].includes(f) ? { background: TYPE_LABEL[f].color } : {}}
            >
              {f === "all" ? "すべて" : f === "unpaid" ? "未収" : f === "overdue" ? "期限超過" : TYPE_LABEL[f].label}
            </button>
          ))}
        </div>

        {/* 検索 */}
        <input
          type="text"
          placeholder="宛名・件名・番号で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />

        {/* リスト */}
        {!supabase ? (
          <div className="bg-white rounded-xl p-6 text-center text-sm text-slate-400 border border-slate-200">Supabase未設定のため履歴が表示されません。</div>
        ) : loading ? (
          <div className="text-center text-sm text-slate-400 py-8">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-400 border border-slate-200">
            {filter === "unpaid" ? "未収入金はありません 🎉" : filter === "overdue" ? "期限超過の請求書はありません 🎉" : "まだ書類がありません"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const t = TYPE_LABEL[d.doc_type];
              const isPaid = d.payment_status === "paid";
              const isInvoice = d.doc_type === "invoice";
              const isOverdue = isInvoice && !isPaid && d.due_date && d.due_date < TODAY;
              const extra = customerExtras[d.recipient_name];
              return (
                <div key={d.id} className={`bg-white rounded-xl p-4 border shadow-sm ${isOverdue ? "border-orange-300" : isInvoice && !isPaid ? "border-red-200" : "border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-white text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5" style={{ background: t.color }}>
                      {t.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {d.recipient_name} {d.recipient_honorific || "御中"}
                        </p>
                        <button onClick={() => openCustomerEdit(d.recipient_name)} className="text-xs text-slate-400 hover:text-blue-500 shrink-0" title="顧客情報を編集">✏️</button>
                        {extra && (extra.contact || extra.tel) && (
                          <span className="text-xs text-slate-400">
                            {extra.contact && `👤 ${extra.contact}`}
                            {extra.contact && extra.tel && " · "}
                            {extra.tel && `📞 ${extra.tel}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{d.subject || "（件名なし）"} · {d.doc_number}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="text-xs text-slate-400">{d.issue_date}</p>
                        {d.due_date && isInvoice && (
                          <p className={`text-xs font-semibold ${isOverdue ? "text-orange-600" : "text-slate-400"}`}>
                            {isOverdue ? "⚠️" : "📅"} 期限: {d.due_date}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-800 text-sm">¥{d.total_amount.toLocaleString()}</p>
                      {isInvoice && (
                        <button
                          onClick={() => handleTogglePayment(d)}
                          disabled={paymentUpdating === d.id}
                          className={`mt-1 text-xs px-2 py-0.5 rounded-full font-bold border transition-colors ${
                            isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                   : isOverdue ? "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
                                   : "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                          }`}
                        >
                          {paymentUpdating === d.id ? "…" : isPaid ? "✓ 入金済" : isOverdue ? "期限超過" : "未収"}
                        </button>
                      )}
                      {d.pdf_url && <a href={d.pdf_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline mt-1">Drive</a>}
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {d.id && (
                      <Link href={`/preview/${d.id}`} className="text-xs px-2 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold">
                        👁️ プレビュー
                      </Link>
                    )}
                    <button onClick={() => prefillAndNavigate(d, d.doc_type as DocType, router)} className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                      📋 コピー
                    </button>
                    <button onClick={() => saveAsTemplate(d)} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                      ⭐ テンプレ
                    </button>
                    {d.doc_type !== "receipt" && (
                      <button onClick={() => prefillAndNavigate(d, "receipt", router)} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                        → 領収書
                      </button>
                    )}
                    {d.doc_type !== "invoice" && (
                      <button
                        onClick={() => prefillAndNavigate(d, "invoice", router, d.doc_type === "quotation" ? { fromDocType: "quotation", fromDocNumber: d.doc_number } : undefined)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        → 請求書{d.doc_type === "quotation" ? " ✓連携" : ""}
                      </button>
                    )}
                    {d.doc_type !== "quotation" && (
                      <button onClick={() => prefillAndNavigate(d, "quotation", router)} className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                        → 見積書
                      </button>
                    )}
                    {d.pdf_url ? (
                      <button onClick={() => handleCopyAndMail(d)} className="text-xs px-2 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">
                        📋✉️ コピー＆メール
                      </button>
                    ) : (
                      <a href={buildMailtoHref(d)} className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100">
                        ✉️ メール
                      </a>
                    )}
                    <button onClick={() => handleDelete(d)} className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 ml-auto">
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
