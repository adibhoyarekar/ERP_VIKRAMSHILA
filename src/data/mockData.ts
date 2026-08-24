export type Role = 'super_admin' | 'superadmin' | 'admin' | 'clerk' | 'accountant' | 'staff';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: Role;
  status: 'active' | 'suspended';
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  password?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Student {
  id: string;
  enrollmentId: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  branch: string;
  category: string;
  subCaste?: string;
  fatherName?: string;
  address?: string;
  pincode?: string;
  alternatePhone?: string;
  prnNo?: string;
  rollNo?: string;
  photoUrl?: string;
  semester: number;
  studyYear?: string;
  batchYear?: string;
  dob?: string;
  status: 'active' | 'graduated' | 'dropped';
  admissionDate: string;
  scholarship: boolean; bankName?: string; bankAccountNo?: string; bankIfsc?: string; bankBranch?: string;
  accountHolderName?: string;
  upiId?: string;
  upiApp?: string;
  bankDetailsUpdated?: string;
  documentsComplete: boolean;
  documents?: string[];
  profileCompletion: number;
}

export const initialUsers: User[] = [];

export const initialRequests: AccessRequest[] = [];

export const initialStudents: Student[] = [];

export const initialStationaryRecords: any[] = [];

export const initialScholarshipRecords: any[] = [];
