"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, DocumentRecord, supabase } from "@/lib/supabase";

type Filter = "all" | "receipt" | "invoice" | "quotation";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  receipt: { label: "領収書", color: "#10b981" },
  invoice: { label: "請求書", color: "#3b82f6" },
  quotation: { label: "見積書", color: "#f59e0b" },
};

export default function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3"
                >
                  <span
                    className="text-white text-xs font-bold px-2 py-1 rounded shrink-0"
                    style={{ background: t.color }}
                  >
                    {t.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {d.recipient_name} 御中
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
