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
  Shield
} from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export default function Sidebar({ currentTab, onSelectTab, metrics = {}, currentUser, onLogout }) {
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

  return (
    <aside className="no-print w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-4 space-y-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          {t('management')}
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}

              {item.alert && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Low stock alert" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-slate-800/80 space-y-3">
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
                onClick={onLogout}
                title={t('signOut')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800/60 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium mb-0.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px]">{t('serviceCenterReady')}</span>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            {t('serviceCenterDesc')}
          </p>
        </div>
      </div>
    </aside>
  );
}
