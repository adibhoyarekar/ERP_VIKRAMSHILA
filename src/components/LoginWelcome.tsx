import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  name: string;
  role: string;
  onComplete: () => void;
}

const roleLabels: Record<string, string> = {
  superadmin: 'Super Administrator',
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  clerk: 'Clerk',
  accountant: 'Accountant',
};

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  superadmin:  { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }, // slate
  super_admin: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }, // slate
  admin:       { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' }, // sky
  clerk:       { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }, // emerald
  accountant:  { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' }, // violet
};

export default function LoginWelcome({ name, role, onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  const label = roleLabels[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const colors = roleColors[role] ?? { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };

  useEffect(() => {
    // Snappy phase timeline: enter -> hold -> exit -> done (1.4s total)
    const t1 = setTimeout(() => setPhase('hold'),  40);
    const t2 = setTimeout(() => setPhase('exit'),  1100);
    const t3 = setTimeout(() => onComplete(),      1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  // Use a light theme background matching the project
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc', // slate-50 (matches bg of App)
    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: phase === 'exit' ? 0 : 1,
    pointerEvents: phase === 'exit' ? 'none' : 'all',
    cursor: 'pointer',
  };

  const cardStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '3rem 3.5rem',
    borderRadius: '1.5rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0', // slate-200
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
    maxWidth: '480px',
    width: '90%',
    transform: phase === 'enter' ? 'translateY(30px) scale(0.96)' : 'translateY(0) scale(1)',
    opacity: phase === 'enter' ? 0 : 1,
    transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
  };

  const logoRingStyle: React.CSSProperties = {
    width: '110px',
    height: '110px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    border: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
    boxShadow: '0 8px 30px rgba(14, 165, 233, 0.15)',
    animation: phase !== 'enter' ? 'pulse-light 2s ease-in-out infinite' : 'none',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.4rem 1.2rem',
    borderRadius: '999px',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '2rem',
  };

  const dividerStyle: React.CSSProperties = {
    width: '60px',
    height: '3px',
    backgroundColor: '#38bdf8', // sky-400
    margin: '0 auto 1.25rem',
    borderRadius: '2px',
    opacity: 0.8,
  };

  return (
    <>
      <style>{`
        @keyframes pulse-light {
          0%, 100% { box-shadow: 0 8px 30px rgba(14, 165, 233, 0.15); }
          50%      { box-shadow: 0 12px 40px rgba(14, 165, 233, 0.25); }
        }
        @keyframes shimmer-bar-light {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      <div style={overlayStyle} onClick={onComplete} role="button" tabIndex={0}>
        <div style={cardStyle} onClick={e => e.stopPropagation()}>
          {/* Logo ring */}
          <div style={logoRingStyle}>
            <img
              src="/logo.png"
              alt="Vikramshila College Logo"
              style={{ width: '72px', height: '72px', objectFit: 'contain', borderRadius: '50%' }}
            />
          </div>

          {/* ERP name */}
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
            Vikramshila College <span style={{ color: '#0369a1' }}>ERP</span>
          </div>

          <div style={dividerStyle} />

          {/* Welcome text */}
          <div style={{ fontSize: '0.8rem', color: '#64748b', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: '0.4rem', fontWeight: 600 }}>
            Welcome back
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', marginBottom: '1.25rem' }}>
            {name}
          </div>

          {/* Role badge */}
          <div style={badgeStyle}>{label}</div>

          {/* Loading bar */}
          <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0, left: 0,
              height: '100%',
              width: '40%',
              background: 'linear-gradient(90deg, transparent, #38bdf8, #0ea5e9, transparent)',
              animation: 'shimmer-bar-light 1.2s ease-in-out infinite',
              borderRadius: '2px',
            }} />
          </div>

          <div style={{ fontSize: '0.82rem', color: '#64748b', letterSpacing: '0.08em', marginTop: '0.75rem' }}>
            Preparing your dashboard...
          </div>
        </div>
      </div>
    </>
  );
}
