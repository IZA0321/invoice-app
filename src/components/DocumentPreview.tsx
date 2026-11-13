/**
 * 書類プレビュー（見積書・納品書・請求書・領収書）
 * 書類作成画面（/documents）とサーバー側PDF生成（/render → /api/documents/create）で共用する。
 * 見た目を変えるときはここだけ直せば両方に反映される。
 */

export type DocType = "receipt" | "quotation" | "invoice" | "delivery";
export type Lang = "ja" | "en";
export type TaxMode = "exclusive" | "inclusive";
export type TaxCat = "10" | "8" | "0";
export type Honorific = "御中" | "様";
export type Currency = "JPY" | "USD" | "EUR";

export interface Item {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  taxCat: TaxCat;
}

export interface Company {
  nameJa: string;
  nameEn: string;
  addressJa: string;
  addressEn: string;
  registrationNo: string;
  tel: string;
  email: string;
}

export interface DocData {
  recipientName: string;
  recipientHonorific: Honorific;
  subject: string;
  docNumber: string;
  issueDate: string;
  extraDate: string;
  paymentMethod: string;
  remarks: string;
  items: Item[];
  totalAmountOverride: number;
  currency: Currency;
}

export const IZA_COMPANY: Company = {
  nameJa: "IZA株式会社",
  nameEn: "IZA Co., Ltd.",
  addressJa: "〒180-0022 東京都武蔵野市境1-15-10 イストワール302",
  addressEn: "Istoile 302, 1-15-10 Sakai, Musashino-shi, Tokyo 180-0022",
  registrationNo: "",
  tel: "090-7542-9315",
  email: "iza.japan2025@gmail.com",
};

// IZAデフォルト振込先
export const IZA_DEFAULT_BANK =
  "三井住友銀行\n支店名：トランクNORTH支店\n店番：403\n科目：普通\n口座番号：0381466\n口座名義：IZA株式会社\n口座名義カナ：イザ（カ";

export const IZA_LOGO = "/iza_logo.png";
export const IZA_STAMP = "/iza_kakuin.png";

export const CURRENCY_SYMBOLS: Record<Currency, string> = { JPY: "¥", USD: "$", EUR: "€" };

export const TAX_CATS: Record<TaxCat, { label: string; labelEn: string; rate: number }> = {
  "10": { label: "10%課税", labelEn: "10% Taxable", rate: 0.1 },
  "8": { label: "8%課税(軽減)", labelEn: "8% Reduced", rate: 0.08 },
  "0": { label: "非課税", labelEn: "Non-taxable", rate: 0 },
};

type Labels = { title: string; dateLabel: string; numberLabel: string; extraDateLabel: string };
export const DOC_TYPES: Record<DocType, { ja: Labels; en: Labels; color: string; prefix: string }> = {
  receipt: {
    ja: { title: "領収書", dateLabel: "領収日", numberLabel: "領収書番号", extraDateLabel: "支払日" },
    en: { title: "RECEIPT", dateLabel: "Date of Receipt", numberLabel: "Receipt No.", extraDateLabel: "Payment Date" },
    color: "#10b981", prefix: "REC",
  },
  quotation: {
    ja: { title: "見積書", dateLabel: "見積日", numberLabel: "見積書番号", extraDateLabel: "有効期限" },
    en: { title: "QUOTATION", dateLabel: "Quotation Date", numberLabel: "Quotation No.", extraDateLabel: "Valid Until" },
    color: "#f59e0b", prefix: "EST",
  },
  invoice: {
    ja: { title: "請求書", dateLabel: "請求日", numberLabel: "請求書番号", extraDateLabel: "振込期限" },
    en: { title: "INVOICE", dateLabel: "Invoice Date", numberLabel: "Invoice No.", extraDateLabel: "Payment Due" },
    color: "#3b82f6", prefix: "INV",
  },
  delivery: {
    ja: { title: "納品書", dateLabel: "納品日", numberLabel: "納品書番号", extraDateLabel: "検収期限" },
    en: { title: "DELIVERY NOTE", dateLabel: "Delivery Date", numberLabel: "Delivery No.", extraDateLabel: "Inspection Due" },
    color: "#8b5cf6", prefix: "DLV",
  },
};

export const DRIVE_FOLDER_NAMES: Record<DocType, "領収書" | "請求書" | "見積書" | "納品書"> = {
  receipt: "領収書",
  invoice: "請求書",
  quotation: "見積書",
  delivery: "納品書",
};

export function calcTax(items: Item[], taxMode: TaxMode) {
  let taxable10 = 0, taxable8 = 0, tax10 = 0, tax8 = 0, nonTaxable = 0, subTotalBeforeTax = 0;
  items.forEach((item) => {
    const lineTotal = item.unitPrice * item.quantity;
    const cat = item.taxCat || "10";
    const rate = TAX_CATS[cat].rate;
    if (cat === "0") {
      nonTaxable += lineTotal;
      subTotalBeforeTax += lineTotal;
    } else if (taxMode === "exclusive") {
      const taxAmt = Math.round(lineTotal * rate);
      if (cat === "10") { taxable10 += lineTotal; tax10 += taxAmt; }
      else { taxable8 += lineTotal; tax8 += taxAmt; }
      subTotalBeforeTax += lineTotal;
    } else {
      const beforeTax = Math.round(lineTotal / (1 + rate));
      const taxAmt = lineTotal - beforeTax;
      if (cat === "10") { taxable10 += beforeTax; tax10 += taxAmt; }
      else { taxable8 += beforeTax; tax8 += taxAmt; }
      subTotalBeforeTax += beforeTax;
    }
  });
  const totalTax = tax10 + tax8;
  const grandTotal = subTotalBeforeTax + totalTax + nonTaxable;
  return { taxable10, taxable8, tax10, tax8, nonTaxable, subTotalBeforeTax, totalTax, grandTotal };
}

export function totalOf(data: DocData, taxMode: TaxMode) {
  return data.totalAmountOverride > 0 ? data.totalAmountOverride : calcTax(data.items, taxMode).grandTotal;
}

export function makeFormatCurrency(currency: Currency) {
  const symbol = CURRENCY_SYMBOLS[currency];
  return (n: number) => {
    const num = currency === "JPY" ? Math.round(n || 0) : Number((n || 0).toFixed(2));
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: currency === "JPY" ? 0 : 2, maximumFractionDigits: 2 })}`;
  };
}

export function buildRemarks(docType: DocType, data: DocData, isJa: boolean) {
  let r = "";
  if (docType === "receipt") {
    if (data.paymentMethod) r += `${isJa ? "支払方法" : "Method"}: ${data.paymentMethod}\n`;
    // 領収書は領収日＝支払日のため支払日は表示しない
  }
  if (docType === "quotation") {
    if (data.extraDate) r += `${isJa ? "有効期限" : "Valid Until"}: ${data.extraDate}\n`;
    r += isJa ? "※本見積書は上記有効期限まで有効です。\n" : "* Valid until the date above.\n";
  }
  if (docType === "invoice") {
    if (data.paymentMethod) r += `${isJa ? "支払方法" : "Method"}: ${data.paymentMethod}\n`;
    if (data.extraDate) r += `${isJa ? "振込期限" : "Payment Due"}: ${data.extraDate}\n`;
  }
  if (data.remarks) r += (r ? "\n" : "") + data.remarks;
  return r;
}

export interface DocumentPreviewProps {
  docType: DocType;
  lang: Lang;
  data: DocData;
  company: Company;
  taxMode: TaxMode;
  logo: string | null;
  stamp: string | null;
  /** 番号の表示用プレフィックス（空ならEST/INV等の既定） */
  numberPrefix?: string;
}

export default function DocumentPreview({ docType, lang, data, company, taxMode, logo, stamp, numberPrefix }: DocumentPreviewProps) {
  const config = DOC_TYPES[docType];
  const l = config[lang];
  const isJa = lang === "ja";
  const formatCurrency = makeFormatCurrency(data.currency);
  const tc = calcTax(data.items, taxMode);
  const totalAmount = data.totalAmountOverride > 0 ? data.totalAmountOverride : tc.grandTotal;
  const effectivePrefix = numberPrefix || config.prefix;
  const remarksFull = buildRemarks(docType, data, isJa);
  const companyName = isJa ? company.nameJa : company.nameEn;
  const companyAddress = isJa ? company.addressJa : company.addressEn;
  const docNum = data.docNumber ? `${effectivePrefix}-${data.docNumber}` : "";
  const showRegistration = docType !== "quotation";
  const remarksLabel = isJa
    ? docType === "receipt" ? "備考 / 支払情報" : docType === "quotation" ? "備考 / 条件" : docType === "delivery" ? "備考 / 納品先" : "備考 / 振込先"
    : docType === "receipt" ? "Remarks / Payment" : docType === "quotation" ? "Remarks / Conditions" : docType === "delivery" ? "Remarks / Ship To" : "Remarks / Bank Info";

  return (
    <div className="w-full bg-white text-slate-800 flex flex-col relative" style={{ padding: "40px" }}>
      {/* Header（テーブルレイアウト：html2canvasで安定） */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "left", verticalAlign: "bottom", paddingBottom: "16px", borderBottom: `3px solid ${config.color}` }}>
              <div className="text-xs font-bold uppercase text-slate-500 mb-1">{isJa ? "宛名" : "Bill To"}</div>
              <div className="text-xl font-bold">{data.recipientName}{isJa && data.recipientName ? ` ${data.recipientHonorific}` : ""}</div>
            </td>
            <td style={{ textAlign: "right", verticalAlign: "bottom", whiteSpace: "nowrap", paddingBottom: "16px", borderBottom: `3px solid ${config.color}` }}>
              <div style={{ fontSize: "30px", fontWeight: 900, lineHeight: 1, color: config.color }}>{l.title}</div>
              <div className="text-xs text-slate-400" style={{ marginTop: "4px" }}>Page 1 / 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Subject + Total */}
      <div className="flex justify-between mb-6">
        <div>
          <span className="block text-xs font-bold uppercase text-slate-500">{isJa ? "件名" : "Subject"}</span>
          <span className="text-lg font-medium">{data.subject}</span>
        </div>
        <div className="text-right">
          <span className="block text-xs font-bold uppercase text-slate-500">{isJa ? "合計金額（税込）" : "Total Amount"}</span>
          <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full text-left">
          <thead style={{ backgroundColor: config.color + "12" }}>
            <tr>
              <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500">{isJa ? (docType === "receipt" ? "明細" : "摘要") : "Description"}</th>
              <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-center w-16">{isJa ? "数量" : "Qty"}</th>
              <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-right w-24">{isJa ? "単価" : "Unit Price"}</th>
              <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-center w-20">{isJa ? "税区分" : "Tax"}</th>
              <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500 text-right w-24">{isJa ? "金額" : "Amount"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((item, idx) => {
              const lineAmt = item.unitPrice * item.quantity;
              const cat = item.taxCat || "10";
              const catLabel = isJa ? TAX_CATS[cat].label : TAX_CATS[cat].labelEn;
              return (
                <tr key={idx}>
                  <td className="py-2.5 px-3 text-sm">{item.name}</td>
                  <td className="py-2.5 px-3 text-sm text-center">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2.5 px-3 text-xs text-center text-slate-500">{catLabel}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">{formatCurrency(lineAmt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-right mb-4">
        <span className="inline-block text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
          {taxMode === "exclusive" ? (isJa ? "税抜入力（外税）" : "Prices excl. tax") : (isJa ? "税込入力（内税）" : "Prices incl. tax")}
        </span>
      </div>

      {/* Remarks + Tax Summary */}
      <div className={`grid ${remarksFull ? "grid-cols-2" : "grid-cols-1"} gap-8 pt-5 border-t border-slate-200`}>
        {remarksFull && (
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">{remarksLabel}</h3>
            <div className="text-sm bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap">
              {remarksFull}
            </div>
          </div>
        )}
        <div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-sm text-slate-500">{isJa ? "税抜金額" : "Subtotal (excl. tax)"}</span>
            <span className="text-sm font-medium">{formatCurrency(tc.subTotalBeforeTax)}</span>
          </div>
          {tc.nonTaxable > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-xs text-slate-400">{isJa ? "うち非課税" : "Non-taxable"}</span>
              <span className="text-xs text-slate-400">{formatCurrency(tc.nonTaxable)}</span>
            </div>
          )}
          <div className="my-2 text-xs border border-slate-200 rounded overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-50 font-semibold">
              <div className="p-1 border-r border-slate-200">{isJa ? "税率" : "Rate"}</div>
              <div className="p-1 border-r border-slate-200 text-right">{isJa ? "対象金額" : "Taxable"}</div>
              <div className="p-1 text-right">{isJa ? "消費税額" : "Tax"}</div>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200">
              <div className="p-1 border-r border-slate-200">10%</div>
              <div className="p-1 border-r border-slate-200 text-right">{formatCurrency(tc.taxable10)}</div>
              <div className="p-1 text-right">{formatCurrency(tc.tax10)}</div>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200">
              <div className="p-1 border-r border-slate-200">8%</div>
              <div className="p-1 border-r border-slate-200 text-right">{formatCurrency(tc.taxable8)}</div>
              <div className="p-1 text-right">{formatCurrency(tc.tax8)}</div>
            </div>
          </div>
          <div className="flex justify-between py-2 text-lg font-bold border-t border-slate-200">
            <span>{isJa ? "合計" : "Total"}</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 grid grid-cols-3 text-xs text-slate-500" style={{ borderTop: `3px solid ${config.color}` }}>
        <div><span className="block font-bold">{l.dateLabel}</span>{data.issueDate}</div>
        <div><span className="block font-bold">{l.numberLabel}</span>{docNum}</div>
        {docType === "receipt" ? (
          company.registrationNo ? (
            <div><span className="block font-bold">{isJa ? "登録番号" : "Registration No"}</span>{company.registrationNo}</div>
          ) : <div />
        ) : showRegistration && company.registrationNo ? (
          <div><span className="block font-bold">{isJa ? "登録番号" : "Registration No"}</span>{company.registrationNo}</div>
        ) : (
          <div><span className="block font-bold">{l.extraDateLabel}</span>{data.extraDate}</div>
        )}
      </div>

      {/* Company + Logo + Stamp */}
      <div className="mt-6 flex justify-between items-end">
        <div>
          {companyName && <div className="font-bold text-slate-800">{companyName}</div>}
          {companyAddress && <div className="text-sm text-slate-600">{companyAddress}</div>}
          {company.tel && <div className="text-xs text-slate-500">TEL: {company.tel}</div>}
          {company.email && <div className="text-xs text-slate-500">{company.email}</div>}
        </div>
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {stamp && <div className="w-16 h-16 flex items-center justify-center"><img src={stamp} alt="Stamp" className="max-w-full max-h-full object-contain" /></div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <div className="w-20 h-20 flex items-center justify-center"><img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" /></div>}
        </div>
      </div>
    </div>
  );
}
