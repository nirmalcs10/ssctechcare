import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  PackageX, 
  ArrowUpRight, 
  ChevronRight,
  TrendingUp,
  Laptop,
  Cpu,
  Plus
} from 'lucide-react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { formatTime } from '../utils/date';
import RevenueModal from '../components/RevenueModal';

export default function Dashboard({ onSelectTicket, onOpenNewTicket, onNavigate, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData({
        ...res,
        urgentTickets: Array.isArray(res?.urgentTickets) ? res.urgentTickets : [],
        lowStockItems: Array.isArray(res?.lowStockItems) ? res.lowStockItems : [],
        deviceBreakdown: Array.isArray(res?.deviceBreakdown) ? res.deviceBreakdown : [],
        recentActivity: Array.isArray(res?.recentActivity) ? res.recentActivity : [],
        totalRevenue: res?.totalRevenue != null ? Number(res.totalRevenue) : null,
        totalPending: res?.totalPending != null ? Number(res.totalPending) : null,
        activeRepairs: Number(res?.activeRepairs) || 0,
        readyForPickup: Number(res?.readyForPickup) || 0,
        deliveredCount: Number(res?.deliveredCount) || 0,
        inRepairCount: Number(res?.inRepairCount) || 0,
        inDiagnosisCount: Number(res?.inDiagnosisCount) || 0
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading service center metrics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Operations Control</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time overview of active repair jobs, hardware diagnosis, and technician workbench.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewTicket}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Intake New Device</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${currentUser?.role === 'frontdesk' ? 'lg:grid-cols-5' : 'lg:grid-cols-6'} gap-4`}>
        {/* Active Repairs */}
        <div 
          onClick={() => onNavigate('tickets')}
          className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Jobs</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{data.activeRepairs}</div>
          <div className="text-[11px] text-sky-400/80 mt-1 flex items-center gap-1">
            <span>In Workshop</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* In Diagnosis */}
        <div 
          onClick={() => onNavigate('kanban')}
          className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">In Diagnosis</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{data.inDiagnosisCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Inspection bench</div>
        </div>

        {/* In Repair */}
        <div 
          onClick={() => onNavigate('kanban')}
          className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Under Repair</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-400">{data.inRepairCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Hardware / Chip level</div>
        </div>

        {/* Ready for Pickup */}
        <div 
          onClick={() => onNavigate('tickets')}
          className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Ready for Pickup</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{data.readyForPickup}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">QC passed</div>
        </div>

        {/* Delivered / Completed */}
        <div className="bg-slate-800/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Delivered</span>
            <div className="p-2 rounded-xl bg-slate-700/50 text-slate-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-200">{data.deliveredCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">All time jobs</div>
        </div>

        {/* Total Revenue (Hidden/Removed for Front Desk) */}
        {data.totalRevenue != null && currentUser?.role !== 'frontdesk' && (
          <div 
            onClick={() => setIsRevenueModalOpen(true)}
            className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-2xl cursor-pointer transition-all group hover:shadow-lg hover:shadow-emerald-500/10"
            title="Click to view total revenue, customer dues, monthly profit, purchases & unused stock"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium group-hover:text-emerald-400 transition-colors">Revenue & Dues</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-white">₹{Number(data.totalRevenue || 0).toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Due: <strong className="text-rose-400">₹{data.totalPending != null ? Number(data.totalPending).toLocaleString() : '0'}</strong></span>
              <span className="text-[10px] text-emerald-400 font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Breakdown &rarr;</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Urgent Jobs & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent & High Priority Active Repairs */}
        <div className="lg:col-span-2 bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Priority & Urgent Repairs</h3>
            </div>
            <button
              onClick={() => onNavigate('tickets')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              View all tickets <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {data.urgentTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No urgent repair jobs currently pending.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {data.urgentTickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket.id)}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/60 px-3 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {ticket.ticket_number}
                      </span>
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} size="xs" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {ticket.brand} {ticket.model}
                    </p>
                    <p className="text-xs text-slate-400">
                      Customer: <span className="text-slate-300">{ticket.customer_name}</span> ({ticket.customer_phone})
                    </p>
                  </div>

                  <div className="text-right space-y-1 shrink-0">
                    <span className="text-xs text-slate-400 block">
                      Tech: <span className="text-slate-200">{ticket.technician_name || 'Unassigned'}</span>
                    </span>
                    {ticket.estimated_delivery && (
                      <span className="text-[11px] text-slate-400 block">
                        Est: {new Date(ticket.estimated_delivery).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Low Stock Alerts & Device Breakdown */}
        <div className="space-y-6">
          {/* Low Stock Widget */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <PackageX className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">Low Stock Spare Parts</h3>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
              >
                Manage <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data.lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">All inventory parts are adequately stocked.</p>
            ) : (
              <div className="space-y-2.5">
                {data.lowStockItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => onNavigate('inventory')}
                    className="p-2.5 bg-slate-800/70 hover:bg-slate-800 border border-amber-500/20 hover:border-amber-500/40 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200 group-hover:text-white truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {item.sku}
                        {item.category && <span className="ml-1.5 text-slate-500 font-sans">• {item.category}</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/90 text-amber-400 border border-amber-800/80 whitespace-nowrap min-w-[68px] text-center tabular-nums shadow-sm">
                        {item.stock_quantity} left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Device Type Distribution */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                <Laptop className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Device Intake Breakdown</h3>
            </div>
            <div className="space-y-2">
              {data.deviceBreakdown.map(item => (
                <div key={item.device_type} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.device_type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-sky-500 h-full rounded-full" 
                        style={{ width: `${Math.min(100, (item.count / data.activeRepairs || 1) * 100)}%` }}
                      />
                    </div>
                    <span className="font-bold text-white font-mono w-4 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Workshop Activity */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Recent Workshop Activity & Logs</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.recentActivity.map(act => (
            <div key={act.id} className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono font-bold text-sky-400">{act.ticket_number}</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {formatTime(act.created_at)}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{act.action}</p>
              <p className="text-xs text-slate-400 line-clamp-2">{act.description}</p>
              <p className="text-[10px] text-slate-500">By: {act.actor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue & Financial Breakdown Modal */}
      <RevenueModal
        isOpen={isRevenueModalOpen}
        onClose={() => setIsRevenueModalOpen(false)}
        onNavigate={onNavigate}
        onSettleInvoice={(invoiceId) => {
          setIsRevenueModalOpen(false);
          onNavigate('invoices', { invoiceId });
        }}
      />
    </div>
  );
}
