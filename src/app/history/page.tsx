"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listDocuments, DocumentRecord, supabase, deleteDocument, getMonthlySummary, MonthlySummary } from "@/lib/supabase";

type Filter = "all" | "receipt" | "invoice" | "quotation";
type DocType = "receipt" | "invoice" | "quotation";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  receipt: { label: "領収書", color: "#10b981" },
  invoice: { label: "請求書", color: "#3b82f6" },
  quotation: { label: "見積書", color: "#f59e0b" },
};

function prefillAndNavigate(d: DocumentRecord, newType: DocType, router: ReturnType<typeof useRouter>) {
  const prefill = {
    docType: newType,
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

export default function HistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<MonthlySummary[]>([]);

  useEffect(() => {
    if (showSummary) {
      getMonthlySummary(year).then(setSummary);
    }
  }, [showSummary, year]);

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await listDocuments({
        docType: filter === "all" ? undefined : filter,
        limit: 200,
      });
      setDocs(result);
      setLoading(false);
    })();
  }, [filter]);

  const filtered = search
    ? docs.filter(
        (d) =>
          d.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
          (d.subject || "").toLowerCase().includes(search.toLowerCase()) ||
          d.doc_number.includes(search)
      )
    : docs;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center gap-3 shadow-sm">
        <Link href="/documents" className="text-blue-500 text-lg">‹</Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">書類履歴</h1>
          <p className="text-xs text-slate-400">{filtered.length}件</p>
        </div>
        <Link
          href="/documents"
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700"
        >
          + 新規作成
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* Monthly Summary Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary((v) => !v)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              showSummary ? "bg-purple-600 text-white" : "bg-white text-purple-700 border border-purple-200"
            }`}
          >
            📊 月次集計を{showSummary ? "閉じる" : "見る"}
          </button>
          {showSummary && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
            >
              {[year + 1, year, year - 1, year - 2].map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          )}
        </div>

        {/* Monthly Summary */}
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
                        <td className="p-2 text-right">
                          {s.receipt_count > 0 ? (
                            <>
                              <div>{s.receipt_count}件</div>
                              <div className="text-slate-400">¥{s.receipt_total.toLocaleString()}</div>
                            </>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-right">
                          {s.invoice_count > 0 ? (
                            <>
                              <div>{s.invoice_count}件</div>
                              <div className="text-slate-400">¥{s.invoice_total.toLocaleString()}</div>
                            </>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-right">
                          {s.quotation_count > 0 ? (
                            <>
                              <div>{s.quotation_count}件</div>
                              <div className="text-slate-400">¥{s.quotation_total.toLocaleString()}</div>
                            </>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td className="p-2">合計</td>
                    <td className="p-2 text-right text-emerald-600">
                      {summary.reduce((s, m) => s + m.receipt_count, 0)}件<br/>
                      <span className="text-xs">¥{summary.reduce((s, m) => s + m.receipt_total, 0).toLocaleString()}</span>
                    </td>
                    <td className="p-2 text-right text-blue-600">
                      {summary.reduce((s, m) => s + m.invoice_count, 0)}件<br/>
                      <span className="text-xs">¥{summary.reduce((s, m) => s + m.invoice_total, 0).toLocaleString()}</span>
                    </td>
                    <td className="p-2 text-right text-amber-600">
                      {summary.reduce((s, m) => s + m.quotation_count, 0)}件<br/>
                      <span className="text-xs">¥{summary.reduce((s, m) => s + m.quotation_total, 0).toLocaleString()}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="grid grid-cols-4 gap-2">
          {(["all", "receipt", "invoice", "quotation"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                filter === f
                  ? f === "all"
                    ? "bg-slate-800 text-white"
                    : "text-white shadow"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={
                filter === f && f !== "all"
                  ? { background: TYPE_LABEL[f].color }
                  : {}
              }
            >
              {f === "all" ? "すべて" : TYPE_LABEL[f].label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="宛名・件名・番号で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />

        {/* List */}
        {!supabase ? (
          <div className="bg-white rounded-xl p-6 text-center text-sm text-slate-400 border border-slate-200">
            Supabase未設定のため履歴が表示されません。
          </div>
        ) : loading ? (
          <div className="text-center text-sm text-slate-400 py-8">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-400 border border-slate-200">
            まだ書類がありません
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const t = TYPE_LABEL[d.doc_type];
              return (
                <div
                  key={d.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-white text-xs font-bold px-2 py-1 rounded shrink-0"
                      style={{ background: t.color }}
                    >
                      {t.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {d.recipient_name} {d.recipient_honorific || "御中"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {d.subject || "（件名なし）"} · {d.doc_number}
                      </p>
                      <p className="text-xs text-slate-400">{d.issue_date}</p>
                    </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-800 text-sm">
                      ¥{d.total_amount.toLocaleString()}
                    </p>
                    {d.pdf_url && (
                      <a
                        href={d.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Drive
                      </a>
                    )}
                  </div>
                  </div>
                  {/* アクションボタン */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => prefillAndNavigate(d, d.doc_type as DocType, router)}
                      className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      📋 コピー
                    </button>
                    {d.doc_type !== "receipt" && (
                      <button
                        onClick={() => prefillAndNavigate(d, "receipt", router)}
                        className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                      >
                        → 領収書
                      </button>
                    )}
                    {d.doc_type !== "invoice" && (
                      <button
                        onClick={() => prefillAndNavigate(d, "invoice", router)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        → 請求書
                      </button>
                    )}
                    {d.doc_type !== "quotation" && (
                      <button
                        onClick={() => prefillAndNavigate(d, "quotation", router)}
                        className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
                      >
                        → 見積書
                      </button>
                    )}
                    {d.pdf_url && (
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`${TYPE_LABEL[d.doc_type].label}（${d.doc_number}）_IZA株式会社`)}&body=${encodeURIComponent(
                          `${d.recipient_name} ${d.recipient_honorific || "御中"}\n\nお世話になっております。IZA株式会社の高橋でございます。\n\n${TYPE_LABEL[d.doc_type].label}をお送りいたします。\n下記URLよりご確認ください。\n\n${d.pdf_url}\n\n何卒よろしくお願い申し上げます。\n\n--\nIZA株式会社\n高橋賢太朗\n〒180-0022 東京都武蔵野市境1-15-10 イストワール302\nTEL: 090-7542-9315\niza.japan2025@gmail.com`
                        )}`}
                        className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100"
                      >
                        ✉️ メール送信
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(d)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 ml-auto"
                    >
                      🗑️ 削除
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
