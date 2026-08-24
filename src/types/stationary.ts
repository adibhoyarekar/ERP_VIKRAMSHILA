export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';
export type TransactionMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'N/A';

export interface Document {
  id: string;
  name: string;
  url: string;
  type: string;
}

export interface StationaryPayment {
  id: string;
  date: string;
  amount: number;
  mode: TransactionMode;
  billUrl?: string;
  referenceNo?: string;
  remarks?: string;
}

export interface StationaryRecord {
  id: string;
  date: string;
  vendorName: string;
  objectName: string;
  unit: number;
  price: number;
  amountPaid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  payments: StationaryPayment[];
  remarks?: string;
  documents?: Document[];
  createdByRole?: string;
}