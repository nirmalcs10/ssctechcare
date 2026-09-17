import React, { useState } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Laptop, 
  Bell, 
  ExternalLink,
  ShieldCheck,
  LogOut,
  User,
  Clock,
  Calendar,
  Lock
} from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { useComputerClock } from '../utils/date';

export default function Navbar({ onOpenNewTicket, onSearch, onNavigate, currentUser, masterUser, onLogout, onMasterLogout }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const clock = useComputerClock();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
      case 'technician':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'frontdesk':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <header className="no-print bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">SSC TechCare</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Service Desk v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Computer & Hardware Service Management</p>
          </div>
        </div>

        {/* Middle: Global Quick Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-800/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Computer System Clock Live Widget */}
          <div 
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs shadow-inner select-none cursor-default"
            title={`System Clock: ${clock.fullString} (${clock.timeZone}) • Synchronized with Computer Date & Time`}
          >
            <span className="relative flex h-2 w-2" title="Synchronized with Computer Clock">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline">{clock.weekday},</span>
              <span>{clock.dateString}</span>
            </div>
            <span className="text-slate-600 font-bold">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-[11px]">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{clock.timeString}</span>
            </div>
          </div>

          {/* Public Tracker Link */}
          <button
            onClick={() => onNavigate('track')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors"
            title="Open Customer Self-Service Status Tracker"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">{t('customerPortal')}</span>
          </button>

          {/* Quick New Ticket Button */}
          <button
            onClick={onOpenNewTicket}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newJobCard')}</span>
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden xl:flex flex-col items-end text-right">
                <span className="text-xs font-medium text-slate-200 leading-tight">
                  {currentUser.fullName || currentUser.username}
                </span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${getRoleBadge(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={onLogout}
                title={`${t('signOut')} (${currentUser.username})`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
              {onMasterLogout && (
                <button
                  onClick={onMasterLogout}
                  title="Lock & Exit to Main Login"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 transition-all"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
