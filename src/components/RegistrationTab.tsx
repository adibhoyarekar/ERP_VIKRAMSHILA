import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { logError, toUserMessage } from '../utils/errorHandler';
import { validateFile, ALLOWED_FILE_TYPES, ALLOWED_PHOTO_TYPES } from '../utils/fileValidator';
import { motion, AnimatePresence } from "motion/react";
import SuccessToast from './SuccessToast';
import { UserPlus, Upload, Save, X, ChevronRight, ChevronLeft, CheckCircle, FileText, Briefcase, Eye, ClipboardCheck } from 'lucide-react';
import { Student } from '../data/mockData';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { ZoomIn, ZoomOut, Check, RotateCw } from 'lucide-react';
import Loader from './Loader';
import SuccessAnimation from './SuccessAnimation';
import DocumentViewerModal, { DocumentPreviewItem } from './DocumentViewerModal';

interface RegistrationTabProps {
  students: Student[];
  setStudents: (val: Student[]) => void;
  setActiveTab?: (tab: any) => void;
}

export default function RegistrationTab({ students, setStudents, setActiveTab }: RegistrationTabProps) {
  const [step, setStep] = useState(1);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [savedStudentName, setSavedStudentName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('vcfd_registration_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved draft', e);
      }
    }
    return {
      // Step 1: Personal Info
      name: '',
      dob: '',
      fatherName: '',
      address: '',
      pincode: '',
      phone: '',
      alternatePhone: '',
      prnNo: '',
      rollNo: '',
      caste: 'OPEN',
      otherCaste: '',
      subCaste: '',
      email: '',
      course: 'BA Fashion Design',
      studyYear: '1',
      semester: 1,
      batchYear: new Date().getFullYear().toString(),

      // Step 2: Education & Docs
      schoolName10th: '',
      board10th: '',
      passingYear10th: '',
      percentage10th: '',
      collegeName12th: '',
      percentage12th: '',
      otherCourseName: '',
      otherCourseMarks: '',
      hasTC: false,
      hasCasteCert: false,
      hasDomicile: false,
      hasGap: false,

      // Step 3: Bank Details
      accountHolderName: '',
      bankAccountNo: '',
      bankName: '',
      bankIfsc: '',
      bankBranch: '',
      upiId: '',
      upiApp: '',
      otherUpiApp: ''
    };
  });

  React.useEffect(() => {
    sessionStorage.setItem('vcfd_registration_draft', JSON.stringify(formData));
  }, [formData]);


  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [photoFileUrl, setPhotoFileUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);


  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({
    marksheet10th: null,
    marksheet12th: null,
    otherCourseDoc: null,
    tcDoc: null,
    casteCertDoc: null,
    aadharDoc: null,
    panDoc: null,
    domicileDoc: null,
    rationCardDoc: null,
    declarationCertDoc: null,
    gapCertDoc: null,
    incomeCertDoc: null,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDocChange = async (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
      if (errorMsg) {
        alert(errorMsg);
        e.target.value = ''; // Reset input
        return;
      }
    }
    setDocFiles(prev => ({ ...prev, [name]: file }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const errorMsg = await validateFile(file, ALLOWED_PHOTO_TYPES);
      if (errorMsg) {
        alert(errorMsg);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const url = URL.createObjectURL(file);
      setPhotoFileUrl(url);
      setCropModalOpen(true);
      // Reset input value to allow selecting the same file again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    try {
      if (!photoFileUrl || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(
        photoFileUrl,
        croppedAreaPixels,
        rotation
      );
      setPhotoPreview(croppedImage);
      setCropModalOpen(false);
      setZoom(1);
      setRotation(0);
    } catch (e) {
      console.error(e);
    }
  };

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      // Validate Step 2 requirements before moving to Step 3
      if (step === 2) {
        if (!docFiles.marksheet10th) {
          alert("10th Marksheet is mandatory.");
          return;
        }
        if (!docFiles.marksheet12th) {
          alert("12th Marksheet is mandatory.");
          return;
        }
        if (!docFiles.aadharDoc) {
          alert("Aadhar Card is mandatory.");
          return;
        }
        if (!docFiles.tcDoc) {
          alert("Transfer Certificate (TC) is mandatory.");
          return;
        }
        if (formData.caste !== 'OPEN' && formData.caste !== 'Other' && !docFiles.casteCertDoc) {
          alert(`Caste Certificate is compulsory for ${formData.caste} category.`);
          return;
        }
        if (formData.caste === 'OBC' && !docFiles.rationCardDoc) {
          alert("Ration Card is compulsory for OBC category.");
          return;
        }
        if (['ST', 'OPEN', 'VJNT', 'OBC'].includes(formData.caste) && !docFiles.declarationCertDoc) {
          alert(`Declaration Certificate is mandatory for ${formData.caste} category.`);
          return;
        }
      }
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const docsToUploadCount = Object.values(docFiles).filter(Boolean).length;
    const totalTasks = 1 /* DB Insert */ + (photoPreview ? 1 : 0) + docsToUploadCount;
    let completedTasks = 0;
    const updateProgress = () => {
      completedTasks++;
      setUploadProgress(Math.min(100, Math.floor((completedTasks / totalTasks) * 100)));
    };
    setUploadProgress(5); // start at 5% to show immediate feedback

    let finalPhotoUrl = undefined;

    // Upload photo to Supabase storage if it exists
    if (photoPreview) {
      try {
        const response = await fetch(photoPreview);
        const blob = await response.blob();
        const fileExt = 'jpeg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          logError('upload student photo', uploadError);
          alert(toUserMessage('upload photo'));
          setIsLoading(false);
          return;
        }

        if (uploadData) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          finalPhotoUrl = data.publicUrl;
        }
        updateProgress();
      } catch (err) {
        console.error('Error processing photo:', err);
      }
    }

    const enrollmentId = 'VCFD-' + new Date().getFullYear().toString().slice(-2) + '-' + Math.floor(100 + Math.random() * 900);

    const clean = (val: any) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : null);

    const studentData = {
      enrollment_id: enrollmentId,
      name: formData.name.trim(),
      dob: clean(formData.dob),
      email: clean(formData.email) || (formData.name.toLowerCase().replace(/\s+/g, '.') + '@example.com'),
      phone: clean(formData.phone),
      course: formData.course,
      branch: formData.course,
      category: formData.caste === 'Other' ? (formData.otherCaste || 'Other') : (formData.caste || 'OPEN'),
      study_year: clean(formData.studyYear),
      semester: Number(formData.semester) || 1,
      status: 'active',
      admission_date: clean(formData.admissionDate) || new Date().toISOString().split('T')[0],
      scholarship: false,
      documents_complete: true,
      profile_completion: 80,

      father_name: clean(formData.fatherName),
      address: clean(formData.address),
      pincode: clean(formData.pincode),
      alternate_phone: clean(formData.alternatePhone),
      prn_no: clean(formData.prnNo),
      roll_no: clean(formData.rollNo),
      sub_caste: clean(formData.subCaste),
      photo_url: clean(finalPhotoUrl),

      account_holder_name: clean(formData.accountHolderName),
      bank_account_no: clean(formData.bankAccountNo),
      bank_name: clean(formData.bankName),
      bank_ifsc: clean(formData.bankIfsc),
      bank_branch: clean(formData.bankBranch),
      upi_id: clean(formData.upiId),
      upi_app: formData.upiApp === 'Other' ? clean(formData.otherUpiApp) : clean(formData.upiApp),
    };

    try {
      const { data, error } = await supabase
        .from('students')
        .insert([studentData])
        .select()
        .single();

      if (error) {
        logError('insert student record', error);
        alert(`Unable to save student record: ${error.message || 'Please verify your inputs and try again.'}`);
        setIsLoading(false);
        return;
      }

      if (data) {
        updateProgress();
        // -------------------------------------------------------
        // Upload all document files to Supabase Storage and
        // collect their public URLs in the same JSON format used
        // by the Manage Documents tab: { name, url }
        // -------------------------------------------------------
        const docLabelMap: Record<string, string> = {
          marksheet10th: '10th Marksheet',
          marksheet12th: '12th Marksheet',
          aadharDoc: 'Aadhar Card',
          panDoc: 'PAN Card',
          tcDoc: 'Transfer Certificate (TC)',
          casteCertDoc: 'Caste Certificate',
          domicileDoc: 'Domicile / Rahivasi',
          rationCardDoc: 'Ration Card',
          declarationCertDoc: 'Declaration Certificate',
          gapCertDoc: 'Gap Certificate',
          otherCourseDoc: 'Other Course Document',
          incomeCertDoc: 'Income Certificate',
        };

        const uploadedDocs: string[] = [];

        for (const [key, val] of Object.entries(docFiles)) {
          const file = val as File | null;
          if (!file) continue;
          const label = docLabelMap[key] || key;
          const fileExt = file.name.split('.').pop();
          const fileName = `${enrollmentId}-${key}-${Date.now()}.${fileExt}`;
          try {
            const { error: upError } = await supabase.storage
              .from('student_documents')
              .upload(fileName, file);
            if (upError) {
              console.error(`Failed to upload ${label}:`, upError.message);
              continue; // skip this doc but continue with others
            }
            const { data: signData } = await supabase.storage
              .from('student_documents')
              .createSignedUrl(fileName, 86400 * 365);
            uploadedDocs.push(JSON.stringify({ name: label, url: signData?.signedUrl || fileName }));
            updateProgress();
          } catch (err: any) {
            console.error(`Error uploading ${label}:`, err.message);
          }
        }

        // Persist document URLs on the student row
        if (uploadedDocs.length > 0) {
          await supabase
            .from('students')
            .update({ documents: uploadedDocs })
            .eq('id', data.id);
        }

        // Map back to local Student type format
        const newStudent: Student = {
          id: data.id,
          enrollmentId: data.enrollment_id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          course: data.course,
          branch: data.branch,
          category: data.category,
          subCaste: data.sub_caste,
          fatherName: data.father_name,
          address: data.address,
          pincode: data.pincode,
          alternatePhone: data.alternate_phone,
          prnNo: data.prn_no,
          rollNo: data.roll_no,
          photoUrl: data.photo_url,
          semester: data.semester,
          dob: data.dob,
          status: data.status as any,
          admissionDate: data.admission_date,
          scholarship: data.scholarship,
          bankName: data.bank_name,
          bankAccountNo: data.bank_account_no,
          bankIfsc: data.bank_ifsc,
          bankBranch: data.bank_branch,
          accountHolderName: data.account_holder_name,
          upiId: data.upi_id,
          upiApp: data.upi_app,
          documentsComplete: data.documents_complete,
          documents: uploadedDocs, // ← actual uploaded doc URLs
          profileCompletion: data.profile_completion || 0
        };
        setStudents([...students, newStudent]);
        sessionStorage.removeItem('vcfd_registration_draft');
      }
    } catch (err: any) {
      logError('registration network request', err);
      alert(toUserMessage('connect to server'));
      setIsLoading(false);
      setUploadProgress(null);
      return;
    }

    setUploadProgress(100);
    // wait a small delay to let 100% render, then proceed to success animation
    setTimeout(() => {
      setIsLoading(false);
      setUploadProgress(null);
      setSavedStudentName(formData.name);
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        if (setActiveTab) setActiveTab('students');
      }, 2800);
    }, 500);
  };

  const indianBanks = [
    "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Punjab National Bank (PNB)",
    "Axis Bank", "Bank of Baroda", "Bank of India", "Canara Bank", "Union Bank of India",
    "Central Bank of India", "Indian Bank", "Indian Overseas Bank", "UCO Bank",
    "Bank of Maharashtra", "Punjab & Sind Bank", "Kotak Mahindra Bank", "IndusInd Bank",
    "Yes Bank", "IDFC First Bank", "Federal Bank", "South Indian Bank", "Bandhan Bank",
    "RBL Bank", "City Union Bank", "Jammu & Kashmir Bank", "Karur Vysya Bank", "Saraswat Bank"
  ];

  const handleViewDoc = (e: React.MouseEvent, docFile: File | null, label?: string) => {
    e.preventDefault();
    if (docFile) {
      const url = URL.createObjectURL(docFile);
      setPreviewDoc({
        title: label ? `${formData.name ? formData.name + ' - ' : ''}${label}` : docFile.name,
        url,
        bucket: 'student_documents'
      });
    }
  };

  const renderOverviewItem = (label: string, value: string | undefined | null, missingText = 'Not Provided') => (
    <div className="flex flex-col mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      {value ? (
        <span className="text-sm font-medium text-slate-900">{value}</span>
      ) : (
        <span className="text-sm italic text-slate-400">{missingText}</span>
      )}
    </div>
  );

  const renderDocOverview = (label: string, docFile: File | null, isMandatory: boolean = false, isApplicable: boolean = true) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        <FileText size={16} className={docFile ? "text-emerald-500" : "text-slate-300"} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div>
        {!isApplicable || !docFile ? (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Not Applicable</span>
        ) : (
          <button
            type="button"
            onClick={(e) => handleViewDoc(e, docFile, label)}
            className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-2xs"
          >
            <Eye size={12} /> View
          </button>
        )}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative">
      {isLoading && uploadProgress !== null && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-[inherit]">
          <div className="flex flex-col items-center w-72">
            <div className="text-5xl font-extrabold text-emerald-600 mb-6 drop-shadow-sm">
              {uploadProgress}%
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-600 animate-pulse text-center">
              Saving student data and uploading documents...
            </p>
          </div>
        </div>
      )}
      <Loader show={isLoading && uploadProgress === null} fullScreen={false} />
      {cropModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Crop Profile Photo</h3>
              <button
                onClick={() => { setCropModalOpen(false); setZoom(1); setRotation(0); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative w-full h-80 bg-slate-100">
              {photoFileUrl && (
                <Cropper
                  image={photoFileUrl}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="rect"
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  showGrid={false}
                />
              )}
            </div>

            <div className="p-5 bg-white space-y-4">
              <div className="flex items-center gap-3">
                <ZoomOut size={18} className="text-slate-400" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-sky-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <ZoomIn size={18} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-3">
                <RotateCw size={18} className="text-slate-400" />
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  aria-labelledby="Rotation"
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 accent-sky-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => { setCropModalOpen(false); setZoom(1); setRotation(0); }}
                className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCroppedImage}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Check size={16} /> Apply & Save
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
      {!showSuccessAnimation && <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-200 pb-4 gap-4">
        <h2 className="text-2xl font-bold text-slate-900">New Student Registration</h2>
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 max-w-full">
          {[1, 2, 3, 4].map((num) => (
            <React.Fragment key={num}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${step >= num ? 'bg-[#1e293b] text-white' : 'bg-slate-200 text-slate-500'}`}>{num}</div>
              {num < 4 && <div className={`w-8 sm:w-12 h-1 shrink-0 rounded-full ${step >= num + 1 ? 'bg-[#1e293b]' : 'bg-slate-200'}`}></div>}
            </React.Fragment>
          ))}
        </div>
      </div>}

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
        <AnimatePresence mode="wait">
          {showSuccessAnimation && (
            <SuccessAnimation
              title="Registration Successful!"
              message={<><span className="font-semibold text-emerald-600">{savedStudentName}</span> has been added successfully.</>}
              subMessage="Redirecting to Students list…"
              color="emerald"
            />
          )}
        </AnimatePresence>
        {!showSuccessAnimation && <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.form key="step1" onSubmit={nextStep} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="mb-6 pb-4 border-b border-slate-100 flex items-center gap-2 text-slate-800">
                <UserPlus size={20} className="text-[#1e293b]" />
                <h3 className="text-lg font-bold">Personal Information</h3>
              </div>

              <div className="mb-8 flex flex-col items-center sm:items-start sm:flex-row gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative hover:bg-slate-100 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload size={24} className="text-slate-400 mb-2" />
                        <span className="text-xs font-medium text-slate-500 text-center px-2">Upload Photo<br />(Max 5MB)</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept={ALLOWED_PHOTO_TYPES.join(',')}
                    onChange={handlePhotoUpload}
                  />
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="text-xs text-rose-500 font-medium flex items-center gap-1 hover:text-rose-600"
                    >
                      <X size={14} /> Remove
                    </button>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name <span className="text-rose-500">*</span></label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Student Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Father's Name <span className="text-rose-500">*</span></label>
                    <input required type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Father's Full Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth (DD/MM/YYYY) <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        placeholder="DD"
                        maxLength={2}
                        value={(formData.dob || '--').split('-')[2] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const parts = (formData.dob || '--').split('-');
                          const y = parts[0] || '';
                          const m = parts[1] || '';
                          setFormData({ ...formData, dob: `${y}-${m}-${val}` });
                        }}
                        className="w-16 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                      <span className="text-slate-400 self-center">/</span>
                      <input
                        required
                        type="text"
                        placeholder="MM"
                        maxLength={2}
                        value={(formData.dob || '--').split('-')[1] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const parts = (formData.dob || '--').split('-');
                          const y = parts[0] || '';
                          const d = parts[2] || '';
                          setFormData({ ...formData, dob: `${y}-${val}-${d}` });
                        }}
                        className="w-16 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                      <span className="text-slate-400 self-center">/</span>
                      <input
                        required
                        type="text"
                        placeholder="YYYY"
                        maxLength={4}
                        value={(formData.dob || '--').split('-')[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const parts = (formData.dob || '--').split('-');
                          const m = parts[1] || '';
                          const d = parts[2] || '';
                          setFormData({ ...formData, dob: `${val}-${m}-${d}` });
                        }}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">PRN No. <span className="text-rose-500">*</span></label>
                    <input type="text" name="prnNo" value={formData.prnNo} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="PRN Number" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Roll No. <span className="text-xs font-normal text-slate-400">(Optional)</span></label>
                    <input type="text" name="rollNo" value={formData.rollNo} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Roll Number" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-8">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Address <span className="text-rose-500">*</span></label>
                  <textarea required name="address" value={formData.address} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Complete Residential Address"></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Pincode <span className="text-rose-500">*</span></label>
                  <input required type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="e.g. 400001" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile No. <span className="text-rose-500">*</span></label>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="10-digit mobile number" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Alternate Mobile No.</label>
                  <input type="tel" name="alternatePhone" value={formData.alternatePhone} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Optional" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address <span className="text-rose-500">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="student@example.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-8 pt-6 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Caste Category <span className="text-rose-500">*</span></label>
                  <select required name="caste" value={formData.caste} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white">
                    <option value="OPEN">OPEN</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="VJNT">VJNT</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {formData.caste === 'Other' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Specify Caste <span className="text-rose-500">*</span></label>
                    <input required type="text" name="otherCaste" value={formData.otherCaste} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Enter caste name" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Subcaste (if any)</label>
                  <input type="text" name="subCaste" value={formData.subCaste} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Leave empty if not applicable" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Course</label>
                  <select name="course" value={formData.course} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white">
                    <option value="BA Fashion Design">BA Fashion Design</option>
                    <option value="BSc Clinical Laboratory CLS">BSc Clinical Laboratory CLS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Semester</label>
                  <input type="number" min="1" max="10" name="semester" value={formData.semester} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Batch Year</label>
                  <input type="text" name="batchYear" value={formData.batchYear} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="e.g. 2024" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Study Year</label>
                  <select name="studyYear" value={formData.studyYear} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white" required>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">
                  Next: Education & Documents <ChevronRight size={18} />
                </button>
              </div>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form key="step2" onSubmit={nextStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6 pb-4 border-b border-slate-100 flex items-center gap-2 text-slate-800">
                <FileText size={20} className="text-[#1e293b]" />
                <h3 className="text-lg font-bold">Education & Documents</h3>
              </div>

              <div className="space-y-6 mb-8">
                {/* 10th Details */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-4">10th Standard</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">School Name <span className="text-rose-500">*</span></label>
                      <input required type="text" name="schoolName10th" value={formData.schoolName10th} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="School Name" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Percentage <span className="text-rose-500">*</span></label>
                      <input required type="text" name="percentage10th" value={formData.percentage10th} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="e.g. 85.5%" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Upload Marksheet <span className="text-xs font-normal text-slate-500">(Max 5MB)</span> <span className="text-rose-500">*</span></label>
                      <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('marksheet10th', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                    </div>
                  </div>
                </div>

                {/* 12th Details */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-4">12th Standard</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">College Name <span className="text-rose-500">*</span></label>
                      <input required type="text" name="collegeName12th" value={formData.collegeName12th} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="College Name" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Percentage <span className="text-rose-500">*</span></label>
                      <input required type="text" name="percentage12th" value={formData.percentage12th} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="e.g. 80.0%" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Upload Marksheet <span className="text-xs font-normal text-slate-500">(Max 5MB)</span> <span className="text-rose-500">*</span></label>
                      <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('marksheet12th', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                    </div>
                  </div>
                </div>

                {/* Other Course Details */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-4">Other Course (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Course Name</label>
                      <input type="text" name="otherCourseName" value={formData.otherCourseName} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="e.g. Diploma in IT" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Marks/Percentage</label>
                      <input type="text" name="otherCourseMarks" value={formData.otherCourseMarks} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="e.g. 75%" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Upload Document <span className="text-xs font-normal text-slate-500">(Max 5MB)</span></label>
                      <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('otherCourseDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                    </div>
                  </div>
                </div>

                {/* Required Documents Section */}
                <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4 border-b border-slate-100 pb-2">Mandatory & Conditional Documents <span className="text-sm font-normal text-slate-500">(Max 5MB per file)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Aadhar Card <span className="text-rose-500">*</span></label>
                    <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('aadharDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">PAN Card</label>
                    <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('panDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Income Certificate</label>
                    <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('incomeCertDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Original TC <span className="text-rose-500">*</span></label>
                    <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('tcDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                  </div>

                  {formData.caste !== 'OPEN' && formData.caste !== 'Other' && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-900 mb-2">Caste Certificate <span className="text-rose-500">*</span></label>
                      <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('casteCertDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-slate-900">Domicile / Rahivasi</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="hasDomicile" checked={formData.hasDomicile} onChange={handleInputChange} className="w-4 h-4 text-[#1e293b] rounded border-slate-300 focus:ring-[#1e293b]" />
                        <span className="text-sm font-medium text-slate-700">Yes</span>
                      </label>
                    </div>
                    {formData.hasDomicile && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('domicileDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                      </motion.div>
                    )}
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-slate-900">Gap Certificate</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="hasGap" checked={formData.hasGap} onChange={handleInputChange} className="w-4 h-4 text-[#1e293b] rounded border-slate-300 focus:ring-[#1e293b]" />
                        <span className="text-sm font-medium text-slate-700">Yes</span>
                      </label>
                    </div>
                    {formData.hasGap && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <input required type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('gapCertDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
                      </motion.div>
                    )}
                  </div>

                  {formData.caste === 'OBC' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-blue-50 p-4 rounded-xl border border-blue-200 md:col-span-2">
                      <label className="block text-sm font-semibold text-blue-900 mb-2">Ration Card <span className="text-rose-500">* (Mandatory for OBC)</span></label>
                      <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('rationCardDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
                    </motion.div>
                  )}

                  {['ST', 'OPEN', 'VJNT', 'OBC'].includes(formData.caste) && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-amber-50 p-4 rounded-xl border border-amber-200 md:col-span-2">
                      <label className="block text-sm font-semibold text-amber-900 mb-2">Declaration Certificate <span className="text-rose-500">* (Mandatory for {formData.caste})</span></label>
                      <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleDocChange('declarationCertDoc', e)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700" />
                    </motion.div>
                  )}

                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button type="button" onClick={prevStep} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
                  <ChevronLeft size={18} /> Back
                </button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">
                  Next: Bank Details <ChevronRight size={18} />
                </button>
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.form key="step3" onSubmit={nextStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6 pb-4 border-b border-slate-100 flex items-center gap-2 text-slate-800">
                <Briefcase size={20} className="text-[#1e293b]" />
                <h3 className="text-lg font-bold">Bank Details</h3>
              </div>

              <div className="space-y-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Account Holder Name <span className="text-rose-500">*</span></label>
                    <input required type="text" name="accountHolderName" value={formData.accountHolderName} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="As per passbook" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Account No. <span className="text-rose-500">*</span></label>
                    <input required type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Account Number" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Bank Name <span className="text-rose-500">*</span></label>
                    <input required list="banks" name="bankName" value={formData.bankName} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Select or type bank name" />
                    <datalist id="banks">
                      {indianBanks.map((bank, index) => (
                        <option key={index} value={bank} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Branch Name <span className="text-rose-500">*</span></label>
                    <input required type="text" name="bankBranch" value={formData.bankBranch} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Branch Name or City" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">IFSC Code <span className="text-rose-500">*</span></label>
                    <input required type="text" name="bankIfsc" value={formData.bankIfsc} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="e.g. SBIN0001234" />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">UPI Details (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">UPI ID or Mobile No.</label>
                      <input type="text" name="upiId" value={formData.upiId} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="e.g. 9876543210@ybl" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">UPI App Name</label>
                      <select name="upiApp" value={formData.upiApp} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white">
                        <option value="">Select App</option>
                        <option value="Google Pay">Google Pay</option>
                        <option value="PhonePe">PhonePe</option>
                        <option value="Paytm">Paytm</option>
                        <option value="YONO SBI">YONO SBI</option>
                        <option value="BHIM">BHIM</option>
                        <option value="Amazon Pay">Amazon Pay</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {formData.upiApp === 'Other' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Specify UPI App</label>
                        <input type="text" name="otherUpiApp" value={formData.otherUpiApp} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" placeholder="Enter UPI app name" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button type="button" onClick={prevStep} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
                  <ChevronLeft size={18} /> Back
                </button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">
                  Next: Overview <ChevronRight size={18} />
                </button>
              </div>
            </motion.form>
          )}

          {step === 4 && (
            <motion.form key="step4" onSubmit={handleSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6 pb-4 border-b border-slate-100 flex items-center gap-2 text-slate-800">
                <ClipboardCheck size={20} className="text-[#1e293b]" />
                <h3 className="text-lg font-bold">Review & Submit</h3>
              </div>

              <div className="space-y-8 mb-8">

                {/* Personal Info Overview */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800">Personal Information</h4>
                    <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Edit</button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-24 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Student" className="w-full h-full object-cover" />
                        ) : (
                          <UserPlus size={32} className="text-slate-300" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">Student Photo</span>
                      {photoPreview && (
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({
                            title: `${formData.name ? formData.name + ' - ' : ''}Student Photo`,
                            url: photoPreview,
                            bucket: 'student_photos'
                          })}
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-2xs"
                        >
                          <Eye size={11} /> View
                        </button>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderOverviewItem('Full Name', formData.name)}
                      {renderOverviewItem('Date of Birth', formData.dob ? new Date(formData.dob).toLocaleDateString() : '')}
                      {renderOverviewItem("Father's Name", formData.fatherName)}
                      {renderOverviewItem('Course', formData.course)}
                      {renderOverviewItem('Study Year', formData.studyYear + (formData.studyYear === '1' ? 'st' : formData.studyYear === '2' ? 'nd' : formData.studyYear === '3' ? 'rd' : 'th') + ' Year')}
                      {renderOverviewItem('Semester', formData.semester.toString())}
                      {renderOverviewItem('Batch Year', formData.batchYear)}
                      {renderOverviewItem('Category', formData.caste === 'Other' ? formData.otherCaste : formData.caste)}
                      {renderOverviewItem('Mobile No.', formData.phone)}
                      {renderOverviewItem('Email', formData.email)}
                      {renderOverviewItem('PRN No.', formData.prnNo)}
                      {renderOverviewItem('Roll No.', formData.rollNo)}
                      <div className="col-span-2 md:col-span-4">
                        {renderOverviewItem('Address', `${formData.address} - ${formData.pincode}`)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Education & Docs Overview */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800">Education Details</h4>
                    <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Edit</button>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 font-semibold text-sm text-slate-700 bg-slate-100">
                      <div>Qualification</div>
                      <div>Institution</div>
                      <div>Percentage</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 text-sm">
                      <div className="font-medium">10th Standard</div>
                      <div>{formData.schoolName10th || <span className="italic text-slate-400">Missing</span>}</div>
                      <div>{formData.percentage10th || <span className="italic text-slate-400">Missing</span>}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 text-sm">
                      <div className="font-medium">12th Standard</div>
                      <div>{formData.collegeName12th || <span className="italic text-slate-400">Missing</span>}</div>
                      <div>{formData.percentage12th || <span className="italic text-slate-400">Missing</span>}</div>
                    </div>
                    {formData.otherCourseName && (
                      <div className="grid grid-cols-3 gap-4 p-4 text-sm">
                        <div className="font-medium">Other Course</div>
                        <div>{formData.otherCourseName}</div>
                        <div>{formData.otherCourseMarks}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800">Uploaded Documents</h4>
                    <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Edit</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <div>
                      {renderDocOverview("10th Marksheet", docFiles.marksheet10th, true)}
                      {renderDocOverview("12th Marksheet", docFiles.marksheet12th, true)}
                      {renderDocOverview("Aadhar Card", docFiles.aadharDoc, true)}
                      {renderDocOverview("PAN Card", docFiles.panDoc)}
                      {renderDocOverview("Income Certificate", docFiles.incomeCertDoc)}
                      {renderDocOverview("Other Course Document", docFiles.otherCourseDoc, false, !!formData.otherCourseName)}
                    </div>
                    <div>
                      {renderDocOverview("Transfer Certificate (TC)", docFiles.tcDoc, true, true)}
                      {renderDocOverview("Caste Certificate", docFiles.casteCertDoc, formData.caste !== 'OPEN' && formData.caste !== 'Other', formData.caste !== 'OPEN' && formData.caste !== 'Other')}
                      {renderDocOverview("Domicile / Rahivasi", docFiles.domicileDoc, formData.hasDomicile, formData.hasDomicile)}
                      {renderDocOverview("Gap Certificate", docFiles.gapCertDoc, formData.hasGap, formData.hasGap)}
                      {renderDocOverview("Ration Card", docFiles.rationCardDoc, formData.caste === 'OBC', formData.caste === 'OBC')}
                      {renderDocOverview("Declaration Certificate", docFiles.declarationCertDoc, ['ST', 'OPEN', 'VJNT', 'OBC'].includes(formData.caste), ['ST', 'OPEN', 'VJNT', 'OBC'].includes(formData.caste))}
                    </div>
                  </div>
                </div>

                {/* Bank Details Overview */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800">Bank Details</h4>
                    <button type="button" onClick={() => setStep(3)} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Edit</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {renderOverviewItem('Account Holder Name', formData.accountHolderName)}
                    {renderOverviewItem('Account No.', formData.bankAccountNo)}
                    {renderOverviewItem('Bank Name', formData.bankName)}
                    {renderOverviewItem('Branch Name', formData.bankBranch)}
                    {renderOverviewItem('IFSC Code', formData.bankIfsc)}
                    <div className="col-span-3 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                      {renderOverviewItem('UPI ID', formData.upiId)}
                      {renderOverviewItem('UPI App', formData.upiApp === 'Other' ? formData.otherUpiApp : formData.upiApp)}
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button type="button" onClick={prevStep} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
                  <ChevronLeft size={18} /> Back
                </button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                  <Save size={18} /> Confirm & Complete Registration
                </button>
              </div>
            </motion.form>
          )}

        </AnimatePresence>}
      </div>

      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </motion.div>
  );
}
