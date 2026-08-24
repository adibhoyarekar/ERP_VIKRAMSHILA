export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Net Banking' | 'Cheque';
  chequeNo?: string;
  proofUrl?: string;
  createdBy?: string;
  createdAt?: string;
}
