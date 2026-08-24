export type PaymentMode = 'UPI' | 'Cash' | 'Cheque' | 'NEFT' | 'RTGS' | 'IMPS' | 'Bank Transfer' | 'Other';
export type ScholarshipStatus = 'Pending' | 'Partial' | 'Completed';

export interface ScholarshipInstallment {
  id: string;
  installmentNumber: number;
  paymentDate: string;
  amountReceived: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  remarks?: string;
  proofUrl?: string; // File name or URL
  isFreeship?: boolean;
}

export interface ScholarshipDocument {
  id: string;
  name: string;
  type: string;
  fileName: string;
  uploadDate: string;
}

export interface ScholarshipRecord {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  course: string;
  
  scholarshipName: string;
  applicationDate?: string;
  sanctionedAmount: number;
  amountReceived: number;
  amountPending: number;
  
  status: ScholarshipStatus;
  installments: ScholarshipInstallment[];
  documents?: ScholarshipDocument[];

  // Disbursement & Credit Details (Managed by Accountant)
  totalAmount?: number;
  creditDate?: string;
  scholarshipCreditAmount?: number;
  actualBalanceBeforeWithdrawal?: number;
  collegeAmount?: number;
  studentAmount?: number;
  disbursementRemarks?: string;
}
