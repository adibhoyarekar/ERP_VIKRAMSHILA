import { bookNew, aoaToSheet, jsonToSheet, writeFile } from './xlsxWriter';
import { StationaryRecord } from '../types/stationary';
import { ScholarshipRecord } from '../types/scholarship';
import { Student } from '../data/mockData';
import { formatDateDDMMYYYY } from './dateFilters';

export async function exportStationaryToExcel(records: StationaryRecord[], isYearly = false) {
  const dataRows: Record<string, string | number>[] = [];
  let totalAmount = 0;

  const vendorTotals: Record<string, { count: number; total: number }> = {};
  const categoryTotals: Record<string, { count: number; total: number }> = {};
  const modeTotals: Record<string, number> = {
    Cash: 0, UPI: 0, Cheque: 0, 'Bank Transfer': 0, Card: 0,
  };
  const monthTotals: Record<string, number> = {};

  records.forEach((r, index) => {
    const modes = Array.from(new Set(r.payments?.map(p => p.mode) || [])).join(', ');
    const refNos = (r.payments?.map(p => p.referenceNo).filter(Boolean) || []).join(', ');

    dataRows.push({
      'Sr No.': index + 1,
      'Expense ID': r.id,
      Date: formatDateDDMMYYYY(r.date),
      Vendor: r.vendorName,
      Category: r.objectName,
      Description: `${r.objectName} - ${r.unit} units`,
      Amount: r.price,
      'Payment Mode': modes || 'Pending',
      'Receipt Number': refNos || '',
      'Invoice Number': r.payments?.[0]?.billUrl || '',
      Department: 'General',
      Remarks: r.remarks || '',
    });

    totalAmount += r.price;

    if (!vendorTotals[r.vendorName]) vendorTotals[r.vendorName] = { count: 0, total: 0 };
    vendorTotals[r.vendorName].count += 1;
    vendorTotals[r.vendorName].total += r.price;

    if (!categoryTotals[r.objectName]) categoryTotals[r.objectName] = { count: 0, total: 0 };
    categoryTotals[r.objectName].count += 1;
    categoryTotals[r.objectName].total += r.price;

    if (r.payments) {
      r.payments.forEach(p => {
        if (!modeTotals[p.mode]) modeTotals[p.mode] = 0;
        modeTotals[p.mode] += p.amount;
      });
    }

    if (isYearly) {
      const d = new Date(r.date);
      const monthName = d.toLocaleString('default', { month: 'long' });
      if (!monthTotals[monthName]) monthTotals[monthName] = 0;
      monthTotals[monthName] += r.price;
    }
  });

  const wb = bookNew();

  // Main expenses sheet
  jsonToSheet(wb, dataRows, 'Expenses');

  // Summary sheet
  const summaryRows: (string | number)[][] = [];
  summaryRows.push(['Overall Summary']);
  summaryRows.push(['Total Number of Expenses', records.length]);
  summaryRows.push(['Total Amount Spent', totalAmount]);
  summaryRows.push([]);

  summaryRows.push(['Vendor-wise Summary']);
  summaryRows.push(['Vendor', 'Number of Transactions', 'Total Amount']);
  Object.keys(vendorTotals)
    .map(v => ({ name: v, ...vendorTotals[v] }))
    .sort((a, b) => b.total - a.total)
    .forEach(v => summaryRows.push([v.name, v.count, v.total]));
  summaryRows.push([]);

  summaryRows.push(['Category-wise Summary']);
  summaryRows.push(['Category', 'Number of Entries', 'Total Amount']);
  Object.keys(categoryTotals)
    .map(c => ({ name: c, ...categoryTotals[c] }))
    .sort((a, b) => b.total - a.total)
    .forEach(c => summaryRows.push([c.name, c.count, c.total]));
  summaryRows.push([]);

  summaryRows.push(['Payment Mode Summary']);
  Object.keys(modeTotals).forEach(m => {
    if (modeTotals[m] > 0) summaryRows.push([m, modeTotals[m]]);
  });

  if (isYearly) {
    summaryRows.push([]);
    summaryRows.push(['Monthly Summary']);
    summaryRows.push(['Month', 'Total Expenses']);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    months.forEach(m => {
      if (monthTotals[m] !== undefined) summaryRows.push([m, monthTotals[m]]);
    });
  }

  aoaToSheet(wb, summaryRows, 'Summary');

  await writeFile(wb, `Expenses_Export_${new Date().getTime()}.xlsx`);
}

export async function exportScholarshipToExcel(
  records: ScholarshipRecord[],
  students: Student[],
  _isYearly = false,
) {
  const dataRows: Record<string, string | number>[] = [];
  let sumTotalAmount = 0;
  let sumCreditedAmount = 0;
  let sumActualBalanceBeforeWithdrawal = 0;
  let sumCollegeAmount = 0;
  let sumStudentAmount = 0;

  students.forEach((student, index) => {
    const record = records.find(r => r.studentId === student.id);
    const studyYearText = student.studyYear 
      ? `${student.studyYear}${student.studyYear === '1' ? 'st' : student.studyYear === '2' ? 'nd' : student.studyYear === '3' ? 'rd' : 'th'} Year` 
      : 'N/A';
    const totalAmt = record ? (record.totalAmount ?? record.sanctionedAmount ?? 0) : 0;
    const rawCreditDate = record?.creditDate || record?.applicationDate || '';
    const formattedCreditDate = formatDateDDMMYYYY(rawCreditDate);
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

    dataRows.push({
      'Sr. No.': index + 1,
      'Student Name': student.name || record?.studentName || 'N/A',
      'Account No.': student.bankAccountNo || '-',
      'Bank Name': student.bankName || '-',
      'Study Year': studyYearText,
      'Total Amount': totalAmt,
      'Date': formattedCreditDate,
      'Scholarship Credited Amount': creditedAmt,
      'Actual Balance Before Withdrawal': actualBal !== undefined && actualBal !== null ? actualBal : '-',
      'College Amount': collegeAmt,
      'Student Amount': studentAmt,
      'Remark': remarks,
    });
  });

  const wb = bookNew();
  jsonToSheet(wb, dataRows, 'Scholarships');

  const summaryRows: (string | number)[][] = [
    ['Overall Summary'],
    ['Total Records', students.length],
    ['Total Amount', sumTotalAmount],
    ['Total Scholarship Credited Amount', sumCreditedAmount],
    ['Total Balance Before Withdrawal', sumActualBalanceBeforeWithdrawal],
    ['Total College Amount', sumCollegeAmount],
    ['Total Student Amount', sumStudentAmount],
  ];
  aoaToSheet(wb, summaryRows, 'Summary');

  await writeFile(wb, `Scholarship_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
