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
  scholarship: boolean;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  accountHolderName?: string;
  upiId?: string;
  upiApp?: string;
  bankDetailsUpdated?: string;
  documentsComplete: boolean;
  documents?: string[];
  profileCompletion: number;
}

export interface DemoCredential {
  role: Role;
  roleTitle: string;
  name: string;
  email: string;
  password: string;
  description: string;
  badgeColor: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    role: 'superadmin',
    roleTitle: 'Super Admin',
    name: 'Dr. Vikramaditya Sharma',
    email: 'superadmin@vikramshila.edu',
    password: 'Demo@1234',
    description: 'Full administrative control, user approvals, audit logs, and settings.',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  {
    role: 'admin',
    roleTitle: 'Admin',
    name: 'Prof. Rajesh Deshmukh',
    email: 'admin@vikramshila.edu',
    password: 'Demo@1234',
    description: 'Faculty management, attendance monitoring, academic oversight.',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300'
  },
  {
    role: 'clerk',
    roleTitle: 'Clerk / Registrar',
    name: 'Sunita Kulkarni',
    email: 'clerk@vikramshila.edu',
    password: 'Demo@1234',
    description: 'Student admissions, registrations, stationary purchases, bonafide certificates.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  {
    role: 'accountant',
    roleTitle: 'Accountant',
    name: 'Ramesh Pawar',
    email: 'accountant@vikramshila.edu',
    password: 'Demo@1234',
    description: 'Fee collection, scholarship disbursements, financial ledger entries.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  {
    role: 'staff',
    roleTitle: 'Faculty / Staff',
    name: 'Anjali Verma',
    email: 'staff@vikramshila.edu',
    password: 'Demo@1234',
    description: 'Staff daily selfie GPS attendance, personal attendance history, messages.',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300'
  }
];

export const initialUsers: User[] = [
  {
    id: 'u-superadmin-01',
    name: 'Dr. Vikramaditya Sharma',
    username: 'superadmin',
    email: 'superadmin@vikramshila.edu',
    password: 'Demo@1234',
    role: 'superadmin',
    status: 'active'
  },
  {
    id: 'u-admin-01',
    name: 'Prof. Rajesh Deshmukh',
    username: 'admin',
    email: 'admin@vikramshila.edu',
    password: 'Demo@1234',
    role: 'admin',
    status: 'active'
  },
  {
    id: 'u-clerk-01',
    name: 'Sunita Kulkarni',
    username: 'clerk',
    email: 'clerk@vikramshila.edu',
    password: 'Demo@1234',
    role: 'clerk',
    status: 'active'
  },
  {
    id: 'u-accountant-01',
    name: 'Ramesh Pawar',
    username: 'accountant',
    email: 'accountant@vikramshila.edu',
    password: 'Demo@1234',
    role: 'accountant',
    status: 'active'
  },
  {
    id: 'u-staff-01',
    name: 'Anjali Verma',
    username: 'staff',
    email: 'staff@vikramshila.edu',
    password: 'Demo@1234',
    role: 'staff',
    status: 'active'
  },
  {
    id: 'u-staff-02',
    name: 'Mahesh Joshi',
    username: 'mjoshi',
    email: 'm.joshi@vikramshila.edu',
    password: 'Demo@1234',
    role: 'staff',
    status: 'active'
  }
];

export const initialRequests: AccessRequest[] = [
  {
    id: 'req-101',
    name: 'Pooja Shinde',
    email: 'pooja.shinde@vikramshila.edu',
    password: 'Demo@1234',
    date: '2026-08-22',
    status: 'pending'
  },
  {
    id: 'req-102',
    name: 'Kavita Chavan',
    email: 'kavita.chavan@vikramshila.edu',
    password: 'Demo@1234',
    date: '2026-08-24',
    status: 'pending'
  }
];

export const initialStudents: Student[] = [
  {
    id: 'stu-001',
    enrollmentId: 'VCFD/2024/001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@students.vikramshila.edu',
    phone: '9823456781',
    course: 'B.Des Fashion Design',
    branch: 'Fashion Design',
    category: 'OPEN',
    subCaste: 'Gujarati',
    fatherName: 'Sanjay Mehta',
    address: 'Flat 402, Royal Palms, MG Road, Pune',
    pincode: '411001',
    alternatePhone: '9823456780',
    prnNo: 'PRN202400198',
    rollNo: 'FD-24-01',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    semester: 4,
    studyYear: 'Second Year',
    batchYear: '2024-2028',
    dob: '2004-05-14',
    status: 'active',
    admissionDate: '2024-07-15',
    scholarship: true,
    bankName: 'State Bank of India',
    bankAccountNo: '30492817264',
    bankIfsc: 'SBIN0001234',
    bankBranch: 'Camp Branch, Pune',
    accountHolderName: 'Aarav Sanjay Mehta',
    upiId: 'aaravmehta@oksbi',
    upiApp: 'GPay',
    bankDetailsUpdated: '2025-01-10',
    documentsComplete: true,
    documents: ['Aadhar Card', '12th Marksheet', 'Transfer Certificate', 'Caste Certificate'],
    profileCompletion: 100
  },
  {
    id: 'stu-002',
    enrollmentId: 'VCFD/2024/002',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@students.vikramshila.edu',
    phone: '9876543210',
    course: 'B.Des Textile Design',
    branch: 'Textile Design',
    category: 'OBC',
    subCaste: 'Padmashali',
    fatherName: 'Venkatesh Iyer',
    address: '12, Sunrise Enclave, Aundh, Pune',
    pincode: '411007',
    alternatePhone: '9876543211',
    prnNo: 'PRN202400204',
    rollNo: 'TD-24-02',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    semester: 4,
    studyYear: 'Second Year',
    batchYear: '2024-2028',
    dob: '2004-09-22',
    status: 'active',
    admissionDate: '2024-07-16',
    scholarship: true,
    bankName: 'HDFC Bank',
    bankAccountNo: '50100456789123',
    bankIfsc: 'HDFC0000456',
    bankBranch: 'Aundh, Pune',
    accountHolderName: 'Ananya Venkatesh Iyer',
    upiId: 'ananya.iyer@okhdfcbank',
    upiApp: 'PhonePe',
    bankDetailsUpdated: '2024-12-05',
    documentsComplete: true,
    documents: ['Aadhar Card', '12th Marksheet', 'Income Certificate', 'Domicile'],
    profileCompletion: 100
  },
  {
    id: 'stu-003',
    enrollmentId: 'VCFD/2023/045',
    name: 'Rohan Gaikwad',
    email: 'rohan.gaikwad@students.vikramshila.edu',
    phone: '9422019283',
    course: 'B.Des Apparel Production',
    branch: 'Apparel Production',
    category: 'SC',
    subCaste: 'Mahar',
    fatherName: 'Dilip Gaikwad',
    address: 'Plot 18, Siddheshwar Nagar, Solapur Road, Pune',
    pincode: '411028',
    alternatePhone: '9422019284',
    prnNo: 'PRN202300451',
    rollNo: 'AP-23-15',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    semester: 6,
    studyYear: 'Third Year',
    batchYear: '2023-2027',
    dob: '2003-11-05',
    status: 'active',
    admissionDate: '2023-08-01',
    scholarship: true,
    bankName: 'Bank of Maharashtra',
    bankAccountNo: '60012398471',
    bankIfsc: 'MAHB0000123',
    bankBranch: 'Hadapsar, Pune',
    accountHolderName: 'Rohan Dilip Gaikwad',
    upiId: 'rohang@mahb',
    upiApp: 'BHIM',
    bankDetailsUpdated: '2025-02-14',
    documentsComplete: true,
    documents: ['Aadhar Card', 'Caste Certificate', 'Caste Validity', 'Income Certificate', '10th Marksheet', '12th Marksheet'],
    profileCompletion: 100
  },
  {
    id: 'stu-004',
    enrollmentId: 'VCFD/2025/012',
    name: 'Rhea Sen',
    email: 'rhea.sen@students.vikramshila.edu',
    phone: '9765431289',
    course: 'B.Des Fashion Communication',
    branch: 'Fashion Communication',
    category: 'OPEN',
    subCaste: 'Bengali',
    fatherName: 'Subhash Sen',
    address: 'B-704, Marvel Zephyr, Kharadi, Pune',
    pincode: '411014',
    alternatePhone: '9765431288',
    prnNo: 'PRN202500129',
    rollNo: 'FC-25-04',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    semester: 2,
    studyYear: 'First Year',
    batchYear: '2025-2029',
    dob: '2005-03-19',
    status: 'active',
    admissionDate: '2025-07-20',
    scholarship: false,
    documentsComplete: true,
    documents: ['Aadhar Card', '12th Marksheet', 'Entrance Scorecard'],
    profileCompletion: 90
  },
  {
    id: 'stu-005',
    enrollmentId: 'VCFD/2023/078',
    name: 'Tanvi Shinde',
    email: 'tanvi.shinde@students.vikramshila.edu',
    phone: '9890123456',
    course: 'B.Des Fashion Design',
    branch: 'Fashion Design',
    category: 'EWS',
    subCaste: 'Maratha',
    fatherName: 'Anil Shinde',
    address: 'Flat 101, Omkar Residency, Kothrud, Pune',
    pincode: '411038',
    alternatePhone: '9890123457',
    prnNo: 'PRN202300782',
    rollNo: 'FD-23-28',
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80',
    semester: 6,
    studyYear: 'Third Year',
    batchYear: '2023-2027',
    dob: '2003-08-12',
    status: 'active',
    admissionDate: '2023-08-04',
    scholarship: true,
    bankName: 'Union Bank of India',
    bankAccountNo: '439201948201',
    bankIfsc: 'UBIN0543920',
    bankBranch: 'Paud Road, Pune',
    accountHolderName: 'Tanvi Anil Shinde',
    upiId: 'tanvishinde@unionbank',
    upiApp: 'Paytm',
    bankDetailsUpdated: '2025-01-20',
    documentsComplete: true,
    documents: ['Aadhar Card', 'EWS Certificate', '12th Marksheet', 'Income Certificate'],
    profileCompletion: 100
  },
  {
    id: 'stu-006',
    enrollmentId: 'VCFD/2024/033',
    name: 'Kabir Kapoor',
    email: 'kabir.kapoor@students.vikramshila.edu',
    phone: '9158723490',
    course: 'B.Des Fashion Design',
    branch: 'Fashion Design',
    category: 'OPEN',
    subCaste: 'Punjabi',
    fatherName: 'Sunil Kapoor',
    address: 'Villa 14, Clover Highlands, NIBM, Pune',
    pincode: '411048',
    alternatePhone: '9158723491',
    prnNo: 'PRN202400336',
    rollNo: 'FD-24-33',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    semester: 4,
    studyYear: 'Second Year',
    batchYear: '2024-2028',
    dob: '2004-02-28',
    status: 'active',
    admissionDate: '2024-07-18',
    scholarship: false,
    documentsComplete: true,
    documents: ['Aadhar Card', '12th Marksheet', 'Leaving Certificate'],
    profileCompletion: 85
  },
  {
    id: 'stu-007',
    enrollmentId: 'VCFD/2022/019',
    name: 'Priyanka Jadhav',
    email: 'priyanka.jadhav@students.vikramshila.edu',
    phone: '9657841230',
    course: 'B.Des Textile Design',
    branch: 'Textile Design',
    category: 'ST',
    subCaste: 'Thakar',
    fatherName: 'Santosh Jadhav',
    address: 'Santosh Bhavan, Warje, Pune',
    pincode: '411058',
    alternatePhone: '9657841231',
    prnNo: 'PRN202200194',
    rollNo: 'TD-22-19',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    semester: 8,
    studyYear: 'Final Year',
    batchYear: '2022-2026',
    dob: '2002-12-10',
    status: 'graduated',
    admissionDate: '2022-08-10',
    scholarship: true,
    bankName: 'State Bank of India',
    bankAccountNo: '20394819284',
    bankIfsc: 'SBIN0005432',
    bankBranch: 'Warje, Pune',
    accountHolderName: 'Priyanka Santosh Jadhav',
    upiId: 'priyankaj@sbi',
    upiApp: 'GPay',
    bankDetailsUpdated: '2024-08-15',
    documentsComplete: true,
    documents: ['Aadhar Card', 'Caste Certificate', 'Caste Validity', 'Degree Clearance'],
    profileCompletion: 100
  },
  {
    id: 'stu-008',
    enrollmentId: 'VCFD/2025/089',
    name: 'Devika Nair',
    email: 'devika.nair@students.vikramshila.edu',
    phone: '9922114455',
    course: 'B.Des Fashion Communication',
    branch: 'Fashion Communication',
    category: 'OPEN',
    fatherName: 'Mohan Nair',
    address: 'Rowhouse 9, Viman Nagar, Pune',
    pincode: '411014',
    alternatePhone: '9922114456',
    prnNo: 'PRN202500891',
    rollNo: 'FC-25-18',
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80',
    semester: 2,
    studyYear: 'First Year',
    batchYear: '2025-2029',
    dob: '2005-10-04',
    status: 'active',
    admissionDate: '2025-07-25',
    scholarship: false,
    documentsComplete: true,
    documents: ['Aadhar Card', '12th Marksheet'],
    profileCompletion: 80
  }
];

export const initialStationaryRecords = [
  {
    id: 'st-rec-001',
    date: '2026-08-10',
    vendorName: 'Creative Art & Paper Mart',
    objectName: 'Ivory Sheets & Drafting Cartridge (A1, A2)',
    unit: 500,
    price: 35000,
    amountPaid: 35000,
    balance: 0,
    paymentStatus: 'Paid',
    remarks: 'Delivered to Fashion Design Studio 1 & 2',
    createdByRole: 'clerk',
    payments: [
      {
        id: 'st-pay-101',
        date: '2026-08-10',
        amount: 35000,
        mode: 'Bank Transfer',
        referenceNo: 'NEFT-UBIN984029',
        receiptNo: 'REC-CAP-2026-089',
        billUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        remarks: 'Full settlement on delivery'
      }
    ]
  },
  {
    id: 'st-rec-002',
    date: '2026-08-14',
    vendorName: 'Apex Tailoring Supplies Hub',
    objectName: 'Industrial Sewing Needles & Machine Oil Cans',
    unit: 120,
    price: 18500,
    amountPaid: 10000,
    balance: 8500,
    paymentStatus: 'Partial',
    remarks: 'Garment Construction Lab semester replenishment',
    createdByRole: 'clerk',
    payments: [
      {
        id: 'st-pay-102',
        date: '2026-08-14',
        amount: 10000,
        mode: 'UPI',
        referenceNo: 'UPI/260814981729/Apex',
        receiptNo: 'INV-APEX-441',
        billUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
        remarks: 'Advance paid 10,000 INR, balance on invoice verification'
      }
    ]
  },
  {
    id: 'st-rec-003',
    date: '2026-08-18',
    vendorName: 'Vanguard Digital Printing Solutions',
    objectName: 'Sublimation Inks & Heat Transfer Film Rolls',
    unit: 15,
    price: 42000,
    amountPaid: 0,
    balance: 42000,
    paymentStatus: 'Pending',
    remarks: 'Textile Printing Department - Semester Project supplies',
    createdByRole: 'clerk',
    payments: []
  },
  {
    id: 'st-rec-004',
    date: '2026-08-20',
    vendorName: 'Fashion Tech Drafting Co.',
    objectName: 'French Curves, Pattern Rulers & Graded Scales',
    unit: 80,
    price: 14400,
    amountPaid: 14400,
    balance: 0,
    paymentStatus: 'Paid',
    remarks: 'Pattern Making Lab batch kits',
    createdByRole: 'clerk',
    payments: [
      {
        id: 'st-pay-103',
        date: '2026-08-20',
        amount: 14400,
        mode: 'Cheque',
        referenceNo: 'CHQ-504918',
        receiptNo: 'FT-9041',
        billUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        remarks: 'Cleared via HDFC College Acct'
      }
    ]
  }
];

export const initialScholarshipRecords = [
  {
    id: 'sch-rec-001',
    studentId: 'stu-001',
    studentName: 'Aarav Mehta',
    enrollmentId: 'VCFD/2024/001',
    course: 'B.Des Fashion Design',
    scholarshipName: 'Government Post-Matric Merit Scholarship (MahaDBT)',
    applicationDate: '2024-09-10',
    sanctionedAmount: 75000,
    amountReceived: 75000,
    amountPending: 0,
    status: 'Completed',
    totalAmount: 75000,
    creditDate: '2025-01-15',
    scholarshipCreditAmount: 75000,
    actualBalanceBeforeWithdrawal: 0,
    collegeAmount: 50000,
    studentAmount: 25000,
    disbursementRemarks: 'Full amount disbursed to college fee account and student maintenance allowance',
    installments: [
      {
        id: 'sch-inst-01',
        installmentNumber: 1,
        paymentDate: '2024-11-20',
        amountReceived: 40000,
        paymentMode: 'Bank Transfer',
        transactionRef: 'DBT/MAHA/202411094',
        remarks: 'First installment tuition fee grant',
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        isFreeship: false
      },
      {
        id: 'sch-inst-02',
        installmentNumber: 2,
        paymentDate: '2025-01-15',
        amountReceived: 35000,
        paymentMode: 'Bank Transfer',
        transactionRef: 'DBT/MAHA/202501892',
        remarks: 'Second installment & maintenance grant',
        proofUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
        isFreeship: false
      }
    ],
    documents: [
      {
        id: 'sch-doc-01',
        name: 'MahaDBT Sanction Letter',
        type: 'pdf',
        fileName: 'MahaDBT_Sanction_AaravMehta_2024.pdf',
        uploadDate: '2024-09-12'
      }
    ]
  },
  {
    id: 'sch-rec-002',
    studentId: 'stu-002',
    studentName: 'Ananya Iyer',
    enrollmentId: 'VCFD/2024/002',
    course: 'B.Des Textile Design',
    scholarshipName: 'OBC Post-Matric Tuition Fee Concession',
    applicationDate: '2024-10-05',
    sanctionedAmount: 50000,
    amountReceived: 25000,
    amountPending: 25000,
    status: 'Partial',
    totalAmount: 50000,
    creditDate: '2025-02-01',
    scholarshipCreditAmount: 25000,
    actualBalanceBeforeWithdrawal: 25000,
    collegeAmount: 25000,
    studentAmount: 0,
    disbursementRemarks: 'Installment 1 credited to college fees account. Installment 2 awaiting state treasury release.',
    installments: [
      {
        id: 'sch-inst-03',
        installmentNumber: 1,
        paymentDate: '2025-02-01',
        amountReceived: 25000,
        paymentMode: 'Bank Transfer',
        transactionRef: 'DBT/OBC/202502114',
        remarks: 'Installment 1 50% tuition reimbursement',
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        isFreeship: false
      }
    ],
    documents: [
      {
        id: 'sch-doc-02',
        name: 'OBC Income & Caste Certificate Pack',
        type: 'pdf',
        fileName: 'OBC_Verification_AnanyaIyer.pdf',
        uploadDate: '2024-10-06'
      }
    ]
  },
  {
    id: 'sch-rec-003',
    studentId: 'stu-003',
    studentName: 'Rohan Gaikwad',
    enrollmentId: 'VCFD/2023/045',
    course: 'B.Des Apparel Production',
    scholarshipName: 'Dr. Babasaheb Ambedkar Swadhar Scheme & Freeship',
    applicationDate: '2023-09-01',
    sanctionedAmount: 110000,
    amountReceived: 110000,
    amountPending: 0,
    status: 'Completed',
    totalAmount: 110000,
    creditDate: '2024-12-10',
    scholarshipCreditAmount: 110000,
    collegeAmount: 60000,
    studentAmount: 50000,
    disbursementRemarks: 'Full 100% Freeship and annual hostel allowance disbursed',
    installments: [
      {
        id: 'sch-inst-04',
        installmentNumber: 1,
        paymentDate: '2024-03-10',
        amountReceived: 60000,
        paymentMode: 'Bank Transfer',
        transactionRef: 'SWADHAR/2024/7719',
        remarks: 'College Tuition Fee clearance',
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        isFreeship: true
      },
      {
        id: 'sch-inst-05',
        installmentNumber: 2,
        paymentDate: '2024-12-10',
        amountReceived: 50000,
        paymentMode: 'Bank Transfer',
        transactionRef: 'SWADHAR/2024/9912',
        remarks: 'Student maintenance allowance directly credited to account',
        proofUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
        isFreeship: false
      }
    ],
    documents: [
      {
        id: 'sch-doc-03',
        name: 'Swadhar Approval Order',
        type: 'pdf',
        fileName: 'Swadhar_Approval_RohanGaikwad.pdf',
        uploadDate: '2023-09-05'
      }
    ]
  }
];

export const initialBonafideRecords = [
  {
    id: 'bf-001',
    studentId: 'stu-001',
    studentName: 'Aarav Mehta',
    purpose: 'Passport Application Verification & Residence Proof',
    issueDate: '2026-08-01',
    validUntil: '2026-11-01',
    generatedBy: 'u-clerk-01'
  },
  {
    id: 'bf-002',
    studentId: 'stu-002',
    studentName: 'Ananya Iyer',
    purpose: 'Education Loan Subsidy Renewal (SBI Camp Branch)',
    issueDate: '2026-08-10',
    validUntil: '2026-12-31',
    generatedBy: 'u-clerk-01'
  },
  {
    id: 'bf-003',
    studentId: 'stu-005',
    studentName: 'Tanvi Shinde',
    purpose: 'PMPML Bus Pass Student Concession',
    issueDate: '2026-08-18',
    validUntil: '2027-05-31',
    generatedBy: 'u-clerk-01'
  }
];

export const initialLedgerEntries = [
  {
    id: 'led-001',
    date: '2026-08-24',
    description: 'Semester 4 Tuition & Studio Lab Fee Collection (Batch 2024-28)',
    amount: 385000,
    paymentMode: 'Net Banking',
    chequeNo: 'TXN-HDFC-98102',
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    createdBy: 'u-accountant-01',
    createdAt: '2026-08-24T11:30:00Z'
  },
  {
    id: 'led-002',
    date: '2026-08-20',
    description: 'Annual Runway Fashion Show Venue Booking Advance - Taj Gateway',
    amount: 75000,
    paymentMode: 'Cheque',
    chequeNo: 'CHQ-981240',
    proofUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
    createdBy: 'u-accountant-01',
    createdAt: '2026-08-20T14:15:00Z'
  },
  {
    id: 'led-003',
    date: '2026-08-16',
    description: 'Procurement of High-Speed Industrial Sewing Machines (Juki DDL-8700)',
    amount: 140000,
    paymentMode: 'Net Banking',
    chequeNo: 'RTGS-SBI-89104',
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    createdBy: 'u-accountant-01',
    createdAt: '2026-08-16T16:00:00Z'
  },
  {
    id: 'led-004',
    date: '2026-08-12',
    description: 'MahaDBT State Government Scholarship Batch Credit',
    amount: 215000,
    paymentMode: 'Net Banking',
    chequeNo: 'DBT-TREASURY-0981',
    proofUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
    createdBy: 'u-accountant-01',
    createdAt: '2026-08-12T10:00:00Z'
  },
  {
    id: 'led-005',
    date: '2026-08-05',
    description: 'CLO 3D & Adobe Creative Cloud Campus Licenses Annual Renewal',
    amount: 96000,
    paymentMode: 'UPI',
    chequeNo: 'UPI/ADOBE/2608051',
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    createdBy: 'u-accountant-01',
    createdAt: '2026-08-05T09:45:00Z'
  }
];

export const initialMessages = [
  {
    id: 'msg-001',
    sender_id: 'u-superadmin-01',
    receiver_id: 'u-clerk-01',
    content: 'Please verify that all 2024-2028 batch student documentation for MahaDBT is verified before the Friday portal deadline.',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'msg-002',
    sender_id: 'u-clerk-01',
    receiver_id: 'u-superadmin-01',
    content: 'Yes Sir! Out of 48 applications, 42 are fully approved with caste validation attached. I am following up on the remaining 6 today.',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'msg-003',
    sender_id: 'u-admin-01',
    receiver_id: 'u-staff-01',
    content: 'Good morning Prof. Anjali. Please ensure the Pattern Making lab practical attendance is submitted on the ERP before 4:00 PM.',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'msg-004',
    sender_id: 'u-accountant-01',
    receiver_id: 'u-superadmin-01',
    content: 'Dr. Sharma, the July stationary bills and runway stage advance vouchers have been cleared and posted to the financial ledger.',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

export const initialAppSettings = {
  id: 'app-settings-01',
  college_latitude: 18.52043,
  college_longitude: 73.85674,
  college_radius_meters: 250,
  work_start_time: '09:00:00',
  late_threshold_time: '09:15:00',
  check_in_window_start: '08:00:00',
  check_in_window_end: '10:30:00',
  updated_at: new Date().toISOString()
};

export const initialCollegeHolidays = [
  {
    id: 'hol-001',
    date: '2026-08-15',
    title: 'Independence Day',
    description: 'National Holiday - Flag hoisting at 8:00 AM'
  },
  {
    id: 'hol-002',
    date: '2026-08-27',
    title: 'Ganesh Chaturthi',
    description: 'Public Holiday - College Closed'
  },
  {
    id: 'hol-003',
    date: '2026-10-02',
    title: 'Mahatma Gandhi Jayanti',
    description: 'National Holiday'
  },
  {
    id: 'hol-004',
    date: '2026-11-08',
    title: 'Diwali Festive Break',
    description: 'Diwali Vacation for Students & Staff'
  }
];

export const initialAttendanceRecords = [
  {
    id: 'att-001',
    user_id: 'u-staff-01',
    date: new Date().toISOString().split('T')[0],
    check_in_time: `${new Date().toISOString().split('T')[0]}T08:52:14.000Z`,
    check_in_photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    check_in_latitude: 18.52043,
    check_in_longitude: 73.85674,
    check_in_accuracy: 12.5,
    check_out_time: null,
    check_out_photo_url: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_accuracy: null,
    status: 'Present',
    working_hours: null,
    is_manually_corrected: false,
    corrected_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'att-002',
    user_id: 'u-clerk-01',
    date: new Date().toISOString().split('T')[0],
    check_in_time: `${new Date().toISOString().split('T')[0]}T08:48:30.000Z`,
    check_in_photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    check_in_latitude: 18.52041,
    check_in_longitude: 73.85672,
    check_in_accuracy: 10.2,
    check_out_time: null,
    check_out_photo_url: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_accuracy: null,
    status: 'Present',
    working_hours: null,
    is_manually_corrected: false,
    corrected_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'att-003',
    user_id: 'u-accountant-01',
    date: new Date().toISOString().split('T')[0],
    check_in_time: `${new Date().toISOString().split('T')[0]}T09:05:12.000Z`,
    check_in_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    check_in_latitude: 18.52045,
    check_in_longitude: 73.85675,
    check_in_accuracy: 15.0,
    check_out_time: null,
    check_out_photo_url: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_accuracy: null,
    status: 'Present',
    working_hours: null,
    is_manually_corrected: false,
    corrected_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];
