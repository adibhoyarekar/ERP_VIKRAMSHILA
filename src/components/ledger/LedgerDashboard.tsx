import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { logError, toUserMessage } from '../../utils/errorHandler';
import { validateFile, ALLOWED_FILE_TYPES } from '../../utils/fileValidator';
import { LedgerEntry } from '../../types/ledger';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Download, FileText, Calendar, Filter, X, Eye, FileDown, CheckCircle2, Pencil, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { bookNew, jsonToSheet, writeFile as xlsxWriteFile } from '../../utils/xlsxWriter';
import { openFileUrl } from '../../utils/fileViewer';
import { formatDateDDMMYYYY } from '../../utils/dateFilters';
import DocumentViewerModal, { DocumentPreviewItem } from '../DocumentViewerModal';
import Loader from '../Loader';

interface Props {
  records: LedgerEntry[];
  setRecords: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  readOnly: boolean;
  currentUserRole?: string;
  currentUserId?: string;
}

export default function LedgerDashboard({ records, setRecords, readOnly, currentUserRole, currentUserId }: Props) {
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete State
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entriesToDelete, setEntriesToDelete] = useState<LedgerEntry[]>([]);

  // Add Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Net Banking' | 'Cheque'>('Cash');
  const [chequeNo, setChequeNo] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Edit Form State
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<'Cash' | 'UPI' | 'Net Banking' | 'Cheque'>('Cash');
  const [editChequeNo, setEditChequeNo] = useState('');
  const [editProofFile, setEditProofFile] = useState<File | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const d = new Date(r.date);
      if (monthFilter !== 'All' && d.getMonth().toString() !== monthFilter) return false;
      if (yearFilter !== 'All' && d.getFullYear().toString() !== yearFilter) return false;
      if (paymentModeFilter !== 'All' && r.paymentMode !== paymentModeFilter) return false;

      if (filterType === 'all') return true;
      const recordDate = d.getTime();
      const now = new Date();
      if (filterType === 'daily') {
        return new Date(r.date).toDateString() === now.toDateString();
      } else if (filterType === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
        return recordDate >= weekAgo;
      } else if (filterType === 'monthly') {
        return new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear();
      } else if (filterType === 'custom') {
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Infinity;
        return recordDate >= start && recordDate <= end;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, filterType, startDate, endDate, monthFilter, yearFilter, paymentModeFilter]);

  const totalAmount = useMemo(() => {
    return filteredRecords.reduce((sum, record) => sum + record.amount, 0);
  }, [filteredRecords]);

  const triggerSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2200);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedEntryIds(filteredRecords.map(r => r.id));
    } else {
      setSelectedEntryIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedEntryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const confirmDeleteSingle = (entry: LedgerEntry) => {
    setEntriesToDelete([entry]);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMultiple = () => {
    const toDelete = records.filter(r => selectedEntryIds.includes(r.id));
    setEntriesToDelete(toDelete);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const filesToDelete = entriesToDelete
        .filter(e => e.proofUrl)
        .map(e => {
          const parts = e.proofUrl!.split('/');
          return parts[parts.length - 1];
        });
      
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('ledger_proofs').remove(filesToDelete);
        if (storageError) console.error("Error deleting storage files:", storageError);
      }

      const idsToDelete = entriesToDelete.map(e => e.id);
      const { error: dbError } = await supabase.from('ledger_entries').delete().in('id', idsToDelete);
      if (dbError) throw dbError;

      setRecords(prev => prev.filter(r => !idsToDelete.includes(r.id)));
      setSelectedEntryIds([]);
      setEntriesToDelete([]);
      setIsDeleteModalOpen(false);
      triggerSuccess('Entries Deleted Successfully!');
    } catch (err: any) {
      logError('delete ledger entries', err);
      alert(toUserMessage('delete entries'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setIsLoading(true);
    let proofUrl = '';

    try {
      if (proofFile) {
        const ext = proofFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('ledger_proofs')
          .upload(fileName, proofFile);
        if (uploadError) throw uploadError;
        const { data: signData } = await supabase.storage.from('ledger_proofs').createSignedUrl(fileName, 86400 * 365);
        proofUrl = signData?.signedUrl || fileName;
      }

      const newEntry = {
        date,
        description,
        amount: Number(amount),
        payment_mode: paymentMode,
        cheque_no: paymentMode === 'Cheque' ? chequeNo : null,
        proof_url: proofUrl || null,
        created_by: currentUserId || null
      };

      const { data, error } = await supabase
        .from('ledger_entries')
        .insert([newEntry])
        .select()
        .single();

      if (error) throw error;

      const formattedEntry: LedgerEntry = {
        id: data.id,
        date: data.date,
        description: data.description,
        amount: Number(data.amount),
        paymentMode: data.payment_mode,
        chequeNo: data.cheque_no,
        proofUrl: data.proof_url,
        createdBy: data.created_by,
        createdAt: data.created_at
      };

      setRecords(prev => [formattedEntry, ...prev]);

      // Reset form and close modal
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setAmount('');
      setPaymentMode('Cash');
      setChequeNo('');
      setProofFile(null);
      setIsAddModalOpen(false);

      // Show success animation
      triggerSuccess('Entry Saved Successfully!');

    } catch (err: any) {
      logError('add ledger entry', err);
      alert(toUserMessage('save entry'));
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (entry: LedgerEntry) => {
    setEditEntry(entry);
    setEditDate(entry.date);
    setEditDescription(entry.description);
    setEditAmount(String(entry.amount));
    setEditPaymentMode(entry.paymentMode as any);
    setEditChequeNo(entry.chequeNo || '');
    setEditProofFile(null);
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry || readOnly) return;
    setIsLoading(true);

    try {
      let proofUrl = editEntry.proofUrl || null;

      // If a new proof file is selected, upload it and replace the old one
      if (editProofFile) {
        const ext = editProofFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('ledger_proofs')
          .upload(fileName, editProofFile);
        if (uploadError) throw uploadError;
        const { data: signData } = await supabase.storage.from('ledger_proofs').createSignedUrl(fileName, 86400 * 365);
        proofUrl = signData?.signedUrl || fileName;
      }

      const updatedFields = {
        date: editDate,
        description: editDescription,
        amount: Number(editAmount),
        payment_mode: editPaymentMode,
        cheque_no: editPaymentMode === 'Cheque' ? editChequeNo : null,
        proof_url: proofUrl,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('ledger_entries')
        .update(updatedFields)
        .eq('id', editEntry.id)
        .select()
        .single();

      if (error) throw error;

      const updatedEntry: LedgerEntry = {
        id: data.id,
        date: data.date,
        description: data.description,
        amount: Number(data.amount),
        paymentMode: data.payment_mode,
        chequeNo: data.cheque_no,
        proofUrl: data.proof_url,
        createdBy: data.created_by,
        createdAt: data.created_at
      };

      setRecords(prev => prev.map(r => r.id === updatedEntry.id ? updatedEntry : r));
      setEditEntry(null);
      setEditProofFile(null);

      // Show success animation
      triggerSuccess('Entry Updated Successfully!');

    } catch (err: any) {
      logError('update ledger entry', err);
      alert(toUserMessage('update entry'));
    } finally {
      setIsLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('Vikramshila College ERP - Ledger Entries', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${formatDateDDMMYYYY(new Date())}`, 14, 25);

    const monthsNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let filterText = 'Preset: ' + (filterType.charAt(0).toUpperCase() + filterType.slice(1));
    if (filterType === 'custom' && startDate && endDate) {
      filterText = `Date Range: ${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
    }
    if (monthFilter !== 'All') filterText += ` | Month: ${monthsNames[parseInt(monthFilter)]}`;
    if (yearFilter !== 'All') filterText += ` | Year: ${yearFilter}`;
    if (paymentModeFilter !== 'All') filterText += ` | Mode: ${paymentModeFilter}`;

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(filterText, 14, 31);

    // Sort entries chronologically from low date to high date (ascending: oldest to newest) according to active filters
    const sortedForExport = [...filteredRecords].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const tableData = sortedForExport.map(r => [
      formatDateDDMMYYYY(r.date),
      r.description,
      `Rs. ${r.amount.toLocaleString('en-IN')}`,
      r.paymentMode,
      r.chequeNo || 'N/A'
    ]);
    tableData.push(['', 'TOTAL AMOUNT', `Rs. ${totalAmount.toLocaleString('en-IN')}`, '', '']);

    autoTable(doc, {
      startY: 36,
      head: [['Date', 'Description', 'Amount', 'Payment Mode', 'Cheque No']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 3,
        lineWidth: 0.1,
        lineColor: [203, 213, 225],
        textColor: [30, 41, 59]
      },
      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        fillColor: [2, 132, 199], // Sky Blue theme for Ledger
        textColor: [255, 255, 255],
        lineWidth: 0.15,
        lineColor: [255, 255, 255], // Vertical/horizontal column divider lines in head
        fontSize: 9
      },
      didParseCell: function (data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.font = 'helvetica';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });
    const modeSuffix = paymentModeFilter !== 'All' ? `_${paymentModeFilter.replace(/\s+/g, '_')}` : '';
    doc.save(`Ledger_Entries${modeSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportExcel = async () => {
    // Sort entries chronologically from low date to high date (ascending: oldest to newest)
    const sortedForExport = [...filteredRecords].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const dataToExport = sortedForExport.map(r => ({
      Date: formatDateDDMMYYYY(r.date),
      Description: r.description,
      Amount: r.amount,
      'Payment Mode': r.paymentMode,
      'Cheque No': r.chequeNo || 'N/A',
      'Proof URL': r.proofUrl || 'N/A',
    }));
    dataToExport.push({ Date: '', Description: 'TOTAL AMOUNT', Amount: totalAmount, 'Payment Mode': '', 'Cheque No': '', 'Proof URL': '' });
    const wb = bookNew();
    jsonToSheet(wb, dataToExport, 'Ledger Entries');
    const modeSuffix = paymentModeFilter !== 'All' ? `_${paymentModeFilter.replace(/\s+/g, '_')}` : '';
    await xlsxWriteFile(wb, `Ledger_Entries${modeSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <Loader show={isLoading} fullScreen={false} />

      {/* Save/Action Success Animation */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-6 right-6 z-[100] flex items-center gap-3 bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <CheckCircle size={24} />
            </motion.div>
            <div>
              <p className="font-bold text-sm">{successToast}</p>
              <p className="text-emerald-100 text-xs">The ledger has been updated and synced.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header and Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ledger Entries</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and track day-to-day financial transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {selectedEntryIds.length > 0 && !readOnly && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={confirmDeleteMultiple} 
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm ml-auto md:ml-0 cursor-pointer"
            >
              <Trash2 size={16} /> Delete Selected ({selectedEntryIds.length})
            </motion.button>
          )}
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors ml-auto md:ml-0 cursor-pointer" title="Export filtered records to PDF">
            <FileText size={16} /> PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer" title="Export filtered records to Excel">
            <Download size={16} /> Excel
          </button>
          {!readOnly && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={18} /> New Entry
            </button>
          )}
        </div>
      </div>

      {/* Filters & Total */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mr-1">
            <Filter size={16} className="text-sky-600" />
            <span>Filters:</span>
          </div>

          {/* Preset Date Filter */}
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer">
            <option value="all">All Presets</option>
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Month Filter */}
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer">
            <option value="All">All Months</option>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={m} value={String(i)}>{m}</option>
            ))}
          </select>

          {/* Year Filter */}
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer">
            <option value="All">All Years</option>
            {[2023,2024,2025,2026,2027,2028,2029,2030].map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>

          {/* Payment Mode Filter */}
          <select value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer">
            <option value="All">All Modes of Payment</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Cheque">Cheque</option>
          </select>

          {/* Custom Date Range */}
          <AnimatePresence>
            {filterType === 'custom' && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-2 overflow-hidden">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500" />
                <span className="text-slate-400 text-xs font-semibold">to</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clear Filters Button */}
          {(filterType !== 'all' || monthFilter !== 'All' || yearFilter !== 'All' || paymentModeFilter !== 'All' || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                setMonthFilter('All');
                setYearFilter('All');
                setPaymentModeFilter('All');
                setStartDate('');
                setEndDate('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer sm:ml-auto"
              title="Reset all filters"
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>

        {/* Total Stats Card */}
        <div className="bg-slate-900 p-4 rounded-xl shadow-sm flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-white opacity-5 rounded-full"></div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total (Filtered)</p>
            {paymentModeFilter !== 'All' && (
              <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.5 rounded">
                {paymentModeFilter}
              </span>
            )}
          </div>
          <p className="text-xl font-black text-emerald-400">₹{totalAmount.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{filteredRecords.length} {filteredRecords.length === 1 ? 'entry' : 'entries'}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {!readOnly && (
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={filteredRecords.length > 0 && selectedEntryIds.length === filteredRecords.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Proof</th>
                {!readOnly && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  {!readOnly && (
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedEntryIds.includes(record.id)}
                        onChange={() => handleSelectRow(record.id)}
                        className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate" title={record.description}>
                    {record.description}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 whitespace-nowrap">
                    ₹{record.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`inline-flex w-max items-center px-2 py-0.5 rounded text-xs font-bold ${
                        record.paymentMode === 'Cheque' ? 'bg-amber-100 text-amber-700' :
                        record.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {record.paymentMode}
                      </span>
                      {record.paymentMode === 'Cheque' && record.chequeNo && (
                        <span className="text-xs text-slate-500 mt-1">No: {record.chequeNo}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {record.proofUrl ? (
                      <button 
                        type="button"
                        onClick={() => setPreviewDoc({ title: record.particulars || 'Ledger Proof', url: record.proofUrl!, bucket: 'ledger_documents' })} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded transition-colors cursor-pointer shadow-2xs"
                        title="View Attachment"
                      >
                        <Eye size={12} /> View
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No proof</span>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(record)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded transition-colors"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => confirmDeleteSingle(record)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 5 : 7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileText size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-medium">No records found for the selected filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isAddModalOpen && !readOnly && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900 text-lg">Add New Ledger Entry</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddEntry} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                    <input type="number" required min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1500" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entry Description *</label>
                  <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details about this entry..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none"></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode *</label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  {paymentMode === 'Cheque' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cheque No. *</label>
                      <input type="text" required value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="Cheque number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Payment Proof (Optional)</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="space-y-1 text-center">
                      <FileDown className="mx-auto h-8 w-8 text-slate-400" />
                      <div className="flex text-sm text-slate-600 justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-sky-600 hover:text-sky-500 focus-within:outline-none px-1">
                          <span>Upload a file</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                              if (errorMsg) {
                                alert(errorMsg);
                                e.target.value = '';
                                return;
                              }
                              setProofFile(file);
                            } else {
                              setProofFile(null);
                            }
                          }} />
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">PNG, JPG, PDF up to 5MB</p>
                      {proofFile && (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> {proofFile.name}</p>
                          <button 
                            type="button" 
                            onClick={() => setPreviewDoc({ title: proofFile.name, url: URL.createObjectURL(proofFile), bucket: 'ledger_documents' })} 
                            className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                            title="View selected file"
                          >
                            <Eye size={12} /> View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                    {isLoading ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Edit Entry Modal */}
      <AnimatePresence>
        {editEntry && !readOnly && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Edit Ledger Entry</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Changes will be synced to the database.</p>
                </div>
                <button onClick={() => setEditEntry(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleEditEntry} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                    <input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                    <input type="number" required min="0" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entry Description *</label>
                  <textarea required rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none"></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode *</label>
                    <select value={editPaymentMode} onChange={(e) => setEditPaymentMode(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  {editPaymentMode === 'Cheque' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cheque No. *</label>
                      <input type="text" required value={editChequeNo} onChange={(e) => setEditChequeNo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editEntry.proofUrl ? 'Replace Proof (Optional)' : 'Upload Proof (Optional)'}
                  </label>
                  {editEntry.proofUrl && !editProofFile && (
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">Current proof on file</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setPreviewDoc({ title: editEntry.particulars || 'Current Proof', url: editEntry.proofUrl!, bucket: 'ledger_documents' })} 
                        className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs shrink-0"
                      >
                        <Eye size={12} /> View
                      </button>
                    </div>
                  )}
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="space-y-1 text-center">
                      <FileDown className="mx-auto h-8 w-8 text-slate-400" />
                      <div className="flex text-sm text-slate-600 justify-center">
                        <label htmlFor="edit-file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-sky-600 hover:text-sky-500 px-1">
                          <span>{editProofFile ? 'Change file' : 'Upload new file'}</span>
                          <input id="edit-file-upload" type="file" className="sr-only" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                              if (errorMsg) {
                                alert(errorMsg);
                                e.target.value = '';
                                return;
                              }
                              setEditProofFile(file);
                            } else {
                              setEditProofFile(null);
                            }
                          }} />
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">PNG, JPG, PDF up to 5MB</p>
                      {editProofFile && (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> {editProofFile.name}</p>
                          <button 
                            type="button" 
                            onClick={() => setPreviewDoc({ title: editProofFile.name, url: URL.createObjectURL(editProofFile), bucket: 'ledger_documents' })} 
                            className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                            title="View selected file"
                          >
                            <Eye size={12} /> View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setEditEntry(null)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                    <Pencil size={15} />
                    {isLoading ? 'Updating...' : 'Update Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && !readOnly && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="font-bold text-slate-900 text-xl mb-2">Delete {entriesToDelete.length > 1 ? 'Entries' : 'Entry'}?</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Are you sure you want to delete {entriesToDelete.length > 1 ? `${entriesToDelete.length} entries` : 'this entry'}? This action is <span className="font-bold text-rose-600">irreversible</span> and will permanently remove the data and associated payment proofs.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-1">
                    Cancel
                  </button>
                  <button type="button" onClick={handleDelete} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex-1 flex justify-center items-center gap-2">
                    {isLoading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
