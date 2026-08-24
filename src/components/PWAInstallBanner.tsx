import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, WifiOff, CheckCircle2, Smartphone, Monitor } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isOnline, promptInstall } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md relative z-50 animate-pulse">
          <WifiOff size={16} />
          <span>You are currently in Offline Mode. Cached portal data remains accessible.</span>
        </div>
      )}

      {/* PWA Install Notification Bar for Android/Windows/Chrome if not dismissed and not installed */}
      {!isInstalled && !isDismissed && (isInstallable || isIOS) && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-bounce-short">
          <div className="bg-slate-900/95 backdrop-blur-md border border-sky-500/40 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm border border-slate-700">
              <img src="/logo.png" alt="Vikramshila ERP" className="w-full h-full object-contain" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight truncate">Vikramshila ERP</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">App</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-1">
                Install for fast 1-tap access on phone & PC
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download size={14} />
                Install
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-white space-y-4 shadow-2xl relative animate-fadeSlideDown">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Vikramshila ERP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-400">Add to Home Screen in 2 quick steps</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-sm text-slate-200">
              <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                  <Share size={18} />
                </div>
                <div>
                  <span className="font-semibold text-white">1. Tap Share Button</span>
                  <p className="text-xs text-slate-400 mt-0.5">Tap the Safari share icon at the bottom of your browser toolbar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                  <PlusSquare size={18} />
                </div>
                <div>
                  <span className="font-semibold text-white">2. Add to Home Screen</span>
                  <p className="text-xs text-slate-400 mt-0.5">Scroll down and tap <strong>'Add to Home Screen'</strong>.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
