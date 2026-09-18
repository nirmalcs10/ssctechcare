import React from 'react';
import { 
  LayoutDashboard, 
  Ticket, 
  Kanban, 
  Boxes, 
  Users, 
  Receipt, 
  UserCheck, 
  SearchCheck, 
  Settings,
  Cpu,
  LogOut,
  Shield,
  X,
  Wrench
} from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export default function Sidebar({ 
  currentTab, 
  onSelectTab, 
  metrics = {}, 
  currentUser, 
  onLogout,
  isMobileOpen = false,
  onCloseMobile
}) {
  const { t } = useTranslation();

  const allNavItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'tickets', label: t('tickets'), icon: Ticket, badge: metrics.activeRepairs },
    { id: 'kanban', label: t('kanban'), icon: Kanban },
    { id: 'inventory', label: t('inventory'), icon: Boxes, alert: metrics.lowStockCount > 0 },
    { id: 'customers', label: t('customers'), icon: Users },
    { id: 'invoices', label: t('invoices'), icon: Receipt },
    { id: 'technicians', label: t('technicians'), icon: UserCheck },
    { id: 'track', label: t('track'), icon: SearchCheck },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  const navItems = allNavItems.filter(item => {
    if (currentUser?.role === 'technician') {
      if (item.id === 'technicians' || item.id === 'customers') return false;
    }
    if (currentUser?.role === 'frontdesk') {
      if (item.id === 'technicians') return false;
    }
    return true;
  });

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

  const handleItemClick = (id) => {
    onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavList = () => (
    <div className="p-4 space-y-1 overflow-y-auto flex-1 touch-scroll">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {t('management')}
      </p>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              isActive
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge !== undefined && item.badge > 0 && (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full shrink-0 ${
                isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {item.badge}
              </span>
            )}

            {item.alert && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" title="Low stock alert" />
            )}
          </button>
        );
      })}
    </div>
  );

  const renderBottomProfile = () => (
    <div className="mt-auto p-4 border-t border-slate-800/80 space-y-3 shrink-0 pb-safe">
      {currentUser && (
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-2">
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                {currentUser.fullName || currentUser.username}
              </span>
            </div>
            <div className="mt-1">
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${getRoleBadge(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onLogout();
              }}
              title={t('signOut')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800/60 text-xs hidden sm:block">
        <div className="flex items-center gap-2 text-slate-300 font-medium mb-0.5">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px]">{t('serviceCenterReady')}</span>
        </div>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          {t('serviceCenterDesc')}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="no-print hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 min-h-[calc(100vh-61px)] sticky top-[61px] self-start max-h-[calc(100vh-61px)] overflow-hidden">
        {renderNavList()}
        {renderBottomProfile()}
      </aside>

      {/* 2. Mobile Slide-Over Drawer & Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Sliding Panel */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
            {/* Mobile Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white leading-tight">SSC TechCare</h4>
                  <p className="text-[10px] text-slate-400">Navigation Menu</p>
                </div>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Links */}
            {renderNavList()}

            {/* Footer Profile */}
            {renderBottomProfile()}
          </div>
        </div>
      )}
    </>
  );
}
