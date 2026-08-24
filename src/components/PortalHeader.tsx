import React from 'react';
import { Menu, X, RefreshCw, LogOut, Mail } from 'lucide-react';
import { User } from '../data/mockData';

export interface PortalHeaderProps {
  portalTitle: string;
  activeTabLabel: string;
  user: User;
  isMobileMenuOpen: boolean;
  onToggleMenu: () => void;
  isAppMode?: boolean;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onSync?: () => Promise<void> | void;
  isSyncing?: boolean;
  onLogout: () => void;
}

export default function PortalHeader({
  portalTitle,
  activeTabLabel,
  user,
  isMobileMenuOpen,
  onToggleMenu,
  onSync,
  isSyncing = false,
  onLogout,
}: PortalHeaderProps) {
  // Get avatar initial
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs gap-2 select-none w-full max-w-full overflow-hidden">
      {/* Left Area: Hamburger Toggle & Portal Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Mobile Hamburger Menu Toggle Button */}
        <button
          type="button"
          onClick={onToggleMenu}
          className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200 active:bg-slate-300 transition-all flex items-center justify-center cursor-pointer shrink-0 border border-slate-200/80 shadow-2xs active:scale-95"
          aria-label="Toggle Navigation Menu"
          title="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? (
            <X size={18} className="text-slate-800" />
          ) : (
            <Menu size={18} className="text-slate-800" />
          )}
        </button>

        {/* Portal Title & Active Tab */}
        <div className="flex items-center gap-2 min-w-0 truncate">
          <h2 className="font-black text-slate-900 text-sm sm:text-base tracking-tight leading-tight truncate">
            {portalTitle}
          </h2>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200/90 capitalize truncate">
            {activeTabLabel.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Right Area: User Profile / Avatar + Sync + Sign Out */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Desktop Profile Pill (Visible on md and larger screens) */}
        <div
          className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs select-none"
          title={`${user.name} (${user.email || user.username})`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 ring-1 ring-white">
            {initial}
          </div>
          <div className="flex flex-col text-left leading-tight min-w-0 max-w-[180px] lg:max-w-[240px]">
            <span className="text-xs font-black text-slate-900 tracking-tight truncate">
              {user.name}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 truncate select-all">
              <Mail size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email || user.username}</span>
            </span>
          </div>
        </div>

        {/* Mobile Avatar Button (Visible on phone screens only, opens drawer with full email) */}
        <button
          type="button"
          onClick={onToggleMenu}
          className="md:hidden w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center ring-1 ring-slate-300/80 shadow-2xs cursor-pointer active:scale-95 shrink-0"
          title={`${user.name} (${user.email || user.username}) - Tap for menu`}
          aria-label="User Profile"
        >
          {initial}
        </button>

        {/* Refresh / Sync Button */}
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:border-sky-300 rounded-xl text-xs font-bold border border-sky-200/90 disabled:opacity-50 transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            title="Sync and Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw
              size={14}
              className={`text-sky-600 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span className="hidden md:inline">
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </span>
          </button>
        )}

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-rose-700 hover:text-rose-800 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={14} className="text-rose-600" />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
