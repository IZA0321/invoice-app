import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key) : null;

export interface DocumentRecord {
  id?: string;
  doc_type: "receipt" | "invoice" | "quotation";
  doc_number: string;
  recipient_name: string;
  subject: string | null;
  issue_date: string;
  total_amount: number;
  pdf_url?: string | null;
  drive_file_id?: string | null;
  created_at?: string;
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
