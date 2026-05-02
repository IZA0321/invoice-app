import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key) : null;

export interface DocumentRecord {
  id?: string;
  doc_type: "receipt" | "invoice" | "quotation";
  doc_number: string;
  recipient_name: string;
  recipient_honorific?: string;
  subject: string | null;
  issue_date: string;
  total_amount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items?: any[] | null;
  payment_method?: string | null;
  remarks?: string | null;
  pdf_url?: string | null;
  drive_file_id?: string | null;
  created_at?: string;
}

export async function deleteDocument(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export interface MonthlySummary {
  month: string;
  receipt_count: number;
  receipt_total: number;
  invoice_count: number;
  invoice_total: number;
  quotation_count: number;
  quotation_total: number;
}

export async function getMonthlySummary(year: number): Promise<MonthlySummary[]> {
  if (!supabase) return [];
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const { data, error } = await supabase
    .from("documents")
    .select("doc_type, total_amount, issue_date")
    .gte("issue_date", start)
    .lt("issue_date", end);
  if (error || !data) return [];

  const byMonth: Record<string, MonthlySummary> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    byMonth[key] = {
      month: key,
      receipt_count: 0, receipt_total: 0,
      invoice_count: 0, invoice_total: 0,
      quotation_count: 0, quotation_total: 0,
    };
  }
  for (const d of data) {
    const month = d.issue_date.slice(0, 7);
    if (!byMonth[month]) continue;
    if (d.doc_type === "receipt") {
      byMonth[month].receipt_count++;
      byMonth[month].receipt_total += d.total_amount;
    } else if (d.doc_type === "invoice") {
      byMonth[month].invoice_count++;
      byMonth[month].invoice_total += d.total_amount;
    } else if (d.doc_type === "quotation") {
      byMonth[month].quotation_count++;
      byMonth[month].quotation_total += d.total_amount;
    }
  }
  return Object.values(byMonth);
}

export async function getRecentCustomers(limit = 30): Promise<{ name: string; honorific: string; lastSubject: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("recipient_name, recipient_honorific, subject, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const seen = new Set<string>();
  const customers: { name: string; honorific: string; lastSubject: string }[] = [];
  for (const d of data) {
    if (!d.recipient_name || seen.has(d.recipient_name)) continue;
    seen.add(d.recipient_name);
    customers.push({
      name: d.recipient_name,
      honorific: d.recipient_honorific || "御中",
      lastSubject: d.subject || "",
    });
    if (customers.length >= limit) break;
  }
  return customers;
}

/**
 * 今日の日付・指定された書類種別で次の連番を取得
 * 例: 20260502001 → 20260502002
 */
export async function getNextDocNumber(
  docType: "receipt" | "invoice" | "quotation"
): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const datePrefix = `${y}${m}${d}`;

  if (!supabase) {
    // Supabase未設定時はlocalStorageでフォールバック
    const key = `izaSeq_${docType}_${datePrefix}`;
    const cur = parseInt(localStorage.getItem(key) || "0", 10);
    const next = cur + 1;
    localStorage.setItem(key, String(next));
    return `${datePrefix}${String(next).padStart(3, "0")}`;
  }

  const { data, error } = await supabase
    .from("documents")
    .select("doc_number")
    .eq("doc_type", docType)
    .like("doc_number", `${datePrefix}%`)
    .order("doc_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return `${datePrefix}001`;
  }

  if (!data || data.length === 0) return `${datePrefix}001`;

  const last = data[0].doc_number as string;
  const lastSeq = parseInt(last.slice(-3), 10);
  return `${datePrefix}${String(lastSeq + 1).padStart(3, "0")}`;
}

export async function saveDocumentRecord(rec: DocumentRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("documents").insert(rec);
  if (error) {
    console.error("Supabase insert error:", error);
    throw error;
  }
}

export async function listDocuments(
  filter?: { docType?: "receipt" | "invoice" | "quotation"; limit?: number }
): Promise<DocumentRecord[]> {
  if (!supabase) return [];
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (filter?.docType) query = query.eq("doc_type", filter.docType);
  if (filter?.limit) query = query.limit(filter.limit);
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []) as DocumentRecord[];
}
