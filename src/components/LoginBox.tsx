import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Check, X, Clock, ShieldAlert, Zap, ArrowRight, RotateCcw, Sparkles, Shield, UserCheck, FileSpreadsheet, Calculator, GraduationCap } from 'lucide-react';
import { DEMO_CREDENTIALS, DemoCredential } from '../data/mockData';
import { resetDemoDatabase } from '../lib/supabase';

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

  const [loginUsername, setLoginUsername] = useState('superadmin@vikramshila.edu');
  const [loginPassword, setLoginPassword] = useState('Demo@1234');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'manual'>('quick');

  const allRulesPassed = passwordRules.every((r) => r.test(registerPassword));

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername) return;
    onLogin(loginUsername, loginPassword);
  };

  const handleQuickLogin = (cred: DemoCredential) => {
    setLoginUsername(cred.email);
    setLoginPassword(cred.password);
    onLogin(cred.email, cred.password);
  };

  const handleAutofill = (cred: DemoCredential) => {
    setLoginUsername(cred.email);
    setLoginPassword(cred.password);
    setActiveTab('manual');
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin':
      case 'super_admin':
        return <Shield className="w-4 h-4 text-purple-600" />;
      case 'admin':
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case 'clerk':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case 'accountant':
        return <Calculator className="w-4 h-4 text-amber-600" />;
      default:
        return <GraduationCap className="w-4 h-4 text-sky-600" />;
    }
  };

  return (
    <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Left / Main Card: Demo Quick Access Selector */}
      <div className="lg:col-span-7 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base md:text-lg">Demo Access Credentials</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Click any role for 1-click instant login or copy demo credentials
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50">
          {DEMO_CREDENTIALS.map((cred) => (
            <div
              key={cred.role}
              className="group bg-white p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-indigo-50 transition-colors flex-shrink-0 mt-0.5">
                  {getRoleIcon(cred.role)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{cred.roleTitle}</span>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${cred.badgeColor}`}>
                      {cred.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1 truncate">
                    <span className="text-slate-700 font-medium">{cred.email}</span> &bull; Pass: <span className="font-semibold text-slate-700">{cred.password}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {cred.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => handleAutofill(cred)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                  title="Autofill into form"
                >
                  Fill Form
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin(cred)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Zap size={13} className="text-amber-300 fill-amber-300" />
                  <span>Instant Login</span>
                  <ArrowRight size={12} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}

          {/* Quick Database Reset Tool */}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              Client-side standalone demo &bull; LocalStorage synced
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset demo database to fresh default values? All mock records will be restored.')) {
                  resetDemoDatabase();
                }
              }}
              className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium transition-colors cursor-pointer py-1 px-2 rounded hover:bg-slate-100"
            >
              <RotateCcw size={12} />
              <span>Reset Demo Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Standard Login / Registration Form */}
      <div className="lg:col-span-5 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200/80 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-500"></div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col items-center gap-2 mb-5 text-center">
            <div className="w-12 h-12 flex items-center justify-center drop-shadow-sm">
              <img
                src="/logo.png"
                alt="Vikramshila College Of Fashion Design Logo"
                className="w-full h-auto object-contain"
              />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Vikramshila College ERP</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLogin ? 'Sign in with credentials or 1-click demo access' : 'Submit a registration access request'}
              </p>
            </div>
          </div>

          {showSuccessAnim ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative flex items-center justify-center w-16 h-16 mb-2">
                 <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75"></div>
                 <div className="relative bg-emerald-500 rounded-full p-3.5 shadow-lg flex items-center justify-center">
                   <Check className="w-8 h-8 text-white" strokeWidth={3} />
                 </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Request Submitted!</h3>
              <p className="text-xs text-slate-500 text-center px-4">Your request has been added to pending approvals. Login with Superadmin to approve it.</p>
            </div>
          ) : isLogin ? (
            <form className="space-y-3.5" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address / Username</label>
                <input
                  type="email"
                  placeholder="e.g. superadmin@vikramshila.edu"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <span className="text-[11px] text-slate-400">Default: Demo@1234</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Login Error Messages */}
              {loginError === 'pending_approval' && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 animate-[fadeSlideDown_0.3s_ease-out]">
                  <Clock size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Access Pending Approval</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Please sign in as Super Admin to approve this account.</p>
                  </div>
                </div>
              )}
              {loginError === 'invalid_password' && (
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl p-3 animate-[fadeSlideDown_0.3s_ease-out]">
                  <ShieldAlert size={15} className="text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-rose-800">Invalid Password</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">Use <strong>Demo@1234</strong> or click Instant Login above.</p>
                  </div>
                </div>
              )}
              {loginError === 'invalid_credentials' && (
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl p-3 animate-[fadeSlideDown_0.3s_ease-out]">
                  <ShieldAlert size={15} className="text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-rose-800">Account Not Found</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">Please select one of the predefined demo accounts.</p>
                  </div>
                </div>
              )}
              {loginError === 'account_suspended' && (
                <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-xl p-3 animate-[fadeSlideDown_0.3s_ease-out]">
                  <ShieldAlert size={15} className="text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800">Account Suspended</p>
                    <p className="text-[11px] text-orange-700 mt-0.5">This demo account is currently suspended.</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-1"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={handleRegisterSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pooja Shinde"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email ID</label>
                <input
                  type="email"
                  placeholder="pooja.shinde@vikramshila.edu"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                  >
                    {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {passwordFocused && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    {passwordRules.map((rule) => {
                      const passed = rule.test(registerPassword);
                      return (
                        <div
                          key={rule.label}
                          className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                            passed ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                              passed ? 'bg-emerald-100' : 'bg-rose-100'
                            }`}
                          >
                            {passed ? <Check size={8} strokeWidth={3} /> : <X size={8} strokeWidth={3} />}
                          </span>
                          {rule.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className={`w-full text-sm px-3.5 py-2.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 pr-10 ${
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
                    {showRegisterConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!allRulesPassed || registerPassword !== registerConfirmPassword || isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm mt-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? 'Submitting...' : 'Submit Access Request'}
              </button>
            </form>
          )}
        </div>

        {!showSuccessAnim && (
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 text-center">
            {isLogin ? (
              <p className="text-xs text-slate-600">
                Need a new user test account?{' '}
                <button onClick={() => setIsLogin(false)} className="text-indigo-600 font-semibold hover:underline cursor-pointer">
                  Request Access
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                Already have credentials?{' '}
                <button onClick={() => setIsLogin(true)} className="text-indigo-600 font-semibold hover:underline cursor-pointer">
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
