"use client";

import { useState } from "react";
import Link from "next/link";
import { ReceiptData } from "@/types/receipt";
import { generateReceiptNo, todayString } from "@/lib/receiptUtils";

export default function NewReceiptPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ReceiptData>({
    receiptNo: generateReceiptNo(1),
    issueDate: todayString(),
    recipientName: "",
    amount: 0,
    description: "",
    taxRate: 10,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "amount" || name === "taxRate" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName || form.amount <= 0 || !form.description) {
      alert("宛名・金額・但し書きを入力してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/receipt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("PDF生成に失敗しました");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const recipientShort = form.recipientName.replace(/\s/g, "_");
      a.href = url;
      a.download = `${form.receiptNo}_${recipientShort}_領収書.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const taxExcluded =
    form.amount > 0
      ? Math.round(form.amount / (1 + form.taxRate / 100))
      : 0;
  const taxAmount = form.amount - taxExcluded;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
        <Link href="/" className="text-blue-500 text-lg">‹</Link>
        <div>
          <h1 className="text-lg font-bold text-gray-800">領収書 発行</h1>
          <p className="text-xs text-gray-500">No. {form.receiptNo}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* 日付 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-1">日付 <span className="text-red-400">*</span></label>
          <input
            type="date"
            name="issueDate"
            value={form.issueDate}
            onChange={handleChange}
            className="w-full text-gray-800 text-base border-0 outline-none bg-transparent"
            required
          />
        </div>

        {/* 領収書番号 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-1">領収書番号 <span className="text-red-400">*</span></label>
          <input
            type="text"
            name="receiptNo"
            value={form.receiptNo}
            onChange={handleChange}
            className="w-full text-gray-800 text-base font-mono border-0 outline-none bg-transparent"
            required
          />
          <p className="text-xs text-gray-400 mt-1">※ 自動採番されます。変更も可能です</p>
        </div>

        {/* 宛名 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            宛名 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="recipientName"
            value={form.recipientName}
            onChange={handleChange}
            placeholder="株式会社〇〇"
            className="w-full text-gray-800 text-base border-0 outline-none bg-transparent placeholder-gray-300"
            required
          />
          <p className="text-xs text-gray-400 mt-1">※「御中」は自動で付きます</p>
        </div>

        {/* 明細 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            明細 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="交流会参加費"
            className="w-full text-gray-800 text-base border-0 outline-none bg-transparent placeholder-gray-300"
            required
          />
          <p className="text-xs text-gray-400 mt-1">例：交流会参加費、コンサルティング料</p>
        </div>

        {/* 金額 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            金額（税込） <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-lg">¥</span>
            <input
              type="number"
              name="amount"
              value={form.amount || ""}
              onChange={handleChange}
              placeholder="0"
              min="1"
              className="flex-1 text-gray-800 text-xl font-semibold border-0 outline-none bg-transparent placeholder-gray-300"
              required
            />
          </div>
          {form.amount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>税抜金額</span>
                <span>¥{taxExcluded.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>消費税額（{form.taxRate}%）</span>
                <span>¥{taxAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* 消費税率 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 mb-2">消費税率</label>
          <div className="flex gap-3">
            {([10, 8] as const).map((rate) => (
              <label
                key={rate}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer font-semibold text-sm transition-colors ${
                  form.taxRate === rate
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                <input
                  type="radio"
                  name="taxRate"
                  value={rate}
                  checked={form.taxRate === rate}
                  onChange={handleChange}
                  className="sr-only"
                />
                {rate}%
              </label>
            ))}
          </div>
        </div>

        {/* プレビュー */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-blue-800 space-y-1">
          <p className="font-semibold text-blue-900 mb-2">発行内容の確認</p>
          <p>No. {form.receiptNo}</p>
          <p>日付: {form.issueDate}</p>
          <p>宛先: {form.recipientName || "（未入力）"}御中</p>
          <p>明細: {form.description || "（未入力）"}</p>
          <p>金額: ¥{form.amount > 0 ? form.amount.toLocaleString() : "0"}-</p>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-base shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "PDF生成中..." : "領収書を発行してダウンロード"}
        </button>

        <p className="text-center text-xs text-gray-400 pb-8">
          発行後、Google Driveの領収書フォルダに自動保存されます
        </p>
      </form>
    </main>
  );
}
