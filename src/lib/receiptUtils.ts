import { ReceiptCalculated, ReceiptData } from "@/types/receipt";

export function calcReceipt(data: ReceiptData): ReceiptCalculated {
  const rate = data.taxRate / 100;
  const taxExcluded = Math.round(data.amount / (1 + rate));
  const taxAmount = data.amount - taxExcluded;
  return { ...data, taxExcluded, taxAmount };
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

export function generateReceiptNo(seq: number): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}${m}${d}${String(seq).padStart(3, "0")}`;
}

export function todayString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}
