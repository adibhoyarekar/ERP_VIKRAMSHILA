import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { logError, toUserMessage } from '../../utils/errorHandler';
import { validateFile, ALLOWED_FILE_TYPES } from '../../utils/fileValidator';
import { motion, AnimatePresence } from "motion/react";
import { Search, GraduationCap, FileText, Check, AlertCircle, Plus, Eye, Edit2, X, Upload, FileDown, Banknote, User, Landmark, Lock, ShieldCheck } from 'lucide-react';
import { ScholarshipRecord, ScholarshipInstallment, PaymentMode, ScholarshipStatus } from '../../types/scholarship';
import { getDateRangeForPreset, formatDateDDMMYYYY } from '../../utils/dateFilters';
import { exportScholarshipToExcel } from '../../utils/exportExcel';
import { useEffect } from 'react';
import { Download } from 'lucide-react';
import { Student } from '../../data/mockData';
import { Filter } from 'lucide-react';
import SuccessToast from '../SuccessToast';
import SuccessAnimation from '../SuccessAnimation';
import Loader from '../Loader';
import { supabase } from '../../lib/supabase';
import { openFileUrl, forceDownloadFile, previewLocalFile } from '../../utils/fileViewer';
import DocumentViewerModal, { DocumentPreviewItem } from '../DocumentViewerModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Extracts the human-readable filename from a full Supabase storage URL. */
function getFileName(url?: string, fallbackTitle?: string): string {
  if (!url) return fallbackTitle || '';
  try {
    const decoded = decodeURIComponent(url);
    const clean = decoded.split('?')[0];
    return clean.split('/').pop() || clean || fallbackTitle || '';
  } catch (e) {
    return (url || '').split('?')[0].split('/').pop() || fallbackTitle || url || '';
  }
}


export const handleDownloadDoc = async (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  await forceDownloadFile(url);
};

export const handleViewDoc = (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  openFileUrl(url, 'scholarship_documents');
};


interface Props {
  records: ScholarshipRecord[];
  students?: Student[];
  setStudents?: React.Dispatch<React.SetStateAction<Student[]>>;
  setRecords?: React.Dispatch<React.SetStateAction<ScholarshipRecord[]>>;
  readOnly?: boolean;
  currentUserRole?: string;
}

export default function ScholarshipDashboard({ records, students = [], setStudents, setRecords, readOnly = false, currentUserRole }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<ScholarshipStatus | 'All' | 'None'>('All');
  
  const [yearFilter, setYearFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [castFilter, setCastFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [monthFilter, setMonthFilter] = useState('All');
  const [calendarYearFilter, setCalendarYearFilter] = useState('All');
  const [datePreset, setDatePreset] = useState('custom');
  const [dateRange, setDateRange] = useState({from: '', to: ''});
  
  useEffect(() => {
    if (datePreset !== 'custom') {
      setDateRange(getDateRangeForPreset(datePreset));
    }
  }, [datePreset]);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const filteredStudents = students.filter(student => {
    const record = records.find(r => r.studentId === student.id);
    
    // Search matches Name or PRN (enrollmentId)
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.enrollmentId.toLowerCase().includes(searchTerm.toLowerCase());
                          
    const status = record ? record.status : 'None';
    const matchesStatus = statusFilter === 'All' || status === statusFilter;
    
    let matchesYear = true;
    let matchesSemester = true;
    let matchesCast = true;
    let matchesBranch = true;
    
    if (yearFilter !== 'All') {
      const studentYear = student.studyYear 
        ? `${student.studyYear}${student.studyYear === '1' ? 'st' : student.studyYear === '2' ? 'nd' : student.studyYear === '3' ? 'rd' : 'th'} Year`
        : (Math.ceil(student.semester / 2).toString() + (Math.ceil(student.semester / 2) === 1 ? 'st' : Math.ceil(student.semester / 2) === 2 ? 'nd' : Math.ceil(student.semester / 2) === 3 ? 'rd' : 'th') + ' Year');
      matchesYear = yearFilter === studentYear || (student.studyYear ? yearFilter.startsWith(student.studyYear) : false);
    }
    if (semesterFilter !== 'All') {
      matchesSemester = student.semester.toString() === semesterFilter;
    }
    if (castFilter !== 'All') {
      const normFilter = castFilter.trim().toUpperCase();
      const normStudentCat = (student.category || 'OPEN').trim().toUpperCase();
      if (normFilter === 'OPEN' || normFilter === 'GENERAL') {
        matchesCast = normStudentCat === 'OPEN' || normStudentCat === 'GENERAL' || !student.category;
      } else {
        matchesCast = normStudentCat === normFilter;
      }
    }
    if (branchFilter !== 'All') {
      const normBranchFilter = branchFilter.trim().toLowerCase();
      const normStudentBranch = (student.branch || student.course || '').trim().toLowerCase();
      matchesBranch = normStudentBranch === normBranchFilter || 
                      normStudentBranch.includes(normBranchFilter) || 
                      normBranchFilter.includes(normStudentBranch);
    }
    
    let matchesDate = true;
    if (dateRange.from || dateRange.to) {
       const appDate = record?.applicationDate || '';
       if (!appDate) {
         matchesDate = false;
       } else {
         if (dateRange.from && appDate < dateRange.from) matchesDate = false;
         if (dateRange.to && appDate > dateRange.to) matchesDate = false;
       }
    }

    let matchesMonth = true;
    let matchesCalendarYear = true;
    if (record?.applicationDate) {
      const appDateObj = new Date(record.applicationDate);
      if (monthFilter !== 'All' && appDateObj.getMonth().toString() !== monthFilter) matchesMonth = false;
      if (calendarYearFilter !== 'All' && appDateObj.getFullYear().toString() !== calendarYearFilter) matchesCalendarYear = false;
    } else if (monthFilter !== 'All' || calendarYearFilter !== 'All') {
      matchesMonth = false;
      matchesCalendarYear = false;
    }
    
    return matchesSearch && matchesStatus && matchesYear && matchesSemester && matchesCast && matchesBranch && matchesDate && matchesMonth && matchesCalendarYear;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Dynamically derive unique years from records' applicationDate
  const availableYears = Array.from(
    new Set(
      records
        .filter(r => r.applicationDate)
        .map(r => new Date(r.applicationDate!).getFullYear().toString())
    )
  ).sort((a, b) => Number(b) - Number(a));

  const filteredRecords = records.filter(r => {
    return filteredStudents.some(s => s.id === r.studentId);
  });

  const totalSanctioned = filteredRecords.reduce((sum, r) => sum + r.sanctionedAmount, 0);
  const totalReceived = filteredRecords.reduce((sum, r) => sum + r.amountReceived, 0);
  const totalPending = filteredRecords.reduce((sum, r) => sum + r.amountPending, 0);
  const pendingStudentsCount = filteredRecords.filter(r => r.status === 'Pending' || r.status === 'Partial').length;
  const completedStudentsCount = filteredRecords.filter(r => r.status === 'Completed').length;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('Vikramshila College ERP - Scholarship Report', 14, 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${formatDateDDMMYYYY(new Date())}`, 14, 22);
    
    const monthsNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let filterText = `Total Records: ${filteredStudents.length}`;
    if (monthFilter !== 'All') filterText += ` | Month: ${monthsNames[parseInt(monthFilter)]}`;
    if (calendarYearFilter !== 'All') filterText += ` | Year: ${calendarYearFilter}`;
    if (statusFilter !== 'All') filterText += ` | Status: ${statusFilter}`;
    if (yearFilter !== 'All') filterText += ` | Study Year: ${yearFilter}`;
    if (branchFilter !== 'All') filterText += ` | Branch: ${branchFilter}`;

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(filterText, 14, 28);

    let sumTotalAmount = 0;
    let sumCreditedAmount = 0;
    let sumActualBalanceBeforeWithdrawal = 0;
    let sumCollegeAmount = 0;
    let sumStudentAmount = 0;

    const tableData = filteredStudents.map((student, i) => {
      const record = records.find(r => r.studentId === student.id);
      const studyYearText = student.studyYear 
        ? `${student.studyYear}${student.studyYear === '1' ? 'st' : student.studyYear === '2' ? 'nd' : student.studyYear === '3' ? 'rd' : 'th'} Year` 
        : 'N/A';
      const totalAmt = record ? (record.totalAmount ?? record.sanctionedAmount ?? 0) : 0;
      const rawCreditDate = record?.creditDate || record?.applicationDate || '';
      const creditDate = formatDateDDMMYYYY(rawCreditDate);
      const creditedAmt = record ? (record.scholarshipCreditAmount ?? record.amountReceived ?? 0) : 0;
      const actualBal = record?.actualBalanceBeforeWithdrawal;
      const collegeAmt = record?.collegeAmount ?? 0;
      const studentAmt = record?.studentAmount ?? 0;
      const remarks = record?.disbursementRemarks || '-';

      sumTotalAmount += totalAmt;
      sumCreditedAmount += creditedAmt;
      if (actualBal !== undefined && actualBal !== null) {
        sumActualBalanceBeforeWithdrawal += Number(actualBal);
      }
      sumCollegeAmount += collegeAmt;
      sumStudentAmount += studentAmt;

      return [
        (i + 1).toString(),
        student.name || record?.studentName || 'N/A',
        student.bankAccountNo || '-',
        student.bankName || '-',
        studyYearText,
        `Rs. ${totalAmt.toLocaleString('en-IN')}`,
        creditDate,
        `Rs. ${creditedAmt.toLocaleString('en-IN')}`,
        actualBal !== undefined && actualBal !== null ? `Rs. ${Number(actualBal).toLocaleString('en-IN')}` : '-',
        `Rs. ${collegeAmt.toLocaleString('en-IN')}`,
        `Rs. ${studentAmt.toLocaleString('en-IN')}`,
        remarks
      ];
    });

    tableData.push([
      '', 'TOTAL', '', '', '',
      `Rs. ${sumTotalAmount.toLocaleString('en-IN')}`,
      '',
      `Rs. ${sumCreditedAmount.toLocaleString('en-IN')}`,
      sumActualBalanceBeforeWithdrawal > 0 ? `Rs. ${sumActualBalanceBeforeWithdrawal.toLocaleString('en-IN')}` : '-',
      `Rs. ${sumCollegeAmount.toLocaleString('en-IN')}`,
      `Rs. ${sumStudentAmount.toLocaleString('en-IN')}`,
      ''
    ]);

    autoTable(doc, {
      startY: 33,
      head: [[
        'Sr. No.',
        'Student Name',
        'Account No.',
        'Bank Name',
        'Study Year',
        'Total Amount',
        'Date',
        'Scholarship Credited Amount',
        'Actual Balance Before Withdrawal',
        'College Amount',
        'Student Amount',
        'Remark'
      ]],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: [203, 213, 225],
        textColor: [30, 41, 59]
      },
      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        fillColor: [79, 70, 229], // Royal Indigo theme for Scholarship
        textColor: [255, 255, 255],
        lineWidth: 0.15,
        lineColor: [255, 255, 255], // Vertical/horizontal column divider lines in head
        fontSize: 7.5
      },
      didParseCell: function (data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.font = 'helvetica';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`Scholarship_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSaveRecord = async (
    updatedRecord: ScholarshipRecord & { documents?: any[] },
    updatedStudentData?: Student
  ) => {
    setIsLoading(true);
    try {
      const studentId = updatedRecord.studentId;

      // 1. Update student bank details in Supabase
      if (updatedStudentData && studentId) {
        const { error: stuError } = await supabase
          .from('students')
          .update({
            bank_name: updatedStudentData.bankName || null,
            bank_account_no: updatedStudentData.bankAccountNo || null,
            bank_ifsc: updatedStudentData.bankIfsc || null,
            bank_branch: updatedStudentData.bankBranch || null,
            account_holder_name: updatedStudentData.accountHolderName || null,
            upi_id: updatedStudentData.upiId || null,
            bank_details_updated: new Date().toISOString()
          })
          .eq('id', studentId);

        if (stuError) {
          console.warn('Error updating student bank details in Supabase:', stuError);
        }

        if (setStudents) {
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...updatedStudentData } : s));
        }
      }
      
      // 2. Upsert scholarship_records
      let recordId = updatedRecord.id;
      const scholarshipPayload = {
        student_id: studentId,
        student_name: updatedRecord.studentName,
        enrollment_id: updatedRecord.enrollmentId,
        course: updatedRecord.course,
        scholarship_name: updatedRecord.scholarshipName,
        application_date: updatedRecord.applicationDate || new Date().toISOString().split('T')[0],
        sanctioned_amount: updatedRecord.sanctionedAmount,
        amount_received: updatedRecord.amountReceived,
        amount_pending: updatedRecord.amountPending,
        status: updatedRecord.status,
        total_amount: updatedRecord.totalAmount !== undefined ? updatedRecord.totalAmount : null,
        credit_date: updatedRecord.creditDate || null,
        scholarship_credit_amount: updatedRecord.scholarshipCreditAmount !== undefined ? updatedRecord.scholarshipCreditAmount : null,
        actual_balance_before_withdrawal: updatedRecord.actualBalanceBeforeWithdrawal !== undefined ? updatedRecord.actualBalanceBeforeWithdrawal : null,
        college_amount: updatedRecord.collegeAmount !== undefined ? updatedRecord.collegeAmount : null,
        student_amount: updatedRecord.studentAmount !== undefined ? updatedRecord.studentAmount : null,
        disbursement_remarks: updatedRecord.disbursementRemarks || null
      };

      if (!recordId || recordId.startsWith('sch_')) {
         const { data, error } = await supabase
           .from('scholarship_records')
           .insert([scholarshipPayload])
           .select()
           .single();
         if (error) throw error;
         recordId = data.id;
         updatedRecord.id = recordId;
      } else {
         const { error } = await supabase
           .from('scholarship_records')
           .update({
             scholarship_name: updatedRecord.scholarshipName,
             application_date: updatedRecord.applicationDate,
             sanctioned_amount: updatedRecord.sanctionedAmount,
             amount_received: updatedRecord.amountReceived,
             amount_pending: updatedRecord.amountPending,
             status: updatedRecord.status,
             total_amount: updatedRecord.totalAmount !== undefined ? updatedRecord.totalAmount : null,
             credit_date: updatedRecord.creditDate || null,
             scholarship_credit_amount: updatedRecord.scholarshipCreditAmount !== undefined ? updatedRecord.scholarshipCreditAmount : null,
             actual_balance_before_withdrawal: updatedRecord.actualBalanceBeforeWithdrawal !== undefined ? updatedRecord.actualBalanceBeforeWithdrawal : null,
             college_amount: updatedRecord.collegeAmount !== undefined ? updatedRecord.collegeAmount : null,
             student_amount: updatedRecord.studentAmount !== undefined ? updatedRecord.studentAmount : null,
             disbursement_remarks: updatedRecord.disbursementRemarks || null
           })
           .eq('id', recordId);
         if (error) throw error;
      }

      // 3. Upsert installments
      if (updatedRecord.installments && updatedRecord.installments.length > 0) {
        for (let inst of updatedRecord.installments as any[]) {
          let proofUrl = inst.proofUrl;
          if (inst.file) {
            const fileExt = inst.file.name.split('.').pop();
            const fileName = `${studentId}-inst${inst.installmentNumber}-${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('scholarship_documents').upload(fileName, inst.file);
            if (upError) throw upError;
            const { data: signData } = await supabase.storage.from('scholarship_documents').createSignedUrl(fileName, 86400 * 365);
            proofUrl = signData?.signedUrl || fileName;
            inst.proofUrl = proofUrl;
          }
          
          if (!inst.id || inst.id.startsWith('inst')) {
             const { data: insData } = await supabase.from('scholarship_installments').insert([{
               record_id: recordId,
               installment_number: inst.installmentNumber,
               payment_date: inst.paymentDate || new Date().toISOString().split('T')[0],
               amount_received: inst.amountReceived,
               payment_mode: inst.paymentMode || 'Bank Transfer',
               proof_url: proofUrl,
               is_freeship: inst.isFreeship || false
             }]).select().single();
             if (insData) inst.id = insData.id;
          } else {
             await supabase.from('scholarship_installments').update({
               amount_received: inst.amountReceived,
               proof_url: proofUrl,
               is_freeship: inst.isFreeship || false
             }).eq('id', inst.id);
          }
          inst.file = undefined;
        }
      }

      // 4. Upload and insert documents
      if (updatedRecord.documents && updatedRecord.documents.length > 0) {
        for (let doc of updatedRecord.documents) {
          if (doc.file) {
            const fileExt = doc.file.name.split('.').pop();
            const fileName = `${studentId}-${doc.name.replace(/\s+/g, '')}-${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('scholarship_documents').upload(fileName, doc.file);
            if (upError) throw upError;
            const { data: signData } = await supabase.storage.from('scholarship_documents').createSignedUrl(fileName, 86400 * 365);
            const resolvedDocUrl = signData?.signedUrl || fileName;
            
            const { data: docData } = await supabase.from('scholarship_documents').insert([{
               record_id: recordId,
               name: doc.name,
               type: doc.type,
               file_name: resolvedDocUrl,
               upload_date: doc.uploadDate || new Date().toISOString().split('T')[0]
            }]).select().single();
            if (docData) doc.id = docData.id;
            doc.fileName = resolvedDocUrl;
            doc.file = undefined;
          }
        }
      }

      setIsSaving(true);
      setShowSuccessAnimation(true);

      if (setRecords) {
        setRecords(prev => {
          const exists = prev.find(r => r.id === recordId);
          if (exists) {
            return prev.map(r => r.id === recordId ? updatedRecord : r);
          } else {
            return [...prev, updatedRecord];
          }
        });
      }

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSelectedStudent(null);
        setIsSaving(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }, 2000);
    } catch (err: any) {
      logError('save scholarship', err);
      alert(toUserMessage('save scholarship'));
      setShowSuccessAnimation(false);
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Scholarship Management</h2>
          <p className="text-sm text-slate-500 mt-1">Track and manage student scholarship grants and installments.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <FileText size={18} /> PDF
          </button>
          <button 
            onClick={() => exportScholarshipToExcel(records, filteredStudents)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm"
          >
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500 mb-1">Total Students</p>
          <p className="text-2xl font-bold text-slate-900">{students.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 lg:col-span-2">
          <p className="text-xs font-medium text-slate-500 mb-1">Total Sanctioned</p>
          <p className="text-2xl font-bold text-slate-900">₹{totalSanctioned.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1 lg:col-span-1">
          <p className="text-xs font-medium text-emerald-600 mb-1">Total Received</p>
          <p className="text-2xl font-bold text-emerald-700">₹{totalReceived.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1 lg:col-span-1">
          <p className="text-xs font-medium text-rose-600 mb-1">Total Pending</p>
          <p className="text-2xl font-bold text-rose-700">₹{totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500 mb-1">Pending/Completed</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-amber-600 font-bold text-lg">{pendingStudentsCount}</span>
            <span className="text-slate-300">/</span>
            <span className="text-emerald-600 font-bold text-lg">{completedStudentsCount}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4">
          <div className="relative flex-1 w-full sm:w-auto min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by student name or PRN no..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] transition-all"
            />
          </div>
          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showAdvancedFilters ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter size={16} /> Filters
          </button>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] bg-white cursor-pointer"
          >
            <option value="All">All Months</option>
            <option value="0">January</option>
            <option value="1">February</option>
            <option value="2">March</option>
            <option value="3">April</option>
            <option value="4">May</option>
            <option value="5">June</option>
            <option value="6">July</option>
            <option value="7">August</option>
            <option value="8">September</option>
            <option value="9">October</option>
            <option value="10">November</option>
            <option value="11">December</option>
          </select>

          <select
            value={calendarYearFilter}
            onChange={(e) => setCalendarYearFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] bg-white cursor-pointer"
          >
            <option value="All">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] bg-white cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="None">None</option>
          </select>
        </div>
        
        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100"
          >
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]">
                <option value="All">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Semester</label>
              <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]">
                <option value="All">All Semesters</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
                <option value="3">Semester 3</option>
                <option value="4">Semester 4</option>
                <option value="5">Semester 5</option>
                <option value="6">Semester 6</option>
                <option value="7">Semester 7</option>
                <option value="8">Semester 8</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cast / Category</label>
              <select value={castFilter} onChange={e => setCastFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] bg-white cursor-pointer">
                <option value="All">All Categories</option>
                <option value="OPEN">General (Open)</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="VJNT">VJNT</option>
                <option value="EWS">EWS</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] bg-white cursor-pointer">
                <option value="All">All Branches</option>
                <option value="BA Fashion Design">BA Fashion Design</option>
                <option value="BSc Clinical Laboratory CLS">BSc Clinical Laboratory CLS</option>
                {Array.from(new Set(students.map(s => s.branch || s.course).filter(Boolean)))
                  .filter(b => b !== 'BA Fashion Design' && b !== 'BSc Clinical Laboratory CLS')
                  .map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
              </select>
            </div>
          </motion.div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name & ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Scholarship</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Sanctioned</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Received</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Pending</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Docs</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const record = records.find(r => r.studentId === student.id);
                  return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{student.name}</p>
                      <p className="text-xs text-slate-500">{student.enrollmentId} &bull; {student.course}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{record ? record.scholarshipName : '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">{record ? `₹${record.sanctionedAmount.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-sm text-emerald-600 font-medium text-right">{record ? `₹${record.amountReceived.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-rose-600 text-right">{record ? `₹${record.amountPending.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4">
                      {record ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        record.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        record.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {record.status}
                      </span>
                      ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-600 border-slate-200">
                        None
                      </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {record?.documents && record.documents.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {record.documents.map((doc, idx) => (
                            <button
                              key={idx}
                              title={`Download ${doc.name}`}
                              className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-sky-50 hover:text-sky-600 transition-colors"
                              onClick={(e) => handleDownloadDoc(e, doc.fileName)}
                            >
                              <FileDown size={14} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedStudent(student)}
                        className="text-slate-500 hover:text-sky-600 p-2 rounded hover:bg-sky-50 transition-colors inline-flex"
                        title={readOnly ? "View Details" : "Manage Scholarship"}
                      >
                        {readOnly ? <Eye size={18} /> : <Edit2 size={18} />}
                      </button>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <GraduationCap size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No scholarship records found</p>
                    <p className="text-xs mt-1">Adjust search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <StudentScholarshipModal 
          student={selectedStudent}
          record={records.find(r => r.studentId === selectedStudent.id) || null}
          onClose={() => setSelectedStudent(null)} 
          onSave={handleSaveRecord}
          onStudentUpdate={(updatedStudent) => {
            if (setStudents && students) {
              setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
            }
          }}
          readOnly={readOnly}
          currentUserRole={currentUserRole}
          showSuccessAnimation={showSuccessAnimation}
          isSaving={isSaving}
          onPreviewDoc={(doc) => setPreviewDoc(doc)}
        />
      )}
      <SuccessToast show={showSuccessToast} />

      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

function StudentScholarshipModal({ 
  student, 
  record, 
  onClose, 
  onSave, 
  onStudentUpdate, 
  readOnly, 
  currentUserRole,
  showSuccessAnimation, 
  isSaving,
  onPreviewDoc 
}: { 
  student: Student; 
  record: ScholarshipRecord | null; 
  onClose: () => void; 
  onSave: (r: ScholarshipRecord, updatedStudent?: Student) => void; 
  onStudentUpdate?: (updatedStudent: Student) => void; 
  readOnly: boolean; 
  currentUserRole?: string;
  showSuccessAnimation?: boolean; 
  isSaving?: boolean;
  onPreviewDoc?: (doc: DocumentPreviewItem) => void; 
}) {
  const [scholarshipData, setScholarshipData] = useState<Partial<ScholarshipRecord>>(
    record ? { ...record, installments: record.installments || [] } : {
      studentId: student.id,
      studentName: student.name,
      enrollmentId: student.enrollmentId,
      course: student.course,
      scholarshipName: '',
      sanctionedAmount: 0,
      amountReceived: 0,
      amountPending: 0,
      status: 'Pending',
      installments: []
    }
  );

  const [documents, setDocuments] = useState<any[]>(record?.documents || []);
  const [docType, setDocType] = useState<string>('Application Form');
  
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: student.accountHolderName || student.name || '',
    bankName: student.bankName || '',
    bankAccountNo: student.bankAccountNo || '',
    bankIfsc: student.bankIfsc || '',
    bankBranch: student.bankBranch || '',
    upiId: student.upiId || ''
  });

  const [disbursementData, setDisbursementData] = useState({
    totalAmount: record?.totalAmount ?? (record?.sanctionedAmount || 0),
    creditDate: record?.creditDate || '',
    scholarshipCreditAmount: record?.scholarshipCreditAmount ?? (record?.amountReceived || 0),
    actualBalanceBeforeWithdrawal: record?.actualBalanceBeforeWithdrawal !== undefined && record?.actualBalanceBeforeWithdrawal !== null ? record.actualBalanceBeforeWithdrawal : '',
    collegeAmount: record?.collegeAmount ?? 0,
    studentAmount: record?.studentAmount ?? 0,
    disbursementRemarks: record?.disbursementRemarks || ''
  });

  const isDisbursementReadOnly = readOnly || currentUserRole === 'clerk';

  const handleSave = () => {
    // Basic validation
    if (!scholarshipData.scholarshipName) {
      alert("Please enter scholarship name.");
      return;
    }
    
    // Validation for Freeship vs Proof
    if (scholarshipData.installments) {
      for (let i = 0; i < scholarshipData.installments.length; i++) {
        const inst = scholarshipData.installments[i];
        if (inst.amountReceived > 0 && !inst.isFreeship && !inst.proofUrl && !(inst as any).file) {
          alert(`Proof document is mandatory for Installment ${inst.installmentNumber} unless it's a freeship.`);
          return;
        }
      }
    }
    
    // Calculate pending amount automatically (ensuring sanctionedAmount and totalAmount are always in sync)
    const syncedTotalSanctioned = Number(disbursementData.totalAmount) || Number(scholarshipData.sanctionedAmount) || 0;
    const received = Number(scholarshipData.amountReceived) || 0;
    const pending = Math.max(0, syncedTotalSanctioned - received);
    
    let newStatus: ScholarshipStatus = 'Pending';
    if (received >= syncedTotalSanctioned && syncedTotalSanctioned > 0) newStatus = 'Completed';
    else if (received > 0) newStatus = 'Partial';

    const finalRecord: ScholarshipRecord = {
      ...(scholarshipData as ScholarshipRecord),
      id: record ? record.id : `sch_${Date.now()}`,
      amountPending: pending,
      amountReceived: received,
      sanctionedAmount: syncedTotalSanctioned,
      totalAmount: syncedTotalSanctioned,
      status: newStatus,
      documents: documents,
      creditDate: disbursementData.creditDate || undefined,
      scholarshipCreditAmount: Number(disbursementData.scholarshipCreditAmount) || 0,
      actualBalanceBeforeWithdrawal: disbursementData.actualBalanceBeforeWithdrawal !== '' && disbursementData.actualBalanceBeforeWithdrawal !== undefined && disbursementData.actualBalanceBeforeWithdrawal !== null ? Number(disbursementData.actualBalanceBeforeWithdrawal) : undefined,
      collegeAmount: Number(disbursementData.collegeAmount) || 0,
      studentAmount: Number(disbursementData.studentAmount) || 0,
      disbursementRemarks: disbursementData.disbursementRemarks || undefined
    };
    
    const updatedStudentObj: Student = {
      ...student,
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      bankAccountNo: bankDetails.bankAccountNo,
      bankIfsc: bankDetails.bankIfsc,
      bankBranch: bankDetails.bankBranch,
      upiId: bankDetails.upiId,
      bankDetailsUpdated: new Date().toISOString()
    };

    if (onStudentUpdate) {
      onStudentUpdate(updatedStudentObj);
    }

    onSave(finalRecord as any, updatedStudentObj);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 shrink-0">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Scholarship Details</h3>
              <p className="text-sm text-slate-500 mt-1">{student.name} • {student.course} ({student.branch})</p>
            </div>
            <button onClick={() => { if (!showSuccessAnimation) onClose(); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/50 relative">
            {showSuccessAnimation ? (
              <SuccessAnimation
                title="Record Saved!"
                message={<><span className="font-semibold text-emerald-600">Scholarship Details</span> updated.</>}
                color="emerald"
              />
            ) : (
              <div className="p-6 space-y-8">
                {/* Section 1: Student Overview (Read Only) */}
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                  <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><User size={20} /> Student Profile Overview</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Full Name</p>
                      <p className="text-sm font-semibold text-slate-900 break-words">{student.name || 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">PRN No / Enrollment ID</p>
                      <p className="text-sm font-semibold text-slate-900 break-all">{student.enrollmentId || 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Course & Branch</p>
                      <p className="text-sm font-semibold text-slate-900 break-words">{student.course} {student.branch ? `(${student.branch})` : ''}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Study Year & Semester</p>
                      <p className="text-sm font-semibold text-slate-900 break-words">{student.studyYear ? student.studyYear + (student.studyYear === '1' ? 'st' : student.studyYear === '2' ? 'nd' : student.studyYear === '3' ? 'rd' : 'th') + ' Year' : 'N/A'}, Semester {student.semester}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Category / Cast</p>
                      <p className="text-sm font-semibold text-slate-900 break-words">{student.category || 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Date of Birth</p>
                      <p className="text-sm font-semibold text-slate-900 break-words">{student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Email</p>
                      <p className="text-sm font-semibold text-slate-900 break-all">{student.email || 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 mb-1">Phone</p>
                      <p className="text-sm font-semibold text-slate-900 break-all">{student.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Scholarship Details (Editable by Clerk) */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><GraduationCap size={20} /> Scholarship Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Scholarship Name</label>
                        <input 
                          type="text" 
                          value={scholarshipData.scholarshipName} 
                          onChange={e => setScholarshipData({...scholarshipData, scholarshipName: e.target.value})}
                          disabled={readOnly}
                          placeholder="e.g. State Merit Scholarship"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] disabled:bg-slate-50 disabled:text-slate-500" 
                        />
                      </div>
                      
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Total Sanctioned Amount (₹)</label>
                          <input 
                            type="number" 
                            value={scholarshipData.sanctionedAmount || ''} 
                            onChange={e => {
                              const val = Number(e.target.value);
                              setScholarshipData(prev => ({ ...prev, sanctionedAmount: val }));
                              setDisbursementData(prev => ({ ...prev, totalAmount: val }));
                            }}
                            disabled={readOnly}
                            placeholder="e.g. 50000"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] disabled:bg-slate-50 disabled:text-slate-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount Received (₹)</label>
                          <input 
                            type="number" 
                            value={scholarshipData.amountReceived || 0} 
                            disabled={true}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4 mt-4">
                        <h5 className="font-semibold text-slate-800 flex items-center gap-2"><Check size={16} className="text-emerald-500"/> Installment 1</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Amount Received (₹)</label>
                            <input 
                              type="number" 
                              value={scholarshipData.installments?.[0]?.amountReceived || ''} 
                              onChange={e => {
                                const inst = [...(scholarshipData.installments || [])];
                                if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                inst[0].amountReceived = Number(e.target.value);
                                const total = (inst[0]?.amountReceived || 0) + (inst[1]?.amountReceived || 0);
                                setScholarshipData({...scholarshipData, installments: inst, amountReceived: total});
                              }}
                              disabled={readOnly}
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] disabled:bg-transparent disabled:font-semibold" 
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-slate-700">Proof Document</label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={scholarshipData.installments?.[0]?.isFreeship || false}
                                  onChange={(e) => {
                                    const inst = [...(scholarshipData.installments || [])];
                                    if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                    inst[0].isFreeship = e.target.checked;
                                    if (e.target.checked) {
                                      inst[0].proofUrl = '';
                                      (inst[0] as any).file = undefined;
                                    }
                                    setScholarshipData({...scholarshipData, installments: inst});
                                  }}
                                  disabled={readOnly}
                                  className="w-3 h-3 text-[#1e293b] rounded border-slate-300 focus:ring-[#1e293b]"
                                />
                                <span className="text-xs font-medium text-slate-600">Is Freeship?</span>
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              {scholarshipData.installments?.[0]?.isFreeship ? (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">Freeship (No proof required)</span>
                              ) : (scholarshipData.installments?.[0]?.proofUrl || (scholarshipData.installments?.[0] as any)?.file) ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded truncate max-w-[130px]" title={(scholarshipData.installments?.[0] as any)?.file ? (scholarshipData.installments?.[0] as any).file.name : scholarshipData.installments?.[0]?.proofUrl}>
                                    {(scholarshipData.installments?.[0] as any)?.file ? (scholarshipData.installments?.[0] as any).file.name : getFileName(scholarshipData.installments?.[0]?.proofUrl || '', 'Installment 1 Proof')}
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const localFile = (scholarshipData.installments?.[0] as any)?.file; 
                                      const proofUrl = scholarshipData.installments?.[0]?.proofUrl;
                                      if (localFile) {
                                        onPreviewDoc ? onPreviewDoc({ title: localFile.name, url: URL.createObjectURL(localFile), bucket: 'scholarship_documents' }) : previewLocalFile(localFile);
                                      } else if (proofUrl) {
                                        onPreviewDoc ? onPreviewDoc({ title: getFileName(proofUrl, 'Installment 1 Proof'), url: proofUrl, bucket: 'scholarship_documents' }) : handleViewDoc(e, proofUrl);
                                      }
                                    }} 
                                    className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                                    title={(scholarshipData.installments?.[0] as any)?.file ? 'Preview (not yet saved)' : 'View'}
                                  >
                                    <Eye size={12}/> View
                                  </button>
                                  {!(scholarshipData.installments?.[0] as any)?.file && scholarshipData.installments?.[0]?.proofUrl && (
                                    <button type="button" onClick={(e) => handleDownloadDoc(e, scholarshipData.installments?.[0]?.proofUrl!)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors cursor-pointer" title="Download"><FileDown size={14}/></button>
                                  )}
                                  {!readOnly && <button type="button" onClick={() => {
                                    const inst = [...(scholarshipData.installments || [])];
                                    if(inst[0]) {
                                      inst[0].proofUrl = '';
                                      (inst[0] as any).file = undefined;
                                    }
                                    setScholarshipData({...scholarshipData, installments: inst});
                                  }} className="text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"><X size={14}/></button>}
                                </div>
                              ) : (
                                !readOnly && <label className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
                                  <Upload size={14} /> Upload PDF/Doc (Max 5MB)
                                  <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      const file = e.target.files[0];
                                      const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                                      if (errorMsg) {
                                        alert(errorMsg);
                                        e.target.value = '';
                                        return;
                                      }
                                      const inst = [...(scholarshipData.installments || [])];
                                      if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                      inst[0].proofUrl = file.name;
                                      (inst[0] as any).file = file;
                                      setScholarshipData({...scholarshipData, installments: inst});
                                    }
                                  }} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                        <h5 className="font-semibold text-slate-800 flex items-center gap-2"><Check size={16} className="text-emerald-500"/> Installment 2</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Amount Received (₹)</label>
                            <input 
                              type="number" 
                              value={scholarshipData.installments?.[1]?.amountReceived || ''} 
                              onChange={e => {
                                const inst = [...(scholarshipData.installments || [])];
                                if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                if (!inst[1]) inst[1] = { id: 'inst2', installmentNumber: 2, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                inst[1].amountReceived = Number(e.target.value);
                                const total = (inst[0]?.amountReceived || 0) + (inst[1]?.amountReceived || 0);
                                setScholarshipData({...scholarshipData, installments: inst, amountReceived: total});
                              }}
                              disabled={readOnly}
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] disabled:bg-transparent disabled:font-semibold" 
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-slate-700">Proof Document</label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={scholarshipData.installments?.[1]?.isFreeship || false}
                                  onChange={(e) => {
                                    const inst = [...(scholarshipData.installments || [])];
                                    if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                    if (!inst[1]) inst[1] = { id: 'inst2', installmentNumber: 2, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                    inst[1].isFreeship = e.target.checked;
                                    if (e.target.checked) {
                                      inst[1].proofUrl = '';
                                      (inst[1] as any).file = undefined;
                                    }
                                    setScholarshipData({...scholarshipData, installments: inst});
                                  }}
                                  disabled={readOnly}
                                  className="w-3 h-3 text-[#1e293b] rounded border-slate-300 focus:ring-[#1e293b]"
                                />
                                <span className="text-xs font-medium text-slate-600">Is Freeship?</span>
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              {scholarshipData.installments?.[1]?.isFreeship ? (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">Freeship (No proof required)</span>
                              ) : (scholarshipData.installments?.[1]?.proofUrl || (scholarshipData.installments?.[1] as any)?.file) ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded truncate max-w-[130px]" title={(scholarshipData.installments?.[1] as any)?.file ? (scholarshipData.installments?.[1] as any).file.name : scholarshipData.installments?.[1]?.proofUrl}>
                                    {(scholarshipData.installments?.[1] as any)?.file ? (scholarshipData.installments?.[1] as any).file.name : getFileName(scholarshipData.installments?.[1]?.proofUrl || '', 'Installment 2 Proof')}
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const localFile = (scholarshipData.installments?.[1] as any)?.file; 
                                      const proofUrl = scholarshipData.installments?.[1]?.proofUrl;
                                      if (localFile) {
                                        onPreviewDoc ? onPreviewDoc({ title: localFile.name, url: URL.createObjectURL(localFile), bucket: 'scholarship_documents' }) : previewLocalFile(localFile);
                                      } else if (proofUrl) {
                                        onPreviewDoc ? onPreviewDoc({ title: getFileName(proofUrl, 'Installment 2 Proof'), url: proofUrl, bucket: 'scholarship_documents' }) : handleViewDoc(e, proofUrl);
                                      }
                                    }} 
                                    className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                                    title={(scholarshipData.installments?.[1] as any)?.file ? 'Preview (not yet saved)' : 'View'}
                                  >
                                    <Eye size={12}/> View
                                  </button>
                                  {!(scholarshipData.installments?.[1] as any)?.file && scholarshipData.installments?.[1]?.proofUrl && (
                                    <button type="button" onClick={(e) => handleDownloadDoc(e, scholarshipData.installments?.[1]?.proofUrl!)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors cursor-pointer" title="Download"><FileDown size={14}/></button>
                                  )}
                                  {!readOnly && <button type="button" onClick={() => {
                                    const inst = [...(scholarshipData.installments || [])];
                                    if(inst[1]) {
                                      inst[1].proofUrl = '';
                                      (inst[1] as any).file = undefined;
                                    }
                                    setScholarshipData({...scholarshipData, installments: inst});
                                  }} className="text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"><X size={14}/></button>}
                                </div>
                              ) : (
                                !readOnly && <label className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
                                  <Upload size={14} /> Upload PDF/Doc (Max 5MB)
                                  <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      const file = e.target.files[0];
                                      const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                                      if (errorMsg) {
                                        alert(errorMsg);
                                        e.target.value = '';
                                        return;
                                      }
                                      const inst = [...(scholarshipData.installments || [])];
                                      if (!inst[0]) inst[0] = { id: 'inst1', installmentNumber: 1, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                      if (!inst[1]) inst[1] = { id: 'inst2', installmentNumber: 2, paymentDate: '', amountReceived: 0, paymentMode: 'Bank Transfer' };
                                      inst[1].proofUrl = file.name;
                                      (inst[1] as any).file = file;
                                      setScholarshipData({...scholarshipData, installments: inst});
                                    }
                                  }} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <select
                          value={scholarshipData.status}
                          onChange={e => setScholarshipData({...scholarshipData, status: e.target.value as ScholarshipStatus})}
                          disabled={readOnly}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b] disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Partial">Partial</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-4 flex flex-col h-full">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Required Documents</label>
                      <div className="border border-slate-200 rounded-xl flex flex-col flex-1 bg-slate-50 overflow-hidden">
                        <div className="p-4 bg-white border-b border-slate-200">
                          {!readOnly && (
                            <div className="flex items-center gap-2">
                              <select 
                                value={docType}
                                onChange={e => setDocType(e.target.value)}
                                className="flex-1 min-w-0 px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-sm font-medium focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                              >
                                <option value="Application Form">Application Form</option>
                                <option value="Income Certificate">Income Certificate</option>
                                <option value="Caste Certificate">Caste Certificate</option>
                                <option value="Domicile Certificate">Domicile Certificate</option>
                                <option value="Bank Passbook">Bank Passbook</option>
                                <option value="Aadhar Card">Aadhar Card</option>
                                <option value="Other">Other</option>
                              </select>
                              <label 
                                style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-lg text-sm font-bold cursor-pointer shadow-sm shrink-0 transition-all"
                              >
                                <Upload size={16} className="text-white shrink-0" />
                                <span className="text-white font-bold select-none">Upload</span>
                                <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async e => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                                    if (errorMsg) {
                                      alert(errorMsg);
                                      e.target.value = '';
                                      return;
                                    }
                                    const newDoc = {
                                      id: Math.random().toString(36).substr(2, 9),
                                      name: docType,
                                      type: docType,
                                      fileName: file.name,
                                      uploadDate: new Date().toISOString(),
                                      file: file
                                    };
                                    setDocuments([...documents, newDoc]);
                                  }
                                }} />
                              </label>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto max-h-[220px]">
                          {documents.length > 0 ? (
                            <div className="space-y-2">
                              {documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                      <FileText size={16} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                                      <p className="text-xs text-slate-500">Document • {new Date(doc.uploadDate).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      type="button" 
                                      title={doc.file ? 'Preview (not yet saved)' : 'View'} 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (doc.file) {
                                          onPreviewDoc ? onPreviewDoc({ title: doc.name || 'Document Preview', url: URL.createObjectURL(doc.file), bucket: 'scholarship_documents' }) : previewLocalFile(doc.file);
                                        } else {
                                          onPreviewDoc ? onPreviewDoc({ title: doc.name, url: doc.fileName, bucket: 'scholarship_documents' }) : handleViewDoc(e, doc.fileName);
                                        }
                                      }} 
                                      className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                    >
                                      <Eye size={12} /> View
                                    </button>
                                    {!doc.file && (
                                      <button type="button" title="Download" onClick={(e) => handleDownloadDoc(e, doc.fileName)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                        <FileDown size={16} />
                                      </button>
                                    )}
                                    {!readOnly && (
                                      <button 
                                        type="button" 
                                        title="Delete" 
                                        onClick={() => setDocuments(documents.filter(d => d.id !== doc.id))}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                              <FileText size={32} className="mb-2 opacity-50" />
                              <p className="text-sm">No documents uploaded yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Bank Account Details */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={20} className="text-emerald-600" /> Bank Account Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Account Holder Name</label>
                      <input 
                        type="text" 
                        value={bankDetails.accountHolderName} 
                        onChange={e => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                        disabled={readOnly}
                        placeholder={student.name}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
                      <input 
                        type="text" 
                        value={bankDetails.bankName} 
                        onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})}
                        disabled={readOnly}
                        placeholder="e.g. State Bank of India"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                      <input 
                        type="text" 
                        value={bankDetails.bankAccountNo} 
                        onChange={e => setBankDetails({...bankDetails, bankAccountNo: e.target.value})}
                        disabled={readOnly}
                        placeholder="e.g. 123456789012"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">IFSC Code</label>
                      <input 
                        type="text" 
                        value={bankDetails.bankIfsc} 
                        onChange={e => setBankDetails({...bankDetails, bankIfsc: e.target.value.toUpperCase()})}
                        disabled={readOnly}
                        placeholder="e.g. SBIN0001234"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm uppercase focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Branch Name</label>
                      <input 
                        type="text" 
                        value={bankDetails.bankBranch} 
                        onChange={e => setBankDetails({...bankDetails, bankBranch: e.target.value})}
                        disabled={readOnly}
                        placeholder="e.g. Main Branch"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">UPI ID / VPA</label>
                      <input 
                        type="text" 
                        value={bankDetails.upiId} 
                        onChange={e => setBankDetails({...bankDetails, upiId: e.target.value})}
                        disabled={readOnly}
                        placeholder="e.g. name@oksbi"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Scholarship Credit & Disbursement Details (Accountant can Edit, Clerk View-Only) */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                    <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Landmark size={20} className="text-indigo-600" /> Scholarship Credit & Disbursement Details
                    </h4>
                    {isDisbursementReadOnly ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full w-fit">
                        <Lock size={12} /> View Only (Managed by Accountant)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full w-fit">
                        <ShieldCheck size={12} /> Accountant Editable
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Total Amount (₹)</label>
                      <input 
                        type="number" 
                        value={disbursementData.totalAmount || ''} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          setDisbursementData(prev => ({ ...prev, totalAmount: val }));
                          setScholarshipData(prev => ({ ...prev, sanctionedAmount: val }));
                        }}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. 50000"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Date Credited on Student Account</label>
                      <input 
                        type="date" 
                        value={disbursementData.creditDate || ''} 
                        onChange={e => setDisbursementData({...disbursementData, creditDate: e.target.value})}
                        disabled={isDisbursementReadOnly}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Scholarship Credit Amount (₹)</label>
                      <input 
                        type="number" 
                        value={disbursementData.scholarshipCreditAmount || ''} 
                        onChange={e => setDisbursementData({...disbursementData, scholarshipCreditAmount: Number(e.target.value)})}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. 45000"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Actual Balance Before Withdrawal (₹)</label>
                      <input 
                        type="number" 
                        value={disbursementData.actualBalanceBeforeWithdrawal !== undefined && disbursementData.actualBalanceBeforeWithdrawal !== null ? disbursementData.actualBalanceBeforeWithdrawal : ''} 
                        onChange={e => setDisbursementData({...disbursementData, actualBalanceBeforeWithdrawal: e.target.value === '' ? '' : Number(e.target.value)})}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. 15000"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">College Amount (₹)</label>
                      <input 
                        type="number" 
                        value={disbursementData.collegeAmount || ''} 
                        onChange={e => setDisbursementData({...disbursementData, collegeAmount: Number(e.target.value)})}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. 35000"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Student Amount (₹)</label>
                      <input 
                        type="number" 
                        value={disbursementData.studentAmount || ''} 
                        onChange={e => setDisbursementData({...disbursementData, studentAmount: Number(e.target.value)})}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. 10000"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Disbursement Remark / Settlement Note</label>
                      <input 
                        type="text" 
                        value={disbursementData.disbursementRemarks || ''} 
                        onChange={e => setDisbursementData({...disbursementData, disbursementRemarks: e.target.value})}
                        disabled={isDisbursementReadOnly}
                        placeholder="e.g. Amount credited via DBT; ₹35,000 adjusted towards college fees, balance ₹10,000 released to student"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 transition-colors" 
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
            <button 
              type="button"
              onClick={() => { if (!showSuccessAnimation && !isSaving) onClose(); }} 
              disabled={showSuccessAnimation || isSaving}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Close
            </button>
            {!readOnly && !showSuccessAnimation && (
              <button 
                type="button"
                onClick={handleSave} 
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Details...</span>
                  </>
                ) : (
                  <span>Save Details</span>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
