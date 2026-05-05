"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDocumentById, DocumentRecord } from "@/lib/supabase";
import { generatePdfBlob } from "@/lib/pdfExport";

// ---------- IZA固定情報 ----------
const IZA = {
  nameJa: "IZA株式会社",
  addressJa: "〒180-0022 東京都武蔵野市境1-15-10 イストワール302",
  tel: "090-7542-9315",
  email: "iza.japan2025@gmail.com",
  stamp: "/iza_kakuin.svg",
  logo: "/iza_logo.png",
};

const DOC_CONFIG: Record<string, { title: string; color: string; dateLabel: string; numberLabel: string; dueDateLabel: string }> = {
  receipt:   { title: "領収書", color: "#10b981", dateLabel: "領収日",   numberLabel: "領収書番号", dueDateLabel: "支払日" },
  invoice:   { title: "請求書", color: "#3b82f6", dateLabel: "請求日",   numberLabel: "請求書番号", dueDateLabel: "振込期限" },
  quotation: { title: "見積書", color: "#f59e0b", dateLabel: "見積日",   numberLabel: "見積書番号", dueDateLabel: "有効期限" },
};

const TAX_CATS: Record<string, { label: string; rate: number }> = {
  "10": { label: "10%課税", rate: 0.1 },
  "8":  { label: "8%課税(軽減)", rate: 0.08 },
  "0":  { label: "非課税", rate: 0 },
};

// LINE botは description/unit_price 形式、webアプリは name/unitPrice 形式
interface Item { name?: string; description?: string; quantity: number; unitPrice?: number; unit_price?: number; taxCat?: string }

function normalizeItem(it: Item) {
  return {
    name: it.name || it.description || "",
    quantity: it.quantity ?? 1,
    unitPrice: it.unitPrice ?? it.unit_price ?? 0,
    taxCat: it.taxCat ?? "10",
  };
}

function calcTax(items: Item[]) {
  let taxable10 = 0, taxable8 = 0, tax10 = 0, tax8 = 0, nonTaxable = 0;
  for (const raw of items) {
    const it = normalizeItem(raw);
    const line = it.unitPrice * it.quantity;
    const cat = it.taxCat || "10";
    const rate = TAX_CATS[cat]?.rate ?? 0.1;
    if (cat === "0") { nonTaxable += line; continue; }
    // 内税として逆算
    const beforeTax = Math.round(line / (1 + rate));
    const taxAmt = line - beforeTax;
    if (cat === "10") { taxable10 += beforeTax; tax10 += taxAmt; }
    else              { taxable8  += beforeTax; tax8  += taxAmt; }
  }
  return { taxable10, taxable8, tax10, tax8, nonTaxable, subTotal: taxable10 + taxable8, totalTax: tax10 + tax8 };
}

function fmt(n: number) { return `¥${Math.round(n).toLocaleString()}`; }

export default function PreviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDocumentById(id).then((d) => {
      if (d) setDoc(d);
      else setNotFound(true);
      setLoading(false);
    });
  }, [id]);

  const items: Item[] = useMemo(() => (doc?.items as Item[]) || [], [doc]);
  const tc = useMemo(() => calcTax(items), [items]);
  const totalAmount = doc?.total_amount ?? (tc.subTotal + tc.totalTax + tc.nonTaxable);
  const cfg = DOC_CONFIG[doc?.doc_type || "invoice"];

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const blob = await generatePdfBlob("preview-area");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fname = `${doc.issue_date.replace(/-/g, "")}_${doc.recipient_name}_${cfg.title}.pdf`;
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PDF生成に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-400 text-sm">読み込み中...</p>
    </div>
  );

  if (notFound || !doc) return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
      <p className="text-slate-500 text-sm">書類が見つかりませんでした</p>
      <Link href="/history" className="text-blue-600 text-sm hover:underline">← 履歴に戻る</Link>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          html, body { width: 210mm; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden; }
          #preview-area, #preview-area * { visibility: visible; }
          #preview-area {
            position: absolute; left: 0; top: 0;
            width: 210mm !important; max-width: 210mm !important;
            margin: 0 !important; padding: 15mm !important;
            transform: none !important; box-shadow: none !important;
            background: white !important;
          }
          #toolbar { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100">
        {/* ツールバー */}
        <div id="toolbar" className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center gap-3 shadow-sm">
          <Link href="/history" className="text-blue-500 text-lg shrink-0">‹</Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {doc.recipient_name} {doc.recipient_honorific || "御中"} — {cfg.title}
            </p>
            <p className="text-xs text-slate-400">{doc.doc_number} · {doc.issue_date}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {doc.pdf_url && (
              <a
                href={doc.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
              >
                Drive
              </a>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="text-xs px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {downloading ? "生成中…" : "⬇️ PDFダウンロード"}
            </button>
          </div>
        </div>

        {/* プレビュー */}
        <div className="py-6 px-4 flex justify-center">
          <div
            id="preview-area"
            className="bg-white shadow-2xl w-full max-w-[210mm] p-10 text-slate-800 flex flex-col relative"
          >
            {/* ヘッダー */}
            <div className="flex justify-between items-start mb-8 pb-4" style={{ borderBottom: `3px solid ${cfg.color}` }}>
              <div>
                <h2 className="text-xs font-bold uppercase text-slate-500 mb-1">宛名</h2>
                <div className="text-xl font-bold">{doc.recipient_name} {doc.recipient_honorific || "御中"}</div>
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-black tracking-tight mb-1" style={{ color: cfg.color }}>{cfg.title}</h1>
                <div className="text-xs text-slate-400">Page 1 / 1</div>
              </div>
            </div>

            {/* 件名 + 合計 */}
            <div className="flex justify-between mb-6">
              <div>
                <span className="block text-xs font-bold uppercase text-slate-500">件名</span>
                <span className="text-lg font-medium">{doc.subject || "—"}</span>
              </div>
              <div className="text-right">
                <span className="block text-xs font-bold uppercase text-slate-500">合計金額（税込）</span>
                <span className="text-2xl font-bold">{fmt(totalAmount)}</span>
              </div>
            </div>

            {/* 明細テーブル */}
            <div className="mb-6">
              <table className="w-full text-left">
                <thead style={{ backgroundColor: cfg.color + "12" }}>
                  <tr>
                    <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500">摘要</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-center w-16">数量</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-right w-28">単価</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-center w-20">税区分</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-right w-28">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length > 0 ? items.map((raw, idx) => {
                    const it = normalizeItem(raw);
                    return (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-sm">{it.name}</td>
                      <td className="py-2.5 px-3 text-sm text-center">{it.quantity}</td>
                      <td className="py-2.5 px-3 text-sm text-right">{fmt(it.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-xs text-center text-slate-500">{TAX_CATS[it.taxCat]?.label || it.taxCat}</td>
                      <td className="py-2.5 px-3 text-sm text-right font-medium">{fmt(it.unitPrice * it.quantity)}</td>
                    </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="py-4 text-center text-xs text-slate-400">明細なし</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 備考 + 税計算 */}
            <div className="grid grid-cols-2 gap-8 pt-5 border-t border-slate-200">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  {doc.doc_type === "receipt" ? "備考 / 支払情報" : doc.doc_type === "quotation" ? "備考 / 条件" : "備考 / 振込先"}
                </h3>
                <div className="text-sm bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap" style={{ minHeight: 50 }}>
                  {[
                    doc.payment_method ? `支払方法: ${doc.payment_method}` : "",
                    doc.remarks || "",
                  ].filter(Boolean).join("\n") || "（備考なし）"}
                </div>
              </div>
              <div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-sm text-slate-500">税抜金額</span>
                  <span className="text-sm font-medium">{fmt(tc.subTotal + tc.nonTaxable)}</span>
                </div>
                <div className="my-2 text-xs border border-slate-200 rounded overflow-hidden">
                  <div className="grid grid-cols-3 bg-slate-50 font-semibold">
                    <div className="p-1 border-r border-slate-200">税率</div>
                    <div className="p-1 border-r border-slate-200 text-right">対象金額</div>
                    <div className="p-1 text-right">消費税額</div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-slate-200">
                    <div className="p-1 border-r border-slate-200">10%</div>
                    <div className="p-1 border-r border-slate-200 text-right">{fmt(tc.taxable10)}</div>
                    <div className="p-1 text-right">{fmt(tc.tax10)}</div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-slate-200">
                    <div className="p-1 border-r border-slate-200">8%</div>
                    <div className="p-1 border-r border-slate-200 text-right">{fmt(tc.taxable8)}</div>
                    <div className="p-1 text-right">{fmt(tc.tax8)}</div>
                  </div>
                </div>
                <div className="flex justify-between py-2 text-lg font-bold border-t border-slate-200">
                  <span>合計</span>
                  <span>{fmt(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="mt-6 pt-4 grid grid-cols-3 text-xs text-slate-500" style={{ borderTop: `3px solid ${cfg.color}` }}>
              <div><span className="block font-bold">{cfg.dateLabel}</span>{doc.issue_date}</div>
              <div><span className="block font-bold">{cfg.numberLabel}</span>{doc.doc_number}</div>
              <div><span className="block font-bold">{cfg.dueDateLabel}</span>{doc.due_date || "—"}</div>
            </div>

            {/* 発行者 */}
            <div className="mt-6 flex justify-between items-end">
              <div>
                <div className="font-bold text-slate-800">{IZA.nameJa}</div>
                <div className="text-sm text-slate-600">{IZA.addressJa}</div>
                <div className="text-xs text-slate-500">TEL: {IZA.tel}</div>
                <div className="text-xs text-slate-500">{IZA.email}</div>
              </div>
              <div className="flex items-end gap-3">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img src={IZA.stamp} alt="Stamp" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="w-20 h-20 flex items-center justify-center">
                  <img src={IZA.logo} alt="Logo" className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
