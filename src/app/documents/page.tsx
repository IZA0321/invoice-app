"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { generatePdfBlob } from "@/lib/pdfExport";
import { uploadPdfToDrive } from "@/lib/googleDrive";
import DocumentPreviewView, { IZA_COMPANY, IZA_DEFAULT_BANK, TAX_CATS, DOC_TYPES, CURRENCY_SYMBOLS, calcTax, type DocType, type Lang, type TaxMode, type Item, type Company, type Honorific, type DocData, type Currency } from "@/components/DocumentPreview";
import { getNextDocNumber, saveDocumentRecord, updateDocumentByNumber, getRecentCustomers, withDocPrefix, stripDocPrefix } from "@/lib/supabase";

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


// 法人格を含まない宛名は個人名とみなし「様」を提案する
const CORPORATE_KEYWORDS = ["株式会社", "有限会社", "合同会社", "合資会社", "合名会社", "一般社団法人", "公益社団法人", "一般財団法人", "公益財団法人", "医療法人", "社会福祉法人", "学校法人", "宗教法人", "特定非営利活動法人", "NPO法人", "協同組合", "事務所", "商店", "工房", "クリニック", "医院", "病院", "会", "組合", "Inc.", "Inc", "LLC", "Co.,", "Corp", "株）", "（株）"];
function guessHonorific(name: string): Honorific {
  const trimmed = name.trim();
  if (!trimmed) return "御中";
  return CORPORATE_KEYWORDS.some((kw) => trimmed.includes(kw)) ? "御中" : "様";
}
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
    recipientName: "", recipientHonorific: "御中",
    subject: "", docNumber: "",
    issueDate: today, extraDate: today,
    paymentMethod: "", remarks: "",
    items: [{ id: Date.now(), name: "", quantity: 1, unitPrice: 0, taxCat: "10" }],
    totalAmountOverride: 0,
    currency: "JPY",
  };

  const [docType, setDocType] = useState<DocType>("receipt");
  const [lang, setLang] = useState<Lang>("ja");
  const [data, setData] = useState<DocData>(defaultData);
  const [company, setCompany] = useState<Company>(IZA_COMPANY);
  const [numberPrefix, setNumberPrefix] = useState("");
  const [logo, setLogo] = useState<string | null>("/iza_logo.png");
  const [stamp, setStamp] = useState<string | null>("/iza_kakuin.png");
  const [taxMode, setTaxMode] = useState<TaxMode>("inclusive");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedBank, setSavedBank] = useState(IZA_DEFAULT_BANK);
  const [customers, setCustomers] = useState<{ name: string; honorific: string; lastSubject: string }[]>([]);
  const honorificTouchedRef = useRef(false);

  useEffect(() => {
    getRecentCustomers(20).then(setCustomers);
  }, []);

  const applyCustomer = (c: { name: string; honorific: string; lastSubject: string }) => {
    honorificTouchedRef.current = true;
    setData((prev) => ({
      ...prev,
      recipientName: c.name,
      recipientHonorific: (c.honorific === "様" ? "様" : "御中"),
      subject: prev.subject || c.lastSubject,
    }));
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("izaDocCompany");
      if (saved) setCompany(JSON.parse(saved));
      else setCompany(IZA_COMPANY);
      const savedLogo = localStorage.getItem("izaDocLogo");
      if (savedLogo) setLogo(savedLogo);
      const savedStamp = localStorage.getItem("izaDocStamp");
      // 旧SVG版が保存されていたらPNG版に置き換え
      if (savedStamp && savedStamp !== "/iza_kakuin.svg") setStamp(savedStamp);
      else if (savedStamp === "/iza_kakuin.svg") {
        setStamp("/iza_kakuin.png");
        localStorage.removeItem("izaDocStamp");
      }
      const savedPrefix = localStorage.getItem("izaDocPrefix");
      if (savedPrefix) setNumberPrefix(savedPrefix);
      const savedTaxMode = localStorage.getItem("izaDocTaxMode");
      if (savedTaxMode) setTaxMode(savedTaxMode as TaxMode);
      const savedBankInfo = localStorage.getItem("izaDocBank");
      if (savedBankInfo) setSavedBank(savedBankInfo);

      // Drive関連のlocalStorageを一度だけクリア（フォルダ階層問題対応）
      const driveResetVersion = "v3";
      if (localStorage.getItem("izaDriveResetVersion") !== driveResetVersion) {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("izaDriveFolder_") || k === "izaDriveParent" || k === "izaGoogleToken") {
            localStorage.removeItem(k);
          }
        });
        sessionStorage.removeItem("izaGoogleToken");
        localStorage.setItem("izaDriveResetVersion", driveResetVersion);
      }
    } catch {}
  }, []);

  // Drive障害・認証不可時のフォールバック：履歴（Supabase）のみ登録するフックを公開
  // 使い方（開発者コンソール）: await window.izaSaveDocumentRecord({ doc_type, doc_number, ... })
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).izaSaveDocumentRecord = (rec: Parameters<typeof saveDocumentRecord>[0]) => saveDocumentRecord(rec);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).izaUpdateDocumentByNumber = (n: string, f: Parameters<typeof updateDocumentByNumber>[1]) => updateDocumentByNumber(n, f);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).izaSaveDocumentRecord;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).izaUpdateDocumentByNumber;
    };
  }, []);

  // sessionStorageからプリフィル情報を読み込み（コピー or 種別変換）
  useEffect(() => {
    try {
      // sessionStorage（同一タブ）→ localStorage（別タブからの転送）の順に読む。読んだら削除
      let prefillStr = sessionStorage.getItem("izaPrefill");
      if (prefillStr) sessionStorage.removeItem("izaPrefill");
      else {
        prefillStr = localStorage.getItem("izaPrefill");
        if (prefillStr) localStorage.removeItem("izaPrefill");
      }
      if (prefillStr) {
        const prefill = JSON.parse(prefillStr);
        if (prefill.docType) setDocType(prefill.docType);
        if (prefill.taxMode === "exclusive" || prefill.taxMode === "inclusive") setTaxMode(prefill.taxMode);
        // 見積→請求書変換時は件名に元番号を付記
        const autoSubject = prefill.fromDocType === "quotation" && prefill.docType === "invoice" && prefill.fromDocNumber
          ? `${prefill.subject || ""}（見積書 ${prefill.fromDocNumber} より）`.trim()
          : prefill.subject;
        setData((prev) => ({
          ...prev,
          recipientName: prefill.recipientName ?? prev.recipientName,
          recipientHonorific: prefill.recipientHonorific ?? prev.recipientHonorific,
          subject: autoSubject ?? prev.subject,
          paymentMethod: prefill.paymentMethod ?? prev.paymentMethod,
          remarks: prefill.remarks ?? prev.remarks,
          issueDate: prefill.issueDate ?? prev.issueDate,
          extraDate: prefill.extraDate ?? prev.extraDate,
          items: prefill.items && prefill.items.length > 0 ? prefill.items.map((it: Item) => ({ ...it, id: Date.now() + Math.random() })) : prev.items,
          docNumber: "", // 新規採番
        }));
      }
    } catch {}
  }, []);

  // 書類種別切替時にデフォルト値を自動セット（請求書のみ振込先を自動入力）
  useEffect(() => {
    setData((prev) => {
      // 請求書・領収書は「銀行振込 + 保存済み振込先」をデフォルト表示（編集可）
      if (docType === "invoice" || docType === "receipt") {
        return {
          ...prev,
          paymentMethod: prev.paymentMethod || "銀行振込",
          remarks: prev.remarks || savedBank,
        };
      }
      return prev;
    });
  }, [docType, savedBank]);

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
  const symbol = CURRENCY_SYMBOLS[data.currency];
  const formatCurrency = (n: number) => {
    const num = data.currency === "JPY" ? Math.round(n || 0) : Number((n || 0).toFixed(2));
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: data.currency === "JPY" ? 0 : 2, maximumFractionDigits: 2 })}`;
  };

  const taxCalc = useMemo(() => calcTax(data.items, taxMode), [data.items, taxMode]);

  const totalAmount = data.totalAmountOverride > 0 ? data.totalAmountOverride : taxCalc.grandTotal;

  const handlePrint = () => {
    const orig = document.title;
    const dateStr = data.issueDate.replace(/-/g, "");
    const recipient = data.recipientName || "宛名未入力";
    document.title = `${dateStr}_${recipient} ${data.recipientHonorific}_${labels.title}`;
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
      // 採番（未入力なら自動採番、手入力ならプレフィックス付与）
      let docNumber = data.docNumber;
      if (!docNumber) {
        docNumber = await getNextDocNumber(docType);
      } else {
        docNumber = withDocPrefix(docType, docNumber);
      }
      // 入力欄にはプレフィックス無しの番号のみ表示（表示時に自動付与されるため）
      if (stripDocPrefix(docNumber) !== data.docNumber) {
        setData((prev) => ({ ...prev, docNumber: stripDocPrefix(docNumber as string) }));
      }

      const blob = await generatePdfBlob("preview-area");
      const dateStr = data.issueDate.replace(/-/g, "");
      const fileName = `${dateStr}_${data.recipientName} ${data.recipientHonorific}_${labels.title}.pdf`;
      const folderName = docType === "receipt" ? "領収書" : docType === "invoice" ? "請求書" : docType === "delivery" ? "納品書" : "見積書";
      const result = await uploadPdfToDrive({
        clientId: GOOGLE_CLIENT_ID,
        pdfBlob: blob,
        fileName,
        folderName,
      });

      // Supabaseに履歴記録（完全な情報）
      // 番号重複(409)時は最大3回まで次の番号で自動リトライ
      let historySaved = false;
      let historyError: unknown = null;
      let attemptNumber = docNumber;
      for (let i = 0; i < 4; i++) {
        try {
          await saveDocumentRecord({
            doc_type: docType,
            doc_number: attemptNumber,
            recipient_name: data.recipientName,
            recipient_honorific: data.recipientHonorific,
            subject: data.subject || null,
            issue_date: data.issueDate,
            total_amount: totalAmount,
            items: data.items,
            payment_method: data.paymentMethod || null,
            remarks: data.remarks || null,
            pdf_url: result.webViewLink,
            drive_file_id: result.id,
            due_date: docType === "invoice" && data.extraDate ? data.extraDate : null,
            payment_status: docType === "invoice" ? "unpaid" : undefined,
          });
          historySaved = true;
          docNumber = attemptNumber;
          setData((prev) => ({ ...prev, docNumber: stripDocPrefix(attemptNumber) }));
          break;
        } catch (e) {
          historyError = e;
          const msg = String((e as { message?: string })?.message || "");
          const isDuplicate = msg.includes("duplicate") || msg.includes("23505") || msg.includes("unique");
          if (!isDuplicate) break;
          // 次の連番でリトライ
          attemptNumber = await getNextDocNumber(docType);
        }
      }

      if (historySaved) {
        alert(`Google Driveに保存し、履歴にも記録しました\n\nファイル名: ${fileName}\n書類番号: ${docNumber}\n\n表示: ${result.webViewLink}`);
      } else {
        console.error("履歴の記録に失敗:", historyError);
        alert(`Driveには保存しましたが、履歴の記録に失敗しました。\n\n${historyError instanceof Error ? historyError.message : String(historyError)}\n\nDrive: ${result.webViewLink}`);
      }
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
      const original = ev.target?.result as string;
      // 画像を最大400pxにリサイズしてlocalStorage節約
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setter(original);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/png");
        setter(compressed);
        try {
          localStorage.setItem(storageKey, compressed);
        } catch {
          alert("画像を保存できませんでした。今回のセッションでのみ表示されます。");
        }
      };
      img.onerror = () => {
        setter(original);
        try { localStorage.setItem(storageKey, original); } catch {}
      };
      img.src = original;
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
                <div className="flex items-center gap-2">
                  <Link href="/history" className="text-xs text-blue-600 hover:underline">
                    📚 履歴 →
                  </Link>
                  <span className="text-xs text-slate-300">v2026.9.20-1</span>
                </div>
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
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(["receipt", "quotation", "invoice", "delivery"] as DocType[]).map((type) => (
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

              {/* インボイス登録番号未設定警告 */}
              {docType === "invoice" && !company.registrationNo && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800">インボイス登録番号が未設定です</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      適格請求書として発行するには登録番号（T＋13桁）が必要です。
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      ↓「📋 発行者情報」を開いて設定し、「保存」してください。
                    </p>
                  </div>
                </div>
              )}

              {/* Currency */}
              <Card className="p-3">
                <Label>通貨</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["JPY", "USD", "EUR"] as Currency[]).map((cur) => (
                    <button
                      key={cur}
                      onClick={() => setData({ ...data, currency: cur })}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${data.currency === cur ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {CURRENCY_SYMBOLS[cur]} {cur}
                    </button>
                  ))}
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
                {customers.length > 0 && (
                  <div>
                    <Label>👥 最近の取引先（タップで入力）</Label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {customers.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => applyCustomer(c)}
                          className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label>宛名</Label>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={data.recipientName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setData((prev) => ({
                          ...prev,
                          recipientName: name,
                          // ユーザーが敬称を手動変更していなければ、入力内容から自動判定
                          recipientHonorific: honorificTouchedRef.current ? prev.recipientHonorific : guessHonorific(name),
                        }));
                      }}
                      placeholder="例: 株式会社〇〇 / 個人名"
                    />
                    <select
                      value={data.recipientHonorific}
                      onChange={(e) => {
                        honorificTouchedRef.current = true;
                        setData({ ...data, recipientHonorific: e.target.value as Honorific });
                      }}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="御中">御中</option>
                      <option value="様">様</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">会社・組織は「御中」、個人は「様」（自動判定・手動変更も可）</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{labels.numberLabel}</Label><Input value={data.docNumber} onChange={(e) => setData({ ...data, docNumber: e.target.value })} placeholder="001" /></div>
                  <div><Label>{labels.dateLabel}</Label><Input type="date" value={data.issueDate} onChange={(e) => setData({ ...data, issueDate: e.target.value })} /></div>
                </div>
                {docType !== "receipt" && (
                  <div>
                    <Label>{labels.extraDateLabel}</Label>
                    <Input type="date" value={data.extraDate} onChange={(e) => setData({ ...data, extraDate: e.target.value })} />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        { label: "今月末", fn: () => { const d = new Date(data.issueDate); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().split("T")[0]; } },
                        { label: "翌月末", fn: () => { const d = new Date(data.issueDate); d.setMonth(d.getMonth() + 2, 0); return d.toISOString().split("T")[0]; } },
                        { label: "30日後", fn: () => { const d = new Date(data.issueDate); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; } },
                        { label: "60日後", fn: () => { const d = new Date(data.issueDate); d.setDate(d.getDate() + 60); return d.toISOString().split("T")[0]; } },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setData({ ...data, extraDate: opt.fn() })}
                          className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                    <Label className="mb-0">{docType === "invoice" || docType === "receipt" ? "振込先・備考" : "備考"}</Label>
                    {(docType === "invoice" || docType === "receipt") && (
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
                    placeholder={docType === "invoice" || docType === "receipt" ? "振込先情報が自動入力されます" : docType === "quotation" ? "条件・特記事項" : "備考欄"} />
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
                        小計: {formatCurrency(item.unitPrice * item.quantity)}
                        {item.taxCat !== "0" && taxMode === "exclusive" && (
                          <span className="ml-2">+ 税 {formatCurrency(item.unitPrice * item.quantity * TAX_CATS[item.taxCat || "10"].rate)}</span>
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
        <div className="flex-grow bg-slate-500/10 flex items-start justify-center p-4 md:p-8 overflow-x-hidden overflow-y-auto min-h-[500px]">
          <div
            id="preview-area"
            className="bg-white shadow-2xl mx-auto origin-top"
            style={{ width: "794px", transform: "scale(1)", transformOrigin: "top center" }}
            ref={(el) => {
              if (!el) return;
              const updateScale = () => {
                const vw = el.parentElement?.clientWidth ?? 800;
                const scale = Math.min(1, (vw - 32) / 794);
                el.style.transform = `scale(${scale})`;
                el.style.marginBottom = `${-(el.scrollHeight * (1 - scale))}px`;
              };
              updateScale();
              // ウィンドウサイズ変更に対応
              const ro = new ResizeObserver(updateScale);
              if (el.parentElement) ro.observe(el.parentElement);
            }}
          >
            <DocumentPreviewView docType={docType} lang={lang} data={data} company={company} taxMode={taxMode} logo={logo} stamp={stamp} numberPrefix={numberPrefix} />
          </div>
        </div>
      </div>
    </>
  );
}
