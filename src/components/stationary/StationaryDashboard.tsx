import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { logError, toUserMessage } from '../../utils/errorHandler';
import { validateFile, ALLOWED_FILE_TYPES } from '../../utils/fileValidator';
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, FileText, Edit2, Upload, Eye, X, Check, FileDown, IndianRupee, PieChart, Filter, Download } from 'lucide-react';
import { StationaryRecord, PaymentStatus, TransactionMode, StationaryPayment } from '../../types/stationary';
import { getDateRangeForPreset, formatDateDDMMYYYY } from '../../utils/dateFilters';
import { exportStationaryToExcel } from '../../utils/exportExcel';
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
    const name = clean.split('/').pop() || clean;
    return name;
  } catch (e) {
    return (url || '').split('?')[0].split('/').pop() || fallbackTitle || url;
  }
}

export const handleDownloadBill = async (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  await forceDownloadFile(url, undefined, 'stationary_documents');
};

export const handleViewBill = (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  openFileUrl(url, 'stationary_documents');
};

function RecordModal({ 
  record, 
  onClose, 
  onSave, 
  canEdit = true, 
  currentUserRole, 
  showSuccessAnimation = false, 
  savedRecordName = '',
  isSaving = false,
  onPreviewDoc 
}: { 
  record: StationaryRecord | null;
  onClose: () => void;
  onSave: (r: StationaryRecord) => void;
  canEdit?: boolean;
  currentUserRole?: string;
  showSuccessAnimation?: boolean;
  savedRecordName?: string;
  isSaving?: boolean;
  onPreviewDoc?: (doc: DocumentPreviewItem) => void;
}) {
  const isNewRecord = !record;
  const [formData, setFormData] = useState<Partial<StationaryRecord>>(
    record || {
      id: `st${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      vendorName: '',
      objectName: '',
      unit: 1,
      price: 0,
      amountPaid: 0,
      balance: 0,
      paymentStatus: 'Pending',
      payments: [],
      remarks: ''
    }
  );
  
  // States for initial payment flow
  const [madePayment, setMadePayment] = useState<boolean>(!isNewRecord && (formData.payments?.length || 0) > 0);
  const [paymentType, setPaymentType] = useState<'Full' | 'Partial'>('Full');
  
  const [newPayment, setNewPayment] = useState<Partial<StationaryPayment>>({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    mode: 'Cash',
    remarks: '',
    billUrl: ''
  });
  
  const [billFile, setBillFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [showAddSubsequentPayment, setShowAddSubsequentPayment] = useState(false);

  const triggerLocalFilePreview = (file: File) => {
    if (!file) return;
    const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif|avif)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (onPreviewDoc) {
      onPreviewDoc({
        title: file.name,
        url: URL.createObjectURL(file),
        bucket: 'stationary_documents',
        fileType: isImg ? 'image' : isPdf ? 'pdf' : undefined,
        mimeType: file.type,
      });
    } else {
      previewLocalFile(file);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = Number(e.target.value);
    setFormData({ ...formData, price: newPrice });
    
    // Automatically update full payment amount if they selected full payment
    if (isNewRecord && madePayment && paymentType === 'Full') {
      setNewPayment({ ...newPayment, amount: newPrice });
    }
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || showSuccessAnimation) return;
    setError('');
    
    if (!formData.vendorName) { setError('Vendor Name is required.'); return; }
    if (!formData.objectName) { setError('Item Name is required.'); return; }
    if ((formData.unit || 0) <= 0) { setError('Unit is required and must be greater than zero.'); return; }
    if ((formData.price || 0) <= 0) { setError('Total Price is required and must be greater than zero.'); return; }
    if (!formData.date) { setError('Date is required.'); return; }

    const price = formData.price || 0;
    let finalPayments = formData.payments || [];
    let currentTotalPaid = finalPayments.reduce((sum, p) => sum + p.amount, 0);

    // If it's a new record and they chose to make a payment right now
    if (isNewRecord && madePayment && finalPayments.length === 0) {
      if (!newPayment.amount || newPayment.amount <= 0) {
        setError("Please enter a valid payment amount."); return;
      }
      if (newPayment.amount > price) {
        setError(`Payment amount (${newPayment.amount}) exceeds total price (${price}).`); return;
      }
      if (newPayment.mode === 'Cheque') {
        if (!newPayment.referenceNo || newPayment.referenceNo.trim() === '') {
          setError("Cheque number (Reference No) is mandatory for cheque payments."); return;
        }
      } else {
        if (!billFile && !newPayment.billUrl) {
          setError("Bill upload (screenshot, pdf, or image) is mandatory when recording a payment."); return;
        }
      }
      
      const payment: StationaryPayment & { file?: File } = {
        id: `p${Date.now()}`,
        date: newPayment.date || formData.date || '',
        amount: newPayment.amount,
        mode: newPayment.mode as TransactionMode || 'Cash',
        referenceNo: newPayment.referenceNo,
        billUrl: billFile ? billFile.name : newPayment.billUrl,
        file: billFile || undefined
      };
      finalPayments = [payment];
      currentTotalPaid = payment.amount;
    }

    const balance = Math.max(0, price - currentTotalPaid);
    let status: PaymentStatus = 'Pending';
    if (currentTotalPaid >= price && price > 0) status = 'Paid';
    else if (currentTotalPaid > 0 && currentTotalPaid < price) status = 'Partial';
    else if (currentTotalPaid === 0) status = 'Pending';

    onSave({
      ...formData,
      payments: finalPayments,
      amountPaid: currentTotalPaid,
      balance: balance,
      paymentStatus: status,
      ...(isNewRecord && currentUserRole ? { createdByRole: currentUserRole } : {})
    } as StationaryRecord);
  };

  const handleAddSubsequentPayment = () => {
    setError('');
    if (!newPayment.amount || newPayment.amount <= 0) {
      setError("Please enter a valid payment amount."); return;
    }
    const price = formData.price || 0;
    const currentTotalPaid = (formData.payments || []).reduce((sum, p) => sum + p.amount, 0);
    
    if (currentTotalPaid + newPayment.amount > price) {
      setError(`Payment amount exceeds remaining balance (₹${price - currentTotalPaid}).`); return;
    }
    
    if (newPayment.mode === 'Cheque') {
      if (!newPayment.referenceNo || newPayment.referenceNo.trim() === '') {
        setError("Cheque number (Reference No) is mandatory for cheque payments."); return;
      }
    } else {
      if (!billFile && !newPayment.billUrl) {
        setError("Bill upload is mandatory for new payments."); return;
      }
    }
    
    const payment: StationaryPayment & { file?: File } = {
      id: `p${Date.now()}`,
      date: newPayment.date || new Date().toISOString().split('T')[0],
      amount: newPayment.amount,
      mode: newPayment.mode as TransactionMode || 'Cash',
      referenceNo: newPayment.referenceNo,
      billUrl: billFile ? billFile.name : newPayment.billUrl,
      file: billFile || undefined
    };
    
    const updatedPayments = [...(formData.payments || []), payment];
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newBalance = Math.max(0, price - newTotalPaid);
    
    let status: PaymentStatus = 'Pending';
    if (newTotalPaid >= price && price > 0) status = 'Paid';
    else if (newTotalPaid > 0 && newTotalPaid < price) status = 'Partial';
    
    setFormData({
      ...formData,
      payments: updatedPayments,
      amountPaid: newTotalPaid,
      balance: newBalance,
      paymentStatus: status
    });
    
    setShowAddSubsequentPayment(false);
    setNewPayment({ amount: 0, date: new Date().toISOString().split('T')[0], mode: 'Cash', remarks: '', billUrl: '' });
    setBillFile(null);
  };

  const hasExistingPayments = !isNewRecord && (formData.payments?.length || 0) > 0;
  const currentTotalPaid = (formData.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const currentBalance = Math.max(0, (formData.price || 0) - currentTotalPaid);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">{isNewRecord ? 'New Purchase Record' : 'Edit Purchase Record'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Record stationary expense and attached payment bills</p>
          </div>
          <button 
            type="button"
            onClick={() => { if (!showSuccessAnimation && !isSaving) onClose(); }} 
            disabled={showSuccessAnimation || isSaving}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>
        
        {showSuccessAnimation ? (
          <div className="flex-1 p-6 bg-slate-50/50 flex items-center justify-center min-h-[420px]">
            <SuccessAnimation
              title="Record Saved!"
              message={<><span className="font-bold text-emerald-600">{savedRecordName}</span> recorded successfully.</>}
              subMessage="Updating stationary and expenses database…"
              color="emerald"
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <form id="record-form" onSubmit={handleSaveRecord} className="space-y-5">
                {error && (
                  <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 flex items-center gap-2 font-semibold">
                    <span className="font-bold">Error:</span> {error}
                  </div>
                )}
                
                <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                    <FileText size={18} className="text-sky-600" /> Purchase Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Date <span className="text-rose-500">*</span></label>
                      <input type="date" disabled={!canEdit || isSaving} value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Name <span className="text-rose-500">*</span></label>
                      <input type="text" disabled={!canEdit || isSaving} placeholder="e.g. Global Stationary" value={formData.vendorName || ''} onChange={e => setFormData({...formData, vendorName: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Item Name <span className="text-rose-500">*</span></label>
                      <input type="text" disabled={!canEdit || isSaving} placeholder="e.g. A4 Paper Rims" value={formData.objectName || ''} onChange={e => setFormData({...formData, objectName: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Unit (Qty) <span className="text-rose-500">*</span></label>
                      <input type="number" disabled={!canEdit || isSaving} min="1" value={formData.unit || ''} onChange={e => setFormData({...formData, unit: Number(e.target.value)})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Total Price (₹) <span className="text-rose-500">*</span></label>
                      <input type="number" disabled={!canEdit || isSaving} min="0" value={formData.price || ''} onChange={handlePriceChange} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-bold text-slate-900" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Remark (Optional)</label>
                      <input type="text" disabled={!canEdit || isSaving} placeholder="Any additional notes" value={formData.remarks || ''} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium" />
                    </div>
                  </div>
                </div>

                {/* Payment Flow for NEW records or records with no payments yet */}
                {(!hasExistingPayments && canEdit) && (
                  <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                      <IndianRupee size={18} className="text-emerald-600" /> Payment & Bill Details
                    </h4>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-slate-700">Did you make a payment?</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { 
                          setMadePayment(true); 
                          if (paymentType === 'Full') {
                            setNewPayment(prev => ({...prev, amount: formData.price || 0}));
                          }
                        }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${madePayment ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500' : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'}`}>Yes</button>
                        <button type="button" onClick={() => { setMadePayment(false); setNewPayment({amount: 0, date: formData.date, mode: 'Cash'}); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${!madePayment ? 'bg-slate-800 text-white border-2 border-slate-800' : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'}`}>No</button>
                      </div>
                    </div>

                    {madePayment && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-700">Payment Type:</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setPaymentType('Full'); setNewPayment({...newPayment, amount: formData.price || 0}); }} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${paymentType === 'Full' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Full Payment</button>
                            <button type="button" onClick={() => { setPaymentType('Partial'); setNewPayment({...newPayment, amount: 0}); }} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${paymentType === 'Partial' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Partial Payment</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {paymentType === 'Partial' && (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">First Payment (₹)</label>
                              <input type="number" min="1" max={(formData.price || 1) - 1} value={newPayment.amount || ''} onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} className="w-full px-3.5 py-2 border border-amber-300 bg-amber-50 rounded-lg text-amber-900 font-bold text-sm focus:ring-2 focus:ring-amber-500/50" required />
                            </div>
                          )}
                          {paymentType === 'Full' && (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹)</label>
                              <input type="number" value={newPayment.amount || ''} readOnly className="w-full px-3.5 py-2 border border-emerald-300 bg-emerald-50 rounded-lg font-bold text-emerald-800 text-sm cursor-not-allowed" />
                            </div>
                          )}
                          
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                            <input type="date" value={newPayment.date || ''} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-medium" required />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Mode</label>
                            <select value={newPayment.mode} onChange={e => setNewPayment({...newPayment, mode: e.target.value as TransactionMode})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-medium cursor-pointer">
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          </div>

                          {newPayment.mode === 'Cheque' && (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Cheque No. <span className="text-rose-500">*</span></label>
                              <input type="text" value={newPayment.referenceNo || ''} onChange={e => setNewPayment({...newPayment, referenceNo: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-medium" placeholder="Enter cheque number" required />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Upload Bill <span className="text-[10px] font-normal text-slate-500">(Max 5MB)</span> {newPayment.mode !== 'Cheque' && <span className="text-rose-500">*</span>}</label>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 cursor-pointer rounded-lg text-sm transition-all text-slate-700 flex-1 overflow-hidden">
                                <Upload size={16} className="shrink-0 text-slate-400" /> 
                                <span className="truncate font-medium text-xs">{billFile ? billFile.name : (newPayment.billUrl ? getFileName(newPayment.billUrl, 'Attached Bill') : 'Screenshot/PDF/Doc')}</span>
                                <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                                    if (errorMsg) {
                                      alert(errorMsg);
                                      e.target.value = '';
                                      return;
                                    }
                                    setBillFile(file);
                                  }
                                }} />
                              </label>
                              {billFile && (
                                <button 
                                  type="button" 
                                  onClick={() => triggerLocalFilePreview(billFile)} 
                                  className="shrink-0 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                                  title="View / Preview selected file"
                                >
                                  <Eye size={12} /> View
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {paymentType === 'Partial' && (
                          <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs">
                            <span className="text-xs font-bold text-slate-600">Remaining Balance:</span>
                            <span className="text-base font-extrabold text-rose-600">₹{Math.max(0, (formData.price || 0) - (newPayment.amount || 0)).toLocaleString()}</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Existing Payments List (for records that already have payments) */}
                {hasExistingPayments && (
                  <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                        <IndianRupee size={18} className="text-emerald-600" /> Payment History
                      </h4>
                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Paid</p>
                          <p className="text-sm font-extrabold text-emerald-600">₹{currentTotalPaid.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining</p>
                          <p className="text-sm font-extrabold text-rose-600">₹{currentBalance.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {formData.payments?.map((p, index) => {
                        const bill = p.billUrl || (p as any).bill_url;
                        const localFile = (p as any).file;
                        const hasBill = Boolean(localFile || bill);
                        const fileNameDisplay = localFile ? localFile.name : getFileName(bill, `Receipt #${p.receiptNo || index + 1}`);

                        return (
                          <div key={p.id || index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 shadow-2xs">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-base">₹{p.amount.toLocaleString()}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{p.date} &bull; {p.mode} {p.mode === 'Cheque' && p.referenceNo ? `(Cheque: ${p.referenceNo})` : ''}</p>
                              </div>
                            </div>
                            <div>
                              {hasBill ? (
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                  <span className="text-xs font-bold text-slate-700 max-w-[140px] truncate" title={fileNameDisplay}>{fileNameDisplay}</span>
                                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                                    <button 
                                      type="button" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (localFile) {
                                          triggerLocalFilePreview(localFile);
                                        } else if (bill) {
                                          onPreviewDoc ? onPreviewDoc({ title: fileNameDisplay, url: bill, bucket: 'stationary_documents' }) : handleViewBill(e, bill);
                                        }
                                      }} 
                                      className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                                      title={localFile ? 'Preview (not yet saved)' : 'View Bill'}
                                    >
                                      <Eye size={12}/> View
                                    </button>
                                    {!localFile && bill && (
                                      <button type="button" onClick={(e) => handleDownloadBill(e, bill)} className="text-slate-500 hover:text-emerald-600 p-1 cursor-pointer" title="Download Bill">
                                        <FileDown size={16}/>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-slate-400 italic bg-white px-3 py-1 rounded-lg border border-slate-200">No bill attached</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {currentBalance > 0 && canEdit && !showAddSubsequentPayment && (
                      <button type="button" onClick={() => setShowAddSubsequentPayment(true)} className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:border-sky-400 hover:text-sky-700 hover:bg-sky-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <Plus size={16} /> Add Subsequent Payment
                      </button>
                    )}

                    {showAddSubsequentPayment && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 bg-sky-50 p-4 sm:p-5 rounded-xl border border-sky-200">
                        <h5 className="font-bold text-sky-950 mb-3 flex items-center justify-between text-sm">
                          Record Partial Payment
                          <span className="text-xs font-bold text-sky-800">Remaining Balance: ₹{currentBalance.toLocaleString()}</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-bold text-sky-900 mb-1">Amount Paid (₹)</label>
                            <input type="number" max={currentBalance} value={newPayment.amount || ''} onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} className="w-full px-3 py-2 border border-sky-200 bg-white rounded-lg text-sm font-bold text-sky-950" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-sky-900 mb-1">Date</label>
                            <input type="date" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="w-full px-3 py-2 border border-sky-200 bg-white rounded-lg text-sm font-medium" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-sky-900 mb-1">Mode</label>
                            <select value={newPayment.mode} onChange={e => setNewPayment({...newPayment, mode: e.target.value as TransactionMode})} className="w-full px-3 py-2 border border-sky-200 bg-white rounded-lg text-sm font-medium cursor-pointer">
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          </div>
                          
                          {newPayment.mode === 'Cheque' && (
                            <div>
                              <label className="block text-xs font-bold text-sky-900 mb-1">Cheque No. <span className="text-rose-500">*</span></label>
                              <input type="text" value={newPayment.referenceNo || ''} onChange={e => setNewPayment({...newPayment, referenceNo: e.target.value})} className="w-full px-3 py-2 border border-sky-200 bg-white rounded-lg text-sm font-medium" placeholder="Cheque number" required />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-sky-900 mb-1">Upload Bill <span className="text-[10px] font-normal text-slate-500">(Max 5MB)</span> {newPayment.mode !== 'Cheque' && <span className="text-rose-500">*</span>}</label>
                            <div className="flex items-center gap-1.5">
                              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-sky-200 hover:border-sky-400 cursor-pointer rounded-lg text-xs transition-all text-slate-700 flex-1 overflow-hidden">
                                <Upload size={14} className="shrink-0 text-sky-600" /> 
                                <span className="truncate font-medium">{billFile ? billFile.name : 'Screenshot/PDF/Doc'}</span>
                                <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                      const file = e.target.files[0];
                                      const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
                                      if (errorMsg) {
                                        alert(errorMsg);
                                        e.target.value = '';
                                        return;
                                      }
                                      setBillFile(file);
                                  }
                                }} />
                              </label>
                              {billFile && (
                                <button 
                                  type="button" 
                                  onClick={() => triggerLocalFilePreview(billFile)} 
                                  className="shrink-0 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs" 
                                  title="View / Preview selected file"
                                >
                                  <Eye size={12} /> View
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setShowAddSubsequentPayment(false); setError(''); }} className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer">Cancel</button>
                          <button type="button" onClick={handleAddSubsequentPayment} className="px-4 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 shadow-xs cursor-pointer">Save Partial Payment</button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </form>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSaving}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              {canEdit && (
                <button 
                  type="submit" 
                  form="record-form" 
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <span>Save Record</span>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

interface Props {
  records: StationaryRecord[];
  setRecords?: React.Dispatch<React.SetStateAction<StationaryRecord[]>>;
  readOnly?: boolean;
  currentUserRole?: string;
}

export default function StationaryDashboard({ records, setRecords, readOnly = false, currentUserRole }: Props) {
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [datePreset, setDatePreset] = useState('custom');
  const [monthFilter, setMonthFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [dateRange, setDateRange] = useState({from: '', to: ''});
  
  useEffect(() => {
    if (datePreset !== 'custom') {
      setDateRange(getDateRangeForPreset(datePreset));
    }
  }, [datePreset]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StationaryRecord | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [savedRecordName, setSavedRecordName] = useState('');
  
  const vendors = Array.from(new Set(records.map(r => r.vendorName))).sort();
  
  const filteredRecords = records.filter(record => {
    const d = new Date(record.date);
    if (monthFilter !== 'All' && d.getMonth().toString() !== monthFilter) return false;
    if (yearFilter !== 'All' && d.getFullYear().toString() !== yearFilter) return false;

    const matchesVendor = !vendorFilter || record.vendorName.toLowerCase().includes(vendorFilter.toLowerCase());
    const matchesStatus = statusFilter === 'All' || record.paymentStatus === statusFilter;
    const matchesRole = roleFilter === 'All' || record.createdByRole === roleFilter;
    const matchesDate = (!dateRange.from || record.date >= dateRange.from) && (!dateRange.to || record.date <= dateRange.to);
    return matchesVendor && matchesStatus && matchesRole && matchesDate;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('Vikramshila College ERP - Stationary & Other Expenses', 14, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${formatDateDDMMYYYY(new Date())}`, 14, 25);
    
    const monthsNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let filterText = `Total Items: ${filteredRecords.length}`;
    if (monthFilter !== 'All') filterText += ` | Month: ${monthsNames[parseInt(monthFilter)]}`;
    if (yearFilter !== 'All') filterText += ` | Year: ${yearFilter}`;
    if (statusFilter !== 'All') filterText += ` | Status: ${statusFilter}`;

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(filterText, 14, 31);

    const tableData = filteredRecords.map(r => [
      formatDateDDMMYYYY(r.date),
      r.vendorName,
      r.objectName,
      r.unit.toString(),
      `Rs. ${r.price.toLocaleString('en-IN')}`,
      `Rs. ${r.amountPaid.toLocaleString('en-IN')}`,
      `Rs. ${r.balance.toLocaleString('en-IN')}`,
      r.paymentStatus
    ]);

    const totalSpent = filteredRecords.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalPending = filteredRecords.reduce((sum, r) => sum + r.balance, 0);

    tableData.push([
      '', 'TOTAL', '', '',
      `Rs. ${filteredRecords.reduce((sum, r) => sum + r.price, 0).toLocaleString('en-IN')}`,
      `Rs. ${totalSpent.toLocaleString('en-IN')}`,
      `Rs. ${totalPending.toLocaleString('en-IN')}`,
      ''
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['Date', 'Vendor', 'Item Name', 'Units', 'Total Price', 'Amount Paid', 'Balance', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.5,
        lineWidth: 0.1,
        lineColor: [203, 213, 225],
        textColor: [30, 41, 59]
      },
      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        fillColor: [5, 150, 105], // Emerald Green theme for Stationary
        textColor: [255, 255, 255],
        lineWidth: 0.15,
        lineColor: [255, 255, 255], // Vertical/horizontal column divider lines in head
        fontSize: 8.5
      },
      didParseCell: function (data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.font = 'helvetica';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`Stationary_Expenses_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSave = async (record: StationaryRecord) => {
    setIsSaving(true);
    setSavedRecordName(record.objectName || record.vendorName || 'Record');
    setShowSuccessAnimation(true);
    
    try {
      let recordId = record.id;
      
      // 1. Save or Update the main record
      if (!editingRecord) {
        // Insert new record
        const { data: newDbRecord, error: insertError } = await supabase
          .from('stationary_records')
          .insert([{
            date: record.date,
            vendor_name: record.vendorName,
            object_name: record.objectName,
            unit: record.unit,
            price: record.price,
            amount_paid: record.amountPaid,
            balance: record.balance,
            payment_status: record.paymentStatus,
            remarks: record.remarks,
            created_by_role: record.createdByRole
          }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        recordId = newDbRecord.id;
        record.id = recordId; // Update local ID
      } else {
        // Update existing record
        const { error: updateError } = await supabase
          .from('stationary_records')
          .update({
            date: record.date,
            vendor_name: record.vendorName,
            object_name: record.objectName,
            unit: record.unit,
            price: record.price,
            amount_paid: record.amountPaid,
            balance: record.balance,
            payment_status: record.paymentStatus,
            remarks: record.remarks,
          })
          .eq('id', recordId);
          
        if (updateError) throw updateError;
      }

      // 2. Process payments (new payments have an ID starting with 'p' or have a local file)
      const processedPayments = await Promise.all((record.payments || []).map(async (p: any) => {
        if (p.id && (p.id.startsWith('p') || p.file)) {
          let finalBillUrl = p.billUrl || p.bill_url || '';
          if (p.file) {
            // Upload to storage
            const fileExt = p.file.name.split('.').pop();
            const fileName = `bill-${recordId}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('stationary_documents')
              .upload(fileName, p.file);
              
            if (uploadError) throw uploadError;
            
            const { data: signData } = await supabase.storage
              .from('stationary_documents')
              .createSignedUrl(fileName, 86400 * 365);
              
            finalBillUrl = signData?.signedUrl || fileName;
          }
            
          // Insert into stationary_payments table
          const { data: newPaymentRow, error: paymentInsertError } = await supabase
            .from('stationary_payments')
            .insert([{
              record_id: recordId,
              date: p.date,
              amount: p.amount,
              mode: p.mode,
              reference_no: p.referenceNo || p.reference_no,
              bill_url: finalBillUrl,
              remarks: p.remarks
            }])
            .select()
            .single();
            
          if (paymentInsertError) throw paymentInsertError;
          
          return {
            ...p,
            id: newPaymentRow.id,
            billUrl: finalBillUrl,
            bill_url: finalBillUrl,
            file: undefined
          };
        }
        return p;
      }));

      // Update the local record with processed payments
      record.payments = processedPayments;

      if (setRecords) {
        if (editingRecord) {
          setRecords(records.map(r => r.id === record.id ? record : r));
        } else {
          setRecords([record, ...records]);
        }
      }

      // Smoothly finish animation and dismiss modal
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setIsModalOpen(false);
        setEditingRecord(null);
        setIsSaving(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }, 2000);
    } catch (err: any) {
      logError('save stationary record', err);
      alert(toUserMessage('save record'));
      setShowSuccessAnimation(false);
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Stationary & Other Expenses</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage stationary inventory, purchases, and record payments with bills</p>
        </div>
        <div className="flex gap-2.5">
          <button 
            type="button"
            onClick={exportPDF}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <FileText size={16} /> PDF
          </button>
          <button 
            type="button"
            onClick={() => exportStationaryToExcel(filteredRecords)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-2xs border border-emerald-200 cursor-pointer"
          >
            <Download size={16} /> Excel
          </button>
          {!readOnly && (
            <button 
              type="button"
              onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus size={16} /> New Record
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by vendor, item, or remark..."
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 bg-slate-50 font-medium"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
              <Filter size={14} /> Filters:
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-slate-50 cursor-pointer text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Fully Paid</option>
              <option value="Partial">Partially Paid</option>
              <option value="Pending">Payment Pending</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-slate-50 cursor-pointer text-slate-700"
            >
              <option value="All">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="accountant">Accountant</option>
              <option value="clerk">Clerk</option>
            </select>

            <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-slate-50 cursor-pointer text-slate-700"
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
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-slate-50 cursor-pointer text-slate-700"
                >
                  <option value="All">All Years</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>

                <select 
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-slate-50 cursor-pointer text-slate-700"
                >
                  <option value="custom">Custom Range</option>
                  <option value="currentMonth">Current Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="currentYear">Current Year</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={dateRange.from} onChange={e => {setDatePreset('custom'); setDateRange({...dateRange, from: e.target.value});}} className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium" title="From Date" />
                  <span className="text-slate-400">-</span>
                  <input type="date" value={dateRange.to} onChange={e => {setDatePreset('custom'); setDateRange({...dateRange, to: e.target.value});}} className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium" title="To Date" />
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">Item Details</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider text-right">Total Bill</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider text-right">Amount Paid</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider text-right">Balance</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-600 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 text-xs font-bold text-slate-600">{record.date}</td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-slate-900">{record.vendorName}</div>
                      {record.remarks && <div className="text-xs text-slate-400 truncate max-w-[150px]">{record.remarks}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-slate-800">{record.objectName}</div>
                      <div className="text-xs font-semibold text-slate-400">Unit: {record.unit}</div>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-slate-900 text-right">₹{record.price.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm font-black text-emerald-600 text-right">₹{record.amountPaid.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm font-black text-rose-600 text-right">₹{record.balance.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        record.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        record.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                        <button 
                          type="button"
                          onClick={() => { setEditingRecord(record); setIsModalOpen(true); }}
                          className="text-slate-700 hover:text-sky-800 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 px-3 py-1.5 rounded-xl transition-all text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Edit2 size={13} className="text-sky-600" />
                          <span>{readOnly ? 'View Details' : 'Manage'}</span>
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm">No stationary records found</p>
                    <p className="text-xs mt-1">Adjust search or filters above</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <RecordModal 
            record={editingRecord} 
            onClose={() => { if (!showSuccessAnimation && !isSaving) { setIsModalOpen(false); setEditingRecord(null); } }} 
            onSave={handleSave} 
            canEdit={!readOnly && !(currentUserRole === 'accountant' && editingRecord?.createdByRole === 'clerk')}
            currentUserRole={currentUserRole}
            showSuccessAnimation={showSuccessAnimation}
            savedRecordName={savedRecordName}
            isSaving={isSaving}
            onPreviewDoc={(doc) => setPreviewDoc(doc)}
          />
        )}
      </AnimatePresence>
      <SuccessToast show={showSuccessToast} />

      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
