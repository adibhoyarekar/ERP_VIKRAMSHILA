import React from 'react';
import { X, RefreshCw, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { User } from '../data/mockData';

export interface DrawerNavGroup<T extends string> {
  category?: string;
  items: DrawerNavItem<T>[];
}

export interface DrawerNavItem<T extends string> {
  tab: T;
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: number;
  badgeColor?: string;
}

export interface PortalDrawerProps<T extends string> {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  portalTitle: string;
  roleBadgeText?: string;
  activeTab: T;
  onSelectTab: (tab: T) => void;
  groups: DrawerNavGroup<T>[];
  onSync?: () => Promise<void> | void;
  isSyncing?: boolean;
  onLogout: () => void;
}

export default function PortalDrawer<T extends string>({
  isOpen,
  onClose,
  user,
  portalTitle,
  roleBadgeText,
  activeTab,
  onSelectTab,
  groups,
  onSync,
  isSyncing = false,
  onLogout,
}: PortalDrawerProps<T>) {
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
  const displayRole = roleBadgeText || user.role.replace(/_/g, ' ').toUpperCase();

  return (
    <>
      {/* Mobile Backdrop Overlay (only visible on mobile screens when open) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Permanent on Desktop (md:static md:translate-x-0), Slide-out on Mobile */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 sm:w-68 md:w-64 lg:w-68 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out select-none h-full shadow-lg md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Simple & Clean Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/80 p-1 flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight truncate leading-tight">
                {portalTitle}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/80 uppercase tracking-wider">
                <ShieldCheck size={11} className="text-sky-600" />
                {displayRole}
              </span>
            </div>
          </div>

          {/* Close button for mobile only */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clean Compact User Profile */}
        <div className="p-2.5 mx-3 my-2 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center gap-2.5 shrink-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight" title={user.name}>
              {user.name}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate flex items-center gap-1 mt-0.5" title={user.email || user.username}>
              <Mail size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email || user.username}</span>
            </p>
          </div>
        </div>

        {/* Clean Navigation Menu Items */}
        <nav className="flex-1 px-3 py-1 space-y-3.5 overflow-y-auto custom-scrollbar">
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {group.category && (
                <div className="px-2.5 py-0.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {group.category}
                </div>
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.tab);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-sky-950 border border-sky-300/80 font-bold shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-bold'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                        }`}
                      >
                        {item.icon}
                      </div>

                      <span className={`text-[13.5px] tracking-tight flex-1 truncate ${
                        isActive ? 'font-black text-sky-950' : 'font-bold text-slate-800 group-hover:text-slate-950'
                      }`}>
                        {item.label}
                      </span>

                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none shrink-0 ${
                            item.badgeColor || 'bg-rose-500 text-white'
                          }`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Clean Footer: Sync, Sign Out & Status */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2 shrink-0">
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw size={13} className={`text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Data'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200/70 cursor-pointer shadow-2xs"
          >
            <LogOut size={14} className="text-rose-600" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
            <span>ERP v2.4</span>
          </div>
        </div>
      </aside>
    </>
  );
}
