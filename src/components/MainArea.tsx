import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import LoginBox from './LoginBox';

interface Props {
  onLogin: (username: string, password?: string) => void;
  onRegister: (name: string, email: string, password?: string) => void;
  isLoading?: boolean;
  loginError?: 'pending_approval' | 'invalid_credentials' | 'invalid_password' | 'rate_limited' | 'account_suspended' | null;
  loginErrorRetryAfter?: number | null;
}

export default function MainArea({ onLogin, onRegister, isLoading, loginError, loginErrorRetryAfter }: Props) {
  return (
    <main className="flex-1 bg-slate-50/50 p-4 sm:p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden max-w-full">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200/50 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Repeating Watermark */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02] select-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='240' height='240' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='48' font-weight='bold' font-family='sans-serif' fill='%230f172a' text-anchor='middle' dominant-baseline='middle' transform='rotate(-25 120 120)'%3EVCFD%3C/text%3E%3C/svg%3E")`,
          backgroundSize: '240px 240px'
        }}
      ></div>

      <div className="w-full relative z-10 flex flex-col items-center justify-center">
        
        {/* Center: Login Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center justify-center w-full"
        >
          <div className="w-full flex justify-center">
            <LoginBox onLogin={onLogin} onRegister={onRegister} isLoading={isLoading} loginError={loginError} loginErrorRetryAfter={loginErrorRetryAfter} />
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 bg-white/60 px-4 py-2 rounded-full border border-slate-200 w-fit shadow-sm">
            <AlertCircle size={14} className="text-amber-500" />
            <span>Unauthorized access is strictly prohibited and monitored.</span>
          </div>
        </motion.div>

      </div>
    </main>
  );
}
