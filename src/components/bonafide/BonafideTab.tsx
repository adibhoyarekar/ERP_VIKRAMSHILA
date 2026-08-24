import React, { useState, useEffect, useRef } from 'react';
import { logError, toUserMessage } from '../../utils/errorHandler';
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, FileText, Download, CheckCircle, X, ChevronRight, Check, Eye } from 'lucide-react';
import { Student, User } from '../../data/mockData';
import { BonafideRecord } from '../../types/bonafide';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import SuccessToast from '../SuccessToast';
import { generateBonafidePDF } from '../../utils/pdfGenerator';
import { supabase } from '../../lib/supabase';

// ─── Animated Download Progress Overlay ───────────────────────────────────────
function DownloadProgressOverlay({ progress, label }: { progress: number; label: string }) {
  return (
    <AnimatePresence>
      <motion.div
        key="download-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center"
        style={{ background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(6px)' }}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5"
        >
          {/* Spinning ring icon */}
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="5" />
              <motion.circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - progress / 100) }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black text-slate-800">{Math.round(progress)}%</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-base font-bold text-slate-900 mb-0.5">
              {progress < 100 ? 'Generating Certificate…' : 'Almost done!'}
            </p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #38bdf8, #0ea5e9, #0284c7)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <p className="text-[11px] text-slate-400">
            {progress < 40 ? 'Preparing document…' : progress < 75 ? 'Rendering layout…' : progress < 100 ? 'Finalising PDF…' : 'Saving file…'}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface Props {
  students: Student[];
  setStudents?: (students: Student[]) => void;
  records: BonafideRecord[];
  setRecords: (records: BonafideRecord[]) => void;
  currentUser: User;
}

export default function BonafideTab({ students, setStudents, records, setRecords, currentUser }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  // Form State
  const [purpose, setPurpose] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');

  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate progress from 0 to ~target, call onDone when actual work is complete
  const startProgress = () => {
    setDownloadProgress(0);
    let current = 0;
    // Quickly ramp to ~70% with decreasing speed, then slow down to simulate wait
    progressTimerRef.current = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev === null) return 0;
        const remaining = 88 - prev;     // stop auto-advance at 88%
        if (remaining <= 0) return prev;
        const step = Math.max(0.4, remaining * 0.055); // eases out
        return Math.min(prev + step, 88);
      });
    }, 40);
  };

  const finishProgress = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setDownloadProgress(100);
    // Hide overlay after a short delay so user sees 100%
    setTimeout(() => setDownloadProgress(null), 900);
  };

  const branches = Array.from(new Set(students.map(s => s.branch)));
  const categories = Array.from(new Set(students.map(s => s.category)));

  const filteredStudents = students.filter(s => {
    if (branchFilter && s.branch !== branchFilter) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (semesterFilter && s.semester.toString() !== semesterFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && 
          !s.enrollmentId.toLowerCase().includes(q) &&
          !(s.prnNo && s.prnNo.toLowerCase().includes(q)) &&
          !(s.rollNo && s.rollNo.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  const generateCertificatePreview = (student: Student) => {
    const dobStr = student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : "_____";
    const name = student.name || "____________________";
    const fatherName = student.fatherName || "____________________";
    const prnNo = student.prnNo || student.rollNo || "_________";
    const courseStr = student.course || "_________";
    const semesterStr = student.semester ? student.semester.toString() : "___";
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`;

    // Scale: 3.2px per mm  →  A4 = 672px × 950px
    // All positions match pdfGenerator.ts coordinates exactly
    const S = 3.2; // px per mm
    // PDF font pt → scaled px: 1pt = 0.3528mm, so 1pt at S = 0.3528*S ≈ 1.13px
    const pt = (p: number) => `${Math.round(p * 0.3528 * S)}px`;
    const mm = (m: number) => `${Math.round(m * S)}px`;

    const pageW = 210 * S; // 672px
    const pageH = 297 * S; // 950px (we'll let it show partial but scroll if needed)

    return (
      <div
        style={{
          position: 'relative',
          width: `${pageW}px`,
          minHeight: `${pageH}px`,
          margin: '0 auto',
          background: '#fff',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#111',
        }}
      >
        {/* ── WATERMARK ── */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: mm(147), height: mm(147),
            objectFit: 'contain',
            opacity: 0.03,
            pointerEvents: 'none',
          }}
        />

        {/* ── HEADER LOGO (top-left) ── 26×26mm */}
        <img
          src="/logo.png"
          alt="College Logo"
          style={{
            position: 'absolute',
            left: mm(4), top: mm(16), // Aligned with Trust Name
            width: mm(26), height: mm(26),
            objectFit: 'contain',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* ── REG NO (top-right) ── y=14 */}
        <div style={{
          position: 'absolute',
          top: mm(14), right: mm(12),
          fontSize: pt(9), whiteSpace: 'nowrap',
        }}>
          Reg. No. F-17655/Beed
        </div>

        {/* ── TRUST NAME ── center, y=16 */}
        <div style={{
          position: 'absolute',
          top: mm(16), left: 0, width: '100%',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: pt(12),
        }}>
          Joshaba Pratishthan
        </div>

        {/* ── COLLEGE NAME ── center, y=22, blue */}
        <div style={{
          position: 'absolute',
          top: mm(22), left: 0, width: '100%',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: pt(13),
          color: '#0066cc',
          lineHeight: 1,
        }}>
          Vikramshila College Of Fashion Design, Chhatrapati Sambhajinagar
        </div>

        {/* ── AFFILIATION ── center, y=27 */}
        <div style={{
          position: 'absolute',
          top: mm(27), left: 0, width: '100%',
          textAlign: 'center',
          fontSize: pt(8.5),
        }}>
          (Affiliated to S.N.D.T. Women's University, Mumbai.)
        </div>

        {/* ── ADDRESS ── center, y=31 */}
        <div style={{
          position: 'absolute',
          top: mm(31), left: 0, width: '100%',
          textAlign: 'center',
          fontSize: pt(8),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          Address: Janak Tower, Beside Surya Lawns, Deolai Chowk, Beed By Pass Road, Chh. Sambhajinagar
        </div>

        {/* ── EMAIL & CODE ── center, y=35 */}
        <div style={{
          position: 'absolute',
          top: mm(35), left: 0, width: '100%',
          textAlign: 'center',
          fontSize: pt(8),
          whiteSpace: 'nowrap',
        }}>
          Email ID: 537vikramshilafashion@gmail.com / 9310666638&nbsp;&nbsp;&nbsp;College Code:- 537
        </div>

        {/* ── DIVIDER LINE ── y=39 */}
        <div style={{
          position: 'absolute',
          top: mm(39), left: mm(10), right: mm(10),
          height: '1.2px', background: '#222',
        }} />

        {/* ── REF NO ── x=15, y=48 */}
        <div style={{
          position: 'absolute',
          top: mm(48), left: mm(15),
          fontWeight: 'bold', fontSize: pt(10),
          fontFamily: '"Google Sans", "Product Sans", "Open Sans", system-ui, sans-serif',
        }}>
          Ref. No.: _______
        </div>

        {/* ── DATE ── right, y=48 */}
        <div style={{
          position: 'absolute',
          top: mm(48), right: mm(15),
          fontWeight: 'bold', fontSize: pt(10),
          fontFamily: '"Google Sans", "Product Sans", "Open Sans", system-ui, sans-serif',
        }}>
          Date: {dateStr}
        </div>

        {/* ── HEADING ── center, y=62 */}
        <div style={{
          position: 'absolute',
          top: mm(62), left: 0, width: '100%',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: pt(13),
          textDecoration: 'underline',
          letterSpacing: '0.5px',
        }}>
          TO WHOMSOEVER IT MAY CONCERN
        </div>

        {/* ── STUDENT PHOTO ── centre, y=72, 35×45mm */}
        <div style={{
          position: 'absolute',
          top: mm(72),
          left: `${(pageW - (35 * S)) / 2}px`,
          width: mm(35), height: mm(45),
          border: '1px solid #999',
          overflow: 'hidden',
          background: '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: '8px', color: '#aaa', textAlign: 'center' }}>No<br/>Photo</span>
          )}
        </div>

        {/* ── BODY TEXT ── y = 72+45+15 = 132mm */}
        <div style={{
          position: 'absolute',
          top: mm(132), left: mm(15), right: mm(15),
          fontSize: pt(12),
          fontFamily: '"Google Sans", "Product Sans", "Open Sans", system-ui, sans-serif',
          textAlign: 'justify',
          lineHeight: 1.65,
        }}>
          This is to certify that Mr./Ms.&nbsp;<strong>{name}</strong>, son/daughter of Mr.&nbsp;
          <strong>{fatherName}</strong>, bearing PRN No.&nbsp;<strong>{prnNo}</strong> and Date of Birth&nbsp;
          <strong>{dobStr}</strong>, is a bonafide student of&nbsp;
          <strong>Vikramshila College of Fashion Design, Chhatrapati Sambhajinagar</strong>, enrolled
          in the&nbsp;<strong>{courseStr}</strong>&nbsp;program. Currently, he/she is studying in
          Semester&nbsp;<strong>{semesterStr}</strong>.
        </div>

        {/* ── OFFICIAL STAMP ── y = 72+45+80 = 197mm */}
        <div style={{
          position: 'absolute',
          top: mm(197), left: mm(15),
          fontWeight: 'bold', fontSize: pt(11),
          fontFamily: '"Google Sans", "Product Sans", "Open Sans", system-ui, sans-serif',
        }}>
          Official College Stamp
        </div>
      </div>
    );
  };

  const handleDownloadSingle = async () => {
    if (!activeStudent) return;
    setIsLoading(true);
    startProgress();
    
    try {
      const blob = await generateBonafidePDF(activeStudent);
      finishProgress();
      saveAs(blob, `Bonafide_${activeStudent.name.replace(/\s+/g, '_')}.pdf`);

      const newRecord: BonafideRecord = {
        id: 'bf' + Date.now(),
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        purpose: purpose || 'General Academic Use',
        issueDate,
        validUntil,
        generatedBy: currentUser.name
      };

      const dbRecord = {
        student_id: activeStudent.id,
        student_name: activeStudent.name,
        purpose: purpose || 'General Academic Use',
        issue_date: issueDate,
        valid_until: validUntil || null
      };

      await supabase.from('bonafide_records').insert([dbRecord]);

      setRecords([newRecord, ...records]);
      
      setShowPreview(false);
      setActiveStudent(null);
      setPurpose('');
      setValidUntil('');
      setSelectedStudents([]);
      setIsGeneratingBulk(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch(e: any) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setDownloadProgress(null);
      logError('generate PDF', e);
      alert(toUserMessage('generate PDF'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBulk = async () => {
    if (selectedStudents.length === 0) return;
    setIsLoading(true);
    startProgress();
    
    try {
      const zip = new JSZip();
      const newRecords: BonafideRecord[] = [];
      const dbRecords: any[] = [];
      const total = selectedStudents.length;

      const BATCH_SIZE = 4;
      let completedCount = 0;

      for (let i = 0; i < selectedStudents.length; i += BATCH_SIZE) {
        const batchIds = selectedStudents.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batchIds.map(async (id) => {
          const student = students.find(s => s.id === id);
          if (student) {
            const blob = await generateBonafidePDF(student);
            zip.file(`Bonafide_${student.name.replace(/\s+/g, '_')}.pdf`, blob);
            completedCount++;

            newRecords.push({
              id: 'bf' + Date.now() + Math.random().toString().slice(2,6),
              studentId: student.id,
              studentName: student.name,
              purpose: purpose || 'General Academic Use',
              issueDate,
              validUntil,
              generatedBy: currentUser.name
            });

            dbRecords.push({
              student_id: student.id,
              student_name: student.name,
              purpose: purpose || 'General Academic Use',
              issue_date: issueDate,
              valid_until: validUntil || null
            });

            setDownloadProgress(Math.min(88, Math.round((completedCount / total) * 88)));
          }
        }));

        // Yield execution to the browser thread to maintain smooth 60fps UI
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      setDownloadProgress(92);
      const content = await zip.generateAsync({ type: 'blob' });
      finishProgress();
      saveAs(content, `Bulk_Bonafide_Certificates_${new Date().toISOString().split('T')[0]}.zip`);
      
      // Insert all records into Supabase
      if (dbRecords.length > 0) {
        await supabase.from('bonafide_records').insert(dbRecords);
      }
      
      setRecords([...newRecords, ...records]);
      setShowPreview(false);
      setActiveStudent(null);
      setPurpose('');
      setValidUntil('');
      setSelectedStudents([]);
      setIsGeneratingBulk(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch(e: any) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setDownloadProgress(null);
      logError('generate PDFs', e);
      alert(toUserMessage('generate PDFs'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([]);
    setIsGeneratingBulk(false);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sid => sid !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  if (showPreview) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative">
        {/* Download progress overlay — shown instead of white flash */}
        {downloadProgress !== null && (
          <DownloadProgressOverlay
            progress={downloadProgress}
            label={activeStudent ? `Bonafide_${activeStudent.name}.pdf` : `Bulk_Bonafide_Certificates.zip (${selectedStudents.length} files)`}
          />
        )}
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
          <div>
            <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium mb-1">
              <ChevronRight size={16} className="rotate-180" /> Back to Generation
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Preview Bonafide</h2>
            <p className="text-xs text-slate-500 mt-0.5">This preview mirrors the actual downloaded certificate.</p>
          </div>
          <button 
            onClick={activeStudent ? handleDownloadSingle : handleDownloadBulk}
            disabled={downloadProgress !== null}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> {activeStudent ? 'Download' : `Download Zip (${selectedStudents.length})`}
          </button>
        </div>

        <div className="bg-slate-300 rounded-xl border border-slate-400 overflow-auto max-h-[78vh] p-6">
           {activeStudent ? (
             <div style={{ width: 'fit-content', margin: '0 auto' }}>
               {generateCertificatePreview(activeStudent)}
             </div>
           ) : (
             <div className="space-y-8">
               <div className="bg-white rounded-lg p-4 border border-slate-200 max-w-2xl mx-auto">
                 <h3 className="font-bold text-slate-800 mb-1">Bulk Generation Preview</h3>
                 <p className="text-sm text-slate-600">Generating bonafide certificates for <strong>{selectedStudents.length}</strong> students. Scroll to see each certificate.</p>
               </div>
               {selectedStudents.map((studentId, index) => {
                 const student = students.find(s => s.id === studentId);
                 if (!student) return null;
                 return (
                   <div key={studentId} style={{ width: 'fit-content', margin: '0 auto', position: 'relative' }}>
                     <div style={{ position: 'absolute', top: '-24px', left: 0, background: '#475569', color: '#fff', fontSize: '11px', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold' }}>
                       Certificate {index + 1} of {selectedStudents.length} — {student.name}
                     </div>
                     {generateCertificatePreview(student)}
                   </div>
                 );
               })}
             </div>
           )}
        </div>
      </motion.div>
    );
  }

  if (activeStudent || isGeneratingBulk) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative">
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
          <div>
            <button onClick={() => { setActiveStudent(null); setIsGeneratingBulk(false); }} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium mb-1">
              <ChevronRight size={16} className="rotate-180" /> Back to Students
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Configure Certificate</h2>
            <p className="text-sm text-slate-500">
              {activeStudent ? `For ${activeStudent.name}` : `For ${selectedStudents.length} selected students`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
           <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Purpose of Certificate</label>
                <input 
                  type="text" 
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Bus Pass, Bank Account, Passport"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Date of Issue</label>
                  <input 
                    type="date" 
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Valid Until (Optional)</label>
                  <input 
                    type="date" 
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowPreview(true)}
                  className="px-6 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors flex items-center gap-2"
                >
                  <Eye size={16} /> Preview & Generate
                </button>
              </div>
           </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Bonafide Certificate Generation</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by name, PRN, Roll No or ID..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]"
                  />
                </div>
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <Filter size={16} /> Filters
              </button>
            </div>

            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
                  <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
                  <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                    <option value="">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {setBranchFilter(''); setCategoryFilter(''); setSemesterFilter(''); setSearchQuery('');}}
                    className="w-full px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm font-semibold text-slate-700">Select All</span>
              </div>
              {selectedStudents.length > 0 && (
                <button 
                  onClick={() => setIsGeneratingBulk(true)}
                  className="text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  Generate Selected ({selectedStudents.length})
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Student</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Details</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleSelectStudent(student.id)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-sm">{student.name}</div>
                        <div className="text-xs text-slate-500">{student.enrollmentId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-700"><span className="font-semibold">Branch:</span> {student.branch} (Sem {student.semester})</div>
                        <div className="text-xs text-slate-700"><span className="font-semibold">PRN:</span> {student.prnNo || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => {
                            setSelectedStudents([]);
    setIsGeneratingBulk(false);
                            setActiveStudent(student);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <FileText size={14} /> Generate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText size={18} className="text-[#1e293b]" /> Certificate History
            </h4>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {records.length > 0 ? records.map(record => (
                <div key={record.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="font-semibold text-sm text-slate-900">{record.studentName}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    <span className="font-medium text-slate-700">Purpose:</span> {record.purpose}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex justify-between items-center">
                    <span>Issued: {new Date(record.issueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center text-sm text-slate-500 py-6">
                  No certificates generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SuccessToast show={showSuccessToast} message="Certificate Generated Successfully" />
    </motion.div>
  );
}
