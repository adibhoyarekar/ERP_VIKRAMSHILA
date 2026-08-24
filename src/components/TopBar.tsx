import { useState, useEffect } from 'react';
import { Clock, Download } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export default function TopBar() {
  const [time, setTime] = useState(new Date());
  const { isInstallable, isInstalled, isIOS, isOnline, promptInstall } = usePWA();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedFullTime = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(time);

  const formattedMobileTime = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(time);

  const handleInstall = async () => {
    if (isInstallable) {
      await promptInstall();
    }
  };

  return (
    <div className="bg-slate-900 text-slate-200 px-3 sm:px-4 md:px-6 py-1.5 flex justify-between items-center text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800 relative z-30 gap-2 max-w-full overflow-hidden">
      {/* Left side: Network Status & PWA Install Button */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Network indicator */}
        <div className="flex items-center gap-1.5" title={isOnline ? 'Network Connected' : 'Offline Mode'}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] text-slate-400 normal-case tracking-normal">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Install button if installable and not installed */}
        {!isInstalled && (isInstallable || isIOS) && (
          <button
            type="button"
            onClick={handleInstall}
            className="flex items-center gap-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold normal-case tracking-normal transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Install Vikramshila ERP on your device"
          >
            <Download size={10} />
            <span>Install</span>
          </button>
        )}
      </div>

      {/* Right side: Live Clock */}
      <div className="flex items-center gap-1.5 text-slate-300 text-[10px] sm:text-[11px] shrink-0">
        <Clock size={11} className="text-sky-400" />
        <span className="tabular-nums hidden sm:inline">{formattedFullTime}</span>
        <span className="tabular-nums sm:hidden">{formattedMobileTime}</span>
      </div>
    </div>
  );
}
