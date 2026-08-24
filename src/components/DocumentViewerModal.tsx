import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, 
  FileText, Image as ImageIcon, AlertCircle, RefreshCw, Move
} from 'lucide-react';
import { resolveViewableFileUrl, forceDownloadFile, getFileType, extractRawUrl } from '../utils/fileViewer';

export interface DocumentPreviewItem {
  title: string;
  url: string;
  bucket?: string;
  fileType?: 'image' | 'pdf' | 'other';
  mimeType?: string;
}

interface DocumentViewerModalProps {
  document?: DocumentPreviewItem | null;
  docItem?: DocumentPreviewItem | null;
  onClose: () => void;
}

export default function DocumentViewerModal({ document: docProp, docItem, onClose }: DocumentViewerModalProps) {
  const activeDoc = docItem || docProp || null;
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeDoc) {
      setResolvedUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });

    const loadUrl = async () => {
      try {
        const raw = extractRawUrl(activeDoc.url);
        if (!raw) {
          throw new Error('No valid document URL provided');
        }

        const signed = await resolveViewableFileUrl(raw, activeDoc.bucket || 'student_documents');
        if (isMounted) {
          if (!signed) {
            throw new Error('Failed to resolve document location');
          }
          setResolvedUrl(signed);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error loading document in modal:', err);
          setError(err.message || 'Unable to load document preview.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUrl();

    // Escape key to exit
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDoc, onClose]);

  if (!activeDoc) return null;

  const explicitType = activeDoc.fileType || (activeDoc.mimeType?.startsWith('image/') ? 'image' : activeDoc.mimeType === 'application/pdf' ? 'pdf' : undefined);
  const fileTypeFromTitle = getFileType(activeDoc.title);
  const fileType = explicitType || (fileTypeFromTitle !== 'other' 
    ? fileTypeFromTitle 
    : getFileType(activeDoc.url || resolvedUrl));
  const isImage = fileType === 'image';
  const isPdf = fileType === 'pdf';

  const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.25).toFixed(2)), 4));
  const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.4));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom or vertical pan handler
  const handleWheel = (e: React.WheelEvent) => {
    if (!isImage) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    } else {
      // Pan vertically/horizontally with mouse wheel
      setPosition(prev => ({
        x: prev.x - (e.deltaX || 0),
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Drag to pan image with cursor (up, down, left, right)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isImage) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isImage) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isImage || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !isImage || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleOpenExternal = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async () => {
    if (resolvedUrl && activeDoc) {
      await forceDownloadFile(resolvedUrl, activeDoc.title, activeDoc.bucket || 'student_documents');
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] w-screen h-screen bg-white flex flex-col select-none overflow-hidden animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
    >
      {/* Top Header Bar - Full Screen Light Theme */}
      <header className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-200 text-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-xs z-20">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
            {isImage ? <ImageIcon size={18} className="text-emerald-600" /> : <FileText size={18} className="text-sky-600" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate leading-tight" title={activeDoc.title}>
              {activeDoc.title || 'Document Viewer'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span>VCFD ERP</span>
              <span>•</span>
              <span className="text-sky-700 font-extrabold">{isImage ? 'Image File' : isPdf ? 'PDF Document' : 'Official Document'}</span>
            </p>
          </div>
        </div>

        {/* Right: Controls & Cross Exit Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Zoom & Navigation Toolbar for Images */}
          {isImage && (
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out (or Ctrl + Scroll Down)"
                className="p-1.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset Zoom & Pan (100%)"
                className="px-2 py-0.5 text-xs font-mono font-bold text-slate-800 hover:text-slate-950 hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In (or Ctrl + Scroll Up)"
                className="p-1.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border-l border-slate-200 ml-0.5 pl-1.5"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset Position"
                className="p-1.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border-l border-slate-200 ml-0.5 pl-1.5"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download Document"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
          >
            <Download size={15} />
            <span className="hidden md:inline">Download</span>
          </button>

          {/* Open in New Tab Button */}
          <button
            type="button"
            onClick={handleOpenExternal}
            title="Open in new browser tab"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shadow-2xs active:scale-95"
          >
            <ExternalLink size={16} />
          </button>

          {/* Prominent Cross Button to Exit Full Screen */}
          <button
            type="button"
            onClick={onClose}
            title="Close / Exit Full Screen (Esc)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs font-bold text-xs"
            aria-label="Close"
          >
            <X size={18} className="text-rose-600" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </header>

      {/* Main Full-Screen Body with Pure White Canvas & Watermark */}
      <main 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 w-full h-full bg-white relative overflow-hidden flex items-center justify-center ${
          isImage ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {/* Subtle Watermark Pattern Across Entire Full-Screen Canvas */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.035] select-none flex flex-wrap content-center justify-around items-center gap-20 overflow-hidden"
          style={{ transform: 'rotate(-25deg) scale(1.4)' }}
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="text-2xl font-black text-slate-900 tracking-[0.3em] uppercase whitespace-nowrap">
              VCFD ERP • VIKRAMSHILA
            </div>
          ))}
        </div>

        {/* Centered Watermark Title */}
        <div className="absolute pointer-events-none z-0 opacity-[0.04] text-center select-none">
          <p className="text-6xl sm:text-8xl md:text-9xl font-black text-slate-900 tracking-widest uppercase">
            VCFD ERP
          </p>
          <p className="text-base sm:text-lg font-bold text-slate-700 tracking-[0.35em] uppercase mt-3">
            Vikramshila College Official Record
          </p>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-slate-700 bg-white/95 p-8 rounded-2xl border border-slate-200 shadow-md">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-slate-800 border-t-transparent"></div>
            <p className="text-sm font-bold text-slate-800">Loading document...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="relative z-10 p-8 bg-white border border-rose-200 rounded-2xl max-w-md text-center text-slate-700 shadow-xl m-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertCircle size={28} />
            </div>
            <h4 className="font-bold text-lg text-slate-900 mb-1">Preview Unavailable</h4>
            <p className="text-xs text-slate-500 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <Download size={15} /> Download File
              </button>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                Open in New Tab
              </button>
            </div>
          </div>
        )}

        {/* Rendered Document */}
        {!isLoading && !error && resolvedUrl && (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            {isImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-hidden p-4">
                <div
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                    transformOrigin: 'center center',
                  }}
                  className="flex items-center justify-center max-w-full max-h-full select-none"
                >
                  <img
                    src={resolvedUrl}
                    alt={document.title}
                    draggable={false}
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-200 bg-white select-none pointer-events-none"
                  />
                </div>

                {/* Floating Pan & Zoom Hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm text-white px-3.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-2 shadow-lg pointer-events-none select-none">
                  <Move size={12} className="text-sky-400" />
                  <span>Click & drag cursor to pan • Scroll or buttons to zoom</span>
                </div>
              </div>
            ) : isPdf ? (
              <div className="w-full h-full bg-white flex flex-col">
                <iframe
                  src={`${resolvedUrl}#toolbar=1&view=FitH`}
                  title={document.title}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            ) : (
              <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center max-w-md text-slate-600 shadow-xl m-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <FileText size={32} className="text-slate-700" />
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-1">{document.title}</h4>
                <p className="text-xs text-slate-500 mb-6">
                  This document type can be downloaded or opened directly in your browser.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download size={15} /> Download File
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <ExternalLink size={15} /> Open File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>,
    window.document.body
  );
}
