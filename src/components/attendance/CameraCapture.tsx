import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, SwitchCamera, Upload, AlertCircle } from 'lucide-react';
import { logError } from '../../utils/errorHandler';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const stopTracks = useCallback((activeStream: MediaStream | null) => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
    }
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    setIsStarting(true);
    setIsVideoReady(false);
    setError(null);

    // Stop existing stream if any
    if (stream) {
      stopTracks(stream);
      setStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported on this browser/device.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                setIsVideoReady(true);
                setIsStarting(false);
              })
              .catch(err => {
                console.warn('Video play catch:', err);
                setIsVideoReady(true);
                setIsStarting(false);
              });
          }
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      logError(err, 'startCamera');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission is required for selfie attendance. Please enable camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device found. You can upload a selfie using the button below.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is currently in use by another app. Please close other camera apps and try again.');
      } else {
        setError(err.message || 'Unable to access camera. Please try again.');
      }
      setIsStarting(false);
    }
  }, [facingMode, stopTracks, stream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopTracks(stream);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setCapturedImage(null);
  };

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (width === 0 || height === 0) {
      console.warn('Video dimensions not ready yet');
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (context) {
      context.save();
      // If using front camera, mirror image so preview matches orientation
      if (facingMode === 'user') {
        context.translate(width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, width, height);
      context.restore();

      const imageUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (imageUrl && imageUrl.length > 200 && !imageUrl.startsWith('data:,')) {
        setCapturedImage(imageUrl);
      } else {
        console.error('Captured image was empty or invalid');
      }
    }
  }, [facingMode]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    if (!stream || !stream.active) {
      startCamera(facingMode);
    } else if (videoRef.current) {
      videoRef.current.play().catch(e => console.warn('Retake play:', e));
    }
  }, [facingMode, startCamera, stream]);

  const handleConfirm = useCallback(() => {
    if (!canvasRef.current && !capturedImage) return;

    if (canvasRef.current) {
      canvasRef.current.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `attendance_selfie_${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          stopTracks(stream);
          onCapture(file);
        }
      }, 'image/jpeg', 0.85);
    }
  }, [capturedImage, onCapture, stopTracks, stream]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        setCapturedImage(result);

        // Also draw onto canvas for blob creation
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            const ctx = canvasRef.current.getContext('2d');
            ctx?.drawImage(img, 0, 0);
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    stopTracks(stream);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        {/* Modal Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
            <Camera className="w-5 h-5 text-indigo-600" />
            Live Selfie Verification
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-4 bg-slate-900 relative min-h-[340px] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-6 text-slate-200 max-w-sm">
              <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={24} />
              </div>
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{error}</p>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  Retry Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload size={14} /> Upload Selfie
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Spinner while starting */}
              {isStarting && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-300 z-10">
                  <div className="animate-spin rounded-full h-9 w-9 border-2 border-indigo-500 border-t-transparent mb-3"></div>
                  <p className="text-xs font-medium">Initializing camera...</p>
                </div>
              )}

              {/* Video Stream Element (Always in DOM to avoid hardware decoder detachment) */}
              <div
                className={`relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center ${
                  capturedImage ? 'hidden' : 'block'
                }`}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onCanPlay={() => {
                    setIsVideoReady(true);
                    setIsStarting(false);
                  }}
                  className={`w-full h-auto max-h-[50vh] object-cover rounded-xl ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />

                {/* Flip camera toggle button */}
                {!capturedImage && isVideoReady && (
                  <button
                    onClick={handleToggleCamera}
                    type="button"
                    title="Flip camera"
                    className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
              </div>

              {/* Captured Image Preview */}
              {capturedImage && (
                <div className="relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                  <img
                    src={capturedImage}
                    alt="Selfie Preview"
                    onError={() => {
                      console.warn('Captured image load error, resetting...');
                      handleRetake();
                    }}
                    className="w-full h-auto max-h-[50vh] object-cover rounded-xl"
                  />
                  <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Check size={13} strokeWidth={3} /> Photo Ready
                  </div>
                </div>
              )}

              {/* Offscreen Canvas for Snapshot Generation */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Hidden file input fallback */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="user"
                onChange={handleFileInput}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!error && (
          <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2 shrink-0">
            {!capturedImage ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={isStarting || !isVideoReady}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Take Selfie Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload / Camera App"
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Upload size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" strokeWidth={3} />
                  Proceed & Verify
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
