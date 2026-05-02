"use client";

import { useState, useEffect, useMemo } from "react";
import { generatePdfBlob } from "@/lib/pdfExport";
import { uploadPdfToDrive } from "@/lib/googleDrive";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// --- Icons ---
const IconPrinter = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
  </svg>
);
const IconFileText = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconUpload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconPlus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconTrash2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);
const IconLoader2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const IconAlertCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconImage = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);
const IconSave = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);
const IconChevron = ({ className, open }: { className?: string; open: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// --- Types ---
type DocType = "receipt" | "quotation" | "invoice";
type Lang = "ja" | "en";
type TaxMode = "exclusive" | "inclusive";
type TaxCat = "10" | "8" | "0";

interface Item {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  taxCat: TaxCat;
}

interface Company {
  nameJa: string;
  nameEn: string;
  addressJa: string;
  addressEn: string;
  registrationNo: string;
  tel: string;
  email: string;
}

interface DocData {
  recipientName: string;
  subject: string;
  docNumber: string;
  issueDate: string;
  extraDate: string;
  paymentMethod: string;
  remarks: string;
  items: Item[];
  totalAmountOverride: number;
}

// --- IZA Default Company ---
const IZA_COMPANY: Company = {
  nameJa: "IZA株式会社",
  nameEn: "IZA Co., Ltd.",
  addressJa: "〒180-0022 東京都武蔵野市境1-15-10 イストワール302",
  addressEn: "Istoile 302, 1-15-10 Sakai, Musashino-shi, Tokyo 180-0022",
  registrationNo: "",
  tel: "090-7542-9315",
  email: "iza.japan2025@gmail.com",
};

// --- Tax Categories ---
const TAX_CATS: Record<TaxCat, { label: string; labelEn: string; rate: number }> = {
  "10": { label: "10%課税", labelEn: "10% Taxable", rate: 0.1 },
  "8": { label: "8%課税(軽減)", labelEn: "8% Reduced", rate: 0.08 },
  "0": { label: "非課税", labelEn: "Non-taxable", rate: 0 },
};

// --- Document Type Configs ---
const DOC_TYPES: Record<DocType, { ja: { title: string; dateLabel: string; numberLabel: string; extraDateLabel: string }; en: { title: string; dateLabel: string; numberLabel: string; extraDateLabel: string }; color: string; prefix: string }> = {
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
};

// --- UI Components ---
const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white border border-slate-200 rounded-xl ${className}`} style={style}>{children}</div>
);
const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ${className}`}>{children}</label>
);
const Input = ({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`} {...props} />
);
const SelectEl = ({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none ${className}`} {...props}>{children}</select>
);
const Textarea = ({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none ${className}`} {...props} />
);

const Collapsible = ({ title, children, defaultOpen = true, accent = "" }: { title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: string }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`overflow-hidden ${accent}`}>
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        <IconChevron className="w-4 h-4 text-slate-400" open={open} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </Card>
  );
};

// --- Main App ---
export default function DocumentApp() {
  const today = new Date().toISOString().split("T")[0];

  const defaultData: DocData = {
    recipientName: "", subject: "", docNumber: "",
    issueDate: today, extraDate: today,
    paymentMethod: "", remarks: "",
    items: [{ id: Date.now(), name: "", quantity: 1, unitPrice: 0, taxCat: "10" }],
    totalAmountOverride: 0,
  };

  // IZAデフォルト振込先
  const IZA_DEFAULT_BANK =
    "三井住友銀行\n支店名：トランクNORTH支店\n店番：403\n科目：普通\n口座番号：0381466\n口座名義：IZA株式会社\n口座名義カナ：イザ（カ";

  const [docType, setDocType] = useState<DocType>("receipt");
  const [lang, setLang] = useState<Lang>("ja");
  const [data, setData] = useState<DocData>(defaultData);
  const [company, setCompany] = useState<Company>(IZA_COMPANY);
  const [numberPrefix, setNumberPrefix] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>("/iza_kakuin.svg");
  const [taxMode, setTaxMode] = useState<TaxMode>("inclusive");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedBank, setSavedBank] = useState(IZA_DEFAULT_BANK);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("izaDocCompany");
      if (saved) setCompany(JSON.parse(saved));
      else setCompany(IZA_COMPANY);
      const savedLogo = localStorage.getItem("izaDocLogo");
      if (savedLogo) setLogo(savedLogo);
      const savedStamp = localStorage.getItem("izaDocStamp");
      if (savedStamp) setStamp(savedStamp);
      const savedPrefix = localStorage.getItem("izaDocPrefix");
      if (savedPrefix) setNumberPrefix(savedPrefix);
      const savedTaxMode = localStorage.getItem("izaDocTaxMode");
      if (savedTaxMode) setTaxMode(savedTaxMode as TaxMode);
      const savedBankInfo = localStorage.getItem("izaDocBank");
      if (savedBankInfo) setSavedBank(savedBankInfo);
    } catch {}
  }, []);

  // 書類種別切替時に振込先を自動セット
  useEffect(() => {
    if (docType === "invoice") {
      setData((prev) => ({
        ...prev,
        paymentMethod: prev.paymentMethod || "銀行振込",
        remarks: prev.remarks || savedBank,
      }));
    }
  }, [docType]);

  const saveCompany = () => {
    try {
      localStorage.setItem("izaDocCompany", JSON.stringify(company));
      if (numberPrefix) localStorage.setItem("izaDocPrefix", numberPrefix);
      localStorage.setItem("izaDocTaxMode", taxMode);
      alert("会社情報を保存しました");
    } catch { alert("保存に失敗しました"); }
  };

  const saveBank = () => {
    try {
      localStorage.setItem("izaDocBank", data.remarks);
      setSavedBank(data.remarks);
      alert("振込先情報を保存しました");
    } catch { alert("保存に失敗しました"); }
  };

  const applyBank = () => {
    setData((prev) => ({ ...prev, remarks: savedBank, paymentMethod: "銀行振込" }));
  };

  const config = DOC_TYPES[docType];
  const labels = config[lang];
  const effectivePrefix = numberPrefix || config.prefix;
  const formatCurrency = (n: number) => `¥${Math.round(n || 0).toLocaleString()}`;

  const taxCalc = useMemo(() => {
    let taxable10 = 0, taxable8 = 0, tax10 = 0, tax8 = 0, nonTaxable = 0, subTotalBeforeTax = 0;
    data.items.forEach((item) => {
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
  }, [data.items, taxMode]);

  const totalAmount = data.totalAmountOverride > 0 ? data.totalAmountOverride : taxCalc.grandTotal;

  const handlePrint = () => {
    const orig = document.title;
    const recipient = data.recipientName || "Unknown";
    const num = data.docNumber || "NoNumber";
    document.title = `${recipient}_${labels.title}_${effectivePrefix}-${num}`;
    window.print();
    setTimeout(() => { document.title = orig; }, 1000);
  };

  const [savingDrive, setSavingDrive] = useState(false);

  const handleSaveToDrive = async () => {
    if (!GOOGLE_CLIENT_ID) {
      alert("Google Client ID が設定されていません。\n環境変数 NEXT_PUBLIC_GOOGLE_CLIENT_ID をVercelで設定してください。");
      return;
    }
    if (!data.recipientName) {
      alert("宛名を入力してください");
      return;
    }
    setSavingDrive(true);
    try {
      const blob = await generatePdfBlob("preview-area");
      const dateStr = data.issueDate.replace(/-/g, "");
      const fileName = `${dateStr}_${data.recipientName} 御中_${labels.title}.pdf`;
      const folderName = docType === "receipt" ? "領収書" : docType === "invoice" ? "請求書" : "見積書";
      const result = await uploadPdfToDrive({
        clientId: GOOGLE_CLIENT_ID,
        pdfBlob: blob,
        fileName,
        folderName,
      });
      alert(`Google Driveに保存しました\n\nファイル名: ${fileName}\n\n表示: ${result.webViewLink}`);
    } catch (err) {
      console.error(err);
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    } finally {
      setSavingDrive(false);
    }
  };

  const handleAddItem = () => {
    setData({ ...data, items: [...data.items, { id: Date.now(), name: "", quantity: 1, unitPrice: 0, taxCat: "10" }] });
  };
  const handleRemoveItem = (id: number) => {
    if (data.items.length <= 1) return;
    setData({ ...data, items: data.items.filter((item) => item.id !== id) });
  };
  const updateItem = (id: number, field: keyof Item, value: string | number) => {
    setData({ ...data, items: data.items.map((item) => item.id === id ? { ...item, [field]: value } : item) });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void, storageKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setter(result);
      try { localStorage.setItem(storageKey, result); } catch {}
    };
    reader.readAsDataURL(file);
  };
  const handleImageDelete = (setter: (v: null) => void, storageKey: string) => {
    setter(null);
    localStorage.removeItem(storageKey);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setErrorMsg("");
    try {
      // @ts-expect-error – pdf.js loaded via CDN
      let pdfjs = window.pdfjsLib;
      if (!pdfjs) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload = () => {
            // @ts-expect-error
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            // @ts-expect-error
            pdfjs = window.pdfjsLib;
            resolve();
          };
          script.onerror = () => reject(new Error("PDF library load failed"));
          document.head.appendChild(script);
        });
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawItems = textContent.items.map((item: any) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sortedItems = [...rawItems].sort((a: any, b: any) => b.y - a.y || a.x - b.x);
      const lines: string[][] = [];
      if (sortedItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentLine: any[] = [sortedItems[0]];
        for (let i = 1; i < sortedItems.length; i++) {
          const item = sortedItems[i];
          if (Math.abs(item.y - currentLine[0].y) < 8) { currentLine.push(item); }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else { currentLine.sort((a: any, b: any) => a.x - b.x); lines.push(currentLine.map((i: any) => i.str.trim()).filter((s: string) => s !== "")); currentLine = [item]; }
        }
        lines.push(currentLine.map((i) => i.str.trim()).filter((s: string) => s !== ""));
      }
      const lineStrings = lines.map((l) => l.join(" "));
      const fullText = lineStrings.join("\n");
      const extracted: DocData = { ...defaultData, items: [] };

      let parsedName = "";
      for (const line of lineStrings) {
        const s = lineStrings.find((l) => (l.includes("様") || l.includes("御中")) && !l.includes("件名"));
        if (s) { parsedName = s.replace(/[様御中]/g, "").trim(); break; }
        if (line.match(/宛名|お客様名/i)) { const m = line.match(/(?:宛名|お客様名)\s*[：:]\s*(.+)/i); if (m) { parsedName = m[1].trim(); break; } }
      }
      if (parsedName) extracted.recipientName = parsedName.replace(/[:;：；]/g, "").trim();

      const noPatterns = [/領収.*番号\s*[：:]?\s*(\S+)/i, /Invoice\s*No\.?\s*[：:]?\s*(\S+)/i, /Receipt\s*No\.?\s*[：:]?\s*(\S+)/i, /請求.*番号\s*[：:]?\s*(\S+)/i];
      for (const pat of noPatterns) { const m = fullText.match(pat); if (m) { extracted.docNumber = m[1].trim(); break; } }

      const dateMatch = fullText.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
      if (dateMatch) { const d = dateMatch[1].replace(/\//g, "-"); extracted.issueDate = d; extracted.extraDate = d; }

      extracted.items = [{ id: Date.now(), name: extracted.subject || "お支払い", quantity: 1, unitPrice: 0, taxCat: "10" }];
      setData(extracted);
    } catch (err) {
      console.error(err);
      setErrorMsg("PDFの読み込みに失敗しました。手入力をお願いします。");
    } finally { setIsProcessing(false); }
  };

  const buildRemarks = (isJa: boolean) => {
    let r = "";
    if (docType === "receipt") {
      if (data.paymentMethod) r += `${isJa ? "支払方法" : "Method"}: ${data.paymentMethod}\n`;
      if (data.extraDate) r += `${isJa ? "支払日" : "Paid on"}: ${data.extraDate}\n`;
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
  };

  // --- Preview ---
  const DocumentPreview = () => {
    const isJa = lang === "ja";
    const l = labels;
    const remarksFull = buildRemarks(isJa);
    const companyName = isJa ? company.nameJa : company.nameEn;
    const companyAddress = isJa ? company.addressJa : company.addressEn;
    const docNum = data.docNumber ? `${effectivePrefix}-${data.docNumber}` : "";
    const showRegistration = docType !== "quotation";
    const remarksLabel = isJa
      ? docType === "receipt" ? "備考 / 支払情報" : docType === "quotation" ? "備考 / 条件" : "備考 / 振込先"
      : docType === "receipt" ? "Remarks / Payment" : docType === "quotation" ? "Remarks / Conditions" : "Remarks / Bank Info";
    const tc = taxCalc;

    return (
      <div className="w-full bg-white p-10 text-slate-800 flex flex-col relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-4" style={{ borderBottom: `3px solid ${config.color}` }}>
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-500 mb-1">{isJa ? "宛名" : "Bill To"}</h2>
            <div className="text-xl font-bold">{data.recipientName}{isJa && data.recipientName ? " 様" : ""}</div>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-black tracking-tight mb-1" style={{ color: config.color }}>{l.title}</h1>
            <div className="text-xs text-slate-400">Page 1 / 1</div>
          </div>
        </div>

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
                <th className="py-2 px-3 text-xs font-bold uppercase text-slate-500">{isJa ? "摘要" : "Description"}</th>
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
                    <td className="py-2.5 px-3 text-sm text-right">{item.unitPrice.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-xs text-center text-slate-500">{catLabel}</td>
                    <td className="py-2.5 px-3 text-sm text-right font-medium">{lineAmt.toLocaleString()}</td>
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
        <div className="grid grid-cols-2 gap-8 pt-5 border-t border-slate-200">
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">{remarksLabel}</h3>
            <div className="text-sm bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap" style={{ minHeight: "50px" }}>
              {remarksFull || (isJa ? "（備考なし）" : "(No remarks)")}
            </div>
          </div>
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
          {showRegistration && company.registrationNo ? (
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
            {stamp && <div className="w-16 h-16 flex items-center justify-center"><img src={stamp} alt="Stamp" className="max-w-full max-h-full object-contain" /></div>}
            {logo && <div className="w-20 h-20 flex items-center justify-center"><img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" /></div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          html, body { width: 210mm; height: 297mm; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden; }
          #preview-area, #preview-area * { visibility: visible; }
          #preview-area {
            position: absolute; left: 0; top: 0; width: 210mm !important;
            min-height: auto !important; max-width: 210mm !important;
            margin: 0 !important; padding: 15mm !important;
            transform: none !important; box-shadow: none !important;
            background: white !important; box-sizing: border-box;
          }
          #sidebar { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>

      <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
        {/* SIDEBAR */}
        <div id="sidebar" className="w-full md:w-[420px] lg:w-[460px] bg-white border-r border-slate-200 md:sticky md:top-0 md:h-screen md:overflow-y-auto flex-shrink-0 z-10 shadow-lg">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: config.color }}>
                  <IconFileText className="w-5 h-5" />IZA 書類作成
                </h1>
                <p className="text-xs text-slate-400">IZA株式会社</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveToDrive}
                  disabled={savingDrive}
                  className="text-white px-3 py-2 rounded-full shadow-md transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
                  style={{ background: "#1a73e8" }}
                  title="Google Driveに保存"
                >
                  {savingDrive ? <IconLoader2 className="w-4 h-4 animate-spin" /> : (
                    <svg width="16" height="16" viewBox="0 0 87.3 78" fill="none">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                  )}
                  Drive保存
                </button>
                <button
                  onClick={() => {
                    alert("印刷ダイアログが開いたら：\n「詳細設定」→「ヘッダーとフッター」のチェックを外してください。");
                    handlePrint();
                  }}
                  className="text-white p-2 rounded-full shadow-md transition-colors"
                  style={{ background: config.color }}
                  title="印刷 / PDF保存"
                >
                  <IconPrinter className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Doc Type + Lang */}
              <Card className="p-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(["receipt", "quotation", "invoice"] as DocType[]).map((type) => (
                    <button key={type} onClick={() => setDocType(type)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${docType === type ? "text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      style={docType === type ? { background: DOC_TYPES[type].color } : {}}>
                      {DOC_TYPES[type].ja.title}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setLang("ja")} className={`py-1.5 text-xs font-bold rounded transition-colors ${lang === "ja" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>日本語</button>
                  <button onClick={() => setLang("en")} className={`py-1.5 text-xs font-bold rounded transition-colors ${lang === "en" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>English</button>
                </div>
              </Card>

              {/* Tax Mode */}
              <Card className="p-3">
                <Label>税計算方式</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTaxMode("exclusive")} className={`py-2 text-xs font-bold rounded-lg transition-all ${taxMode === "exclusive" ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>外税（税抜入力）</button>
                  <button onClick={() => setTaxMode("inclusive")} className={`py-2 text-xs font-bold rounded-lg transition-all ${taxMode === "inclusive" ? "bg-amber-600 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>内税（税込入力）</button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 text-center">
                  {taxMode === "exclusive" ? "明細の単価 = 税抜金額として消費税を自動加算" : "明細の単価 = 税込金額として消費税を自動逆算"}
                </p>
              </Card>

              {/* PDF Upload */}
              <Card className="p-3" style={{ background: config.color + "08", borderColor: config.color + "30" }}>
                <Label>PDF取り込み (自動入力)</Label>
                <div className="relative">
                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isProcessing} />
                  <button className="w-full py-2.5 bg-white border-2 border-dashed rounded text-sm font-medium flex items-center justify-center gap-2" style={{ borderColor: config.color + "60", color: config.color }}>
                    {isProcessing ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconUpload className="w-4 h-4" />}
                    {isProcessing ? "解析中..." : "PDFをアップロード"}
                  </button>
                </div>
                {errorMsg && <div className="flex items-center gap-2 mt-2 text-xs text-red-500 bg-red-50 p-2 rounded"><IconAlertCircle className="w-3 h-3" />{errorMsg}</div>}
              </Card>

              {/* Company Info */}
              <Collapsible title="📋 発行者情報" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>会社名（日本語）</Label><Input value={company.nameJa} onChange={(e) => setCompany({ ...company, nameJa: e.target.value })} placeholder="IZA株式会社" /></div>
                  <div><Label>Company Name (EN)</Label><Input value={company.nameEn} onChange={(e) => setCompany({ ...company, nameEn: e.target.value })} placeholder="IZA Co., Ltd." /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>住所（日本語）</Label><Input value={company.addressJa} onChange={(e) => setCompany({ ...company, addressJa: e.target.value })} /></div>
                  <div><Label>Address (EN)</Label><Input value={company.addressEn} onChange={(e) => setCompany({ ...company, addressEn: e.target.value })} /></div>
                </div>
                <div><Label>インボイス登録番号</Label><Input value={company.registrationNo} onChange={(e) => setCompany({ ...company, registrationNo: e.target.value })} placeholder="T1234567890123" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>電話番号</Label><Input value={company.tel} onChange={(e) => setCompany({ ...company, tel: e.target.value })} /></div>
                  <div><Label>メール</Label><Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></div>
                </div>
                <div><Label>番号プレフィックス</Label><Input value={numberPrefix} onChange={(e) => setNumberPrefix(e.target.value)} placeholder={`空欄時: ${config.prefix}`} /></div>
                <button onClick={saveCompany} className="w-full py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2">
                  <IconSave className="w-4 h-4" />保存
                </button>
              </Collapsible>

              {/* Logo & Stamp */}
              <Collapsible title="🖼️ ロゴ・印影" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>会社ロゴ</Label>
                    <div className="relative">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setLogo, "izaDocLogo")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <button className="w-full py-2 bg-slate-50 border border-slate-300 text-slate-600 rounded text-xs hover:bg-slate-100 flex items-center justify-center gap-1"><IconImage className="w-3 h-3" />{logo ? "変更" : "選択"}</button>
                    </div>
                    {logo && <div className="mt-2 text-center"><div className="inline-block border p-1 rounded bg-white"><img src={logo} alt="" className="h-8 w-auto object-contain" /></div><button onClick={() => handleImageDelete(setLogo, "izaDocLogo")} className="block w-full mt-1 text-xs text-red-500 hover:underline">削除</button></div>}
                  </div>
                  <div>
                    <Label>印影 / 角印</Label>
                    <div className="relative">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setStamp, "izaDocStamp")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <button className="w-full py-2 bg-slate-50 border border-slate-300 text-slate-600 rounded text-xs hover:bg-slate-100 flex items-center justify-center gap-1"><IconImage className="w-3 h-3" />{stamp ? "変更" : "選択"}</button>
                    </div>
                    {stamp && <div className="mt-2 text-center"><div className="inline-block border p-1 rounded bg-white"><img src={stamp} alt="" className="h-8 w-auto object-contain" /></div><button onClick={() => handleImageDelete(setStamp, "izaDocStamp")} className="block w-full mt-1 text-xs text-red-500 hover:underline">削除</button></div>}
                  </div>
                </div>
              </Collapsible>

              {/* Basic Info */}
              <Collapsible title="📝 基本情報" accent={docType === "receipt" ? "border-l-4 border-l-emerald-500" : docType === "quotation" ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-blue-500"}>
                <div><Label>宛名</Label><Input value={data.recipientName} onChange={(e) => setData({ ...data, recipientName: e.target.value })} placeholder="例: 株式会社〇〇" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{labels.numberLabel}</Label><Input value={data.docNumber} onChange={(e) => setData({ ...data, docNumber: e.target.value })} placeholder="001" /></div>
                  <div><Label>{labels.dateLabel}</Label><Input type="date" value={data.issueDate} onChange={(e) => setData({ ...data, issueDate: e.target.value })} /></div>
                </div>
                <div><Label>{labels.extraDateLabel}</Label><Input type="date" value={data.extraDate} onChange={(e) => setData({ ...data, extraDate: e.target.value })} /></div>
                <div><Label>件名</Label><Input value={data.subject} onChange={(e) => setData({ ...data, subject: e.target.value })} placeholder="例: コンサルティング料" /></div>
                <div>
                  <Label>合計金額 手動上書き（任意）</Label>
                  <Input type="number" value={data.totalAmountOverride || ""} onChange={(e) => setData({ ...data, totalAmountOverride: Number(e.target.value) })} placeholder="空欄 = 明細から自動計算" />
                  <p className="text-xs text-slate-400 mt-1">自動計算: {formatCurrency(taxCalc.grandTotal)}</p>
                </div>
              </Collapsible>

              {/* Payment / Remarks */}
              <Collapsible title={docType === "quotation" ? "📋 条件・備考" : "💰 支払い・備考"}>
                {docType !== "quotation" && (
                  <div>
                    <Label>支払い方法</Label>
                    <SelectEl value={["銀行振込", "クレジットカード払い", "WISE支払い", "現金", ""].includes(data.paymentMethod) ? data.paymentMethod : "custom"}
                      onChange={(e) => { if (e.target.value === "custom") setData({ ...data, paymentMethod: "" }); else setData({ ...data, paymentMethod: e.target.value }); }}>
                      <option value="">-- 選択 --</option>
                      <option value="銀行振込">銀行振込</option>
                      <option value="現金">現金</option>
                      <option value="クレジットカード払い">クレジットカード払い</option>
                      <option value="WISE支払い">WISE支払い</option>
                      <option value="custom">その他</option>
                    </SelectEl>
                    {!["銀行振込", "クレジットカード払い", "WISE支払い", "現金", ""].includes(data.paymentMethod) && (
                      <Input className="mt-2" value={data.paymentMethod} onChange={(e) => setData({ ...data, paymentMethod: e.target.value })} placeholder="支払い方法を入力" />
                    )}
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="mb-0">{docType === "invoice" ? "振込先・備考" : "備考"}</Label>
                    {docType === "invoice" && (
                      <div className="flex gap-2">
                        <button
                          onClick={applyBank}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          保存済みを入力
                        </button>
                        <button
                          onClick={saveBank}
                          className="text-xs px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          この内容を保存
                        </button>
                      </div>
                    )}
                  </div>
                  <Textarea rows={5} value={data.remarks} onChange={(e) => setData({ ...data, remarks: e.target.value })}
                    placeholder={docType === "invoice" ? "振込先情報が自動入力されます" : docType === "quotation" ? "条件・特記事項" : "備考欄"} />
                </div>
              </Collapsible>

              {/* Items */}
              <Collapsible title="📦 明細">
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 relative group">
                      {data.items.length > 1 && (
                        <button onClick={() => handleRemoveItem(item.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"><IconTrash2 className="w-4 h-4" /></button>
                      )}
                      <div className="mb-2">
                        <input className="w-full bg-transparent border-b border-slate-200 focus:border-blue-400 outline-none text-sm font-medium pb-1" placeholder="品目名・内容" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-slate-400 block">数量</label>
                          <input type="number" className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block">{taxMode === "exclusive" ? "単価(税抜)" : "単価(税込)"}</label>
                          <input type="number" className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-right" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-400 block">税区分</label>
                          <select className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm" value={item.taxCat || "10"} onChange={(e) => updateItem(item.id, "taxCat", e.target.value)}>
                            <option value="10">10% 課税</option>
                            <option value="8">8% 課税(軽減)</option>
                            <option value="0">非課税</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-1.5 text-right text-xs text-slate-400">
                        小計: ¥{(item.unitPrice * item.quantity).toLocaleString()}
                        {item.taxCat !== "0" && taxMode === "exclusive" && (
                          <span className="ml-2">+ 税 ¥{Math.round(item.unitPrice * item.quantity * TAX_CATS[item.taxCat || "10"].rate).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddItem} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg text-sm hover:border-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1">
                  <IconPlus className="w-4 h-4" />明細を追加
                </button>
                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-400">税抜小計: {formatCurrency(taxCalc.subTotalBeforeTax)}</div>
                  <div className="text-xs text-slate-400">消費税: {formatCurrency(taxCalc.totalTax)}</div>
                  <div><span className="text-xs text-slate-500 mr-2">合計（税込）:</span><span className="text-lg font-bold">{formatCurrency(totalAmount)}</span></div>
                </div>
              </Collapsible>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="flex-grow bg-slate-500/10 flex items-start justify-center p-4 md:p-8 overflow-y-auto min-h-[500px]">
          <div id="preview-area" className="bg-white shadow-2xl w-full max-w-[210mm] mx-auto origin-top"
            style={{ transform: "scale(0.55)", transformOrigin: "top center" }}
            ref={(el) => {
              if (!el) return;
              const vw = el.parentElement?.clientWidth ?? 800;
              const scale = Math.min(1, (vw - 32) / 794);
              el.style.transform = `scale(${scale})`;
              el.style.marginBottom = `${-(794 * (1 - scale))}px`;
            }}>
            <DocumentPreview />
          </div>
        </div>
      </div>
    </>
  );
}
