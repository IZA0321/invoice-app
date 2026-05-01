export type TaxRate = 8 | 10;

export interface ReceiptData {
  receiptNo: string;
  issueDate: string;
  recipientName: string;
  amount: number;
  description: string;
  taxRate: TaxRate;
}

export interface ReceiptCalculated extends ReceiptData {
  taxExcluded: number;
  taxAmount: number;
}
