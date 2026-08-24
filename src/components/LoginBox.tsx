import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Check, X, Clock, ShieldAlert } from 'lucide-react';

interface Props {
  onLogin: (username: string, password?: string) => void;
  onRegister: (name: string, email: string, password?: string) => Promise<boolean> | void;
  isLoading?: boolean;
  loginError?: 'pending_approval' | 'invalid_credentials' | 'invalid_password' | 'rate_limited' | 'account_suspended' | null;
  loginErrorRetryAfter?: number | null;
}

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: 'At least 8 characters',       test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter (A–Z)',   test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter (a–z)',   test: (pw) => /[a-z]/.test(pw) },
  { label: 'One digit (0–9)',              test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character (!@#…)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function LoginBox({ onLogin, onRegister, isLoading, loginError, loginErrorRetryAfter }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);

  const allRulesPassed = passwordRules.every((r) => r.test(registerPassword));

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername) return;
    onLogin(loginUsername, loginPassword);
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail) return;
    if (!allRulesPassed) {
      alert('Password does not meet the requirements. Please check the checklist.');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    
    const success = await onRegister(registerName, registerEmail, registerPassword);
    
    if (success !== false) {
      setShowSuccessAnim(true);
      setTimeout(() => {
        setShowSuccessAnim(false);
        setIsLogin(true);
        setRegisterName('');
        setRegisterEmail('');
        setRegisterPassword('');
        setRegisterConfirmPassword('');
        setPasswordFocused(false);
      }, 2500);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] w-full max-w-[420px] relative overflow-hidden border border-slate-200">
      <div className="absolute top-0 left-0 w-full h-[5px] bg-[#1e293b]"></div>

      <div className="p-5 sm:p-8 pb-6">
        <div className="flex flex-col items-center gap-2 mb-6 sm:mb-8 text-center mt-1">
          <div className="w-14 sm:w-16 h-auto flex items-center justify-center mb-1 drop-shadow-sm">
            <img
              src="/logo.png"
              alt="Vikramshila College Of Fashion Design Logo"
              className="w-full h-auto object-contain"
            />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Vikramshila College ERP</h3>
            <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
              {isLogin ? 'Enter your credentials to access the institution portal' : 'Submit a request to access the portal'}
            </p>
          </div>
        </div>

        {showSuccessAnim ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative flex items-center justify-center w-20 h-20 mb-2">
               <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75"></div>
               <div className="relative bg-emerald-500 rounded-full p-4 shadow-lg flex items-center justify-center">
                 <Check className="w-10 h-10 text-white" strokeWidth={3} />
               </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Request Submitted!</h3>
            <p className="text-sm text-slate-500 text-center px-4">Your request has been sent to the admin. You will be able to login once approved.</p>
          </div>
        ) : isLogin ? (
          <form className="space-y-4" onSubmit={handleLoginSubmit}>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="Enter your authorized email address"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {/* Login Error Banners */}
            {loginError === 'pending_approval' && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3.5 animate-[fadeSlideDown_0.4s_ease-out]">
                <div className="flex-shrink-0 mt-0.5 bg-amber-100 rounded-full p-1.5">
                  <Clock size={14} className="text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-amber-800">Access Pending Approval</p>
                  <p className="text-xs text-amber-700 mt-0.5">Your request has been received. Please wait for the Super Admin to approve your account before signing in.</p>
                </div>
              </div>
            )}
            {loginError === 'invalid_password' && (
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-lg p-3.5 animate-[fadeSlideDown_0.4s_ease-out]">
                <div className="flex-shrink-0 mt-0.5 bg-rose-100 rounded-full p-1.5">
                  <ShieldAlert size={14} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-rose-800">Invalid Password</p>
                  <p className="text-xs text-rose-700 mt-0.5">The password you entered is incorrect. Please try again.</p>
                </div>
              </div>
            )}
            {loginError === 'invalid_credentials' && (
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-lg p-3.5 animate-[fadeSlideDown_0.4s_ease-out]">
                <div className="flex-shrink-0 mt-0.5 bg-rose-100 rounded-full p-1.5">
                  <ShieldAlert size={14} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-rose-800">Email Not Recognised</p>
                  <p className="text-xs text-rose-700 mt-0.5">This email is not registered. Please request access first.</p>
                </div>
              </div>
            )}
            {loginError === 'account_suspended' && (
              <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3.5 animate-[fadeSlideDown_0.4s_ease-out]">
                <div className="flex-shrink-0 mt-0.5 bg-orange-100 rounded-full p-1.5">
                  <ShieldAlert size={14} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-orange-800">Account Suspended</p>
                  <p className="text-xs text-orange-700 mt-0.5">Your account has been suspended. Please contact the Super Admin.</p>
                </div>
              </div>
            )}
            {loginError === 'rate_limited' && (
              <div className="flex items-start gap-3 bg-slate-100 border border-slate-300 rounded-lg p-3.5 animate-[fadeSlideDown_0.4s_ease-out]">
                <div className="flex-shrink-0 mt-0.5 bg-slate-200 rounded-full p-1.5">
                  <Clock size={14} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">Too Many Attempts</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Please try again{loginErrorRetryAfter ? ` in ${loginErrorRetryAfter} seconds` : ' later'}.
                  </p>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1e293b] text-white text-base sm:text-sm font-bold py-3 sm:py-2.5 rounded-lg hover:bg-slate-800 transition-all shadow-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRegisterSubmit}>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Email ID</label>
              <input
                type="email"
                placeholder="john.doe@example.com"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  className="w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                >
                  {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password strength checklist — shows once user focuses the field */}
              {passwordFocused && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  {passwordRules.map((rule) => {
                    const passed = rule.test(registerPassword);
                    return (
                      <div
                        key={rule.label}
                        className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                          passed ? 'text-emerald-600' : 'text-rose-500'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                            passed ? 'bg-emerald-100' : 'bg-rose-100'
                          }`}
                        >
                          {passed ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                        </span>
                        {rule.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showRegisterConfirmPassword ? 'text' : 'password'}
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  className={`w-full text-base sm:text-sm px-3.5 py-3 sm:py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] transition-all placeholder:text-slate-400 pr-10 ${
                    registerConfirmPassword && registerConfirmPassword !== registerPassword
                      ? 'border-rose-400'
                      : 'border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                >
                  {showRegisterConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {registerConfirmPassword && registerConfirmPassword !== registerPassword && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <X size={11} strokeWidth={3} /> Passwords do not match
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!allRulesPassed || registerPassword !== registerConfirmPassword || isLoading}
              className="w-full bg-[#1e293b] text-white text-base sm:text-sm font-bold py-3 sm:py-2.5 rounded-lg hover:bg-slate-800 transition-all shadow-sm mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>

      {!showSuccessAnim && (
        <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 text-center">
          {isLogin ? (
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <button onClick={() => setIsLogin(false)} className="text-[#1e293b] font-semibold hover:underline">
                Request Access
              </button>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <button onClick={() => setIsLogin(true)} className="text-[#1e293b] font-semibold hover:underline">
                Sign In
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
