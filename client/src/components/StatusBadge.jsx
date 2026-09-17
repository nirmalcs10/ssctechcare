import React from 'react';
import { 
  Inbox, 
  Search, 
  FileText, 
  CheckCircle, 
  Package, 
  Wrench, 
  Activity, 
  CheckCheck, 
  Archive, 
  XCircle 
} from 'lucide-react';

export const STATUS_CONFIG = {
  RECEIVED: {
    label: 'Received',
    color: 'bg-slate-800 text-slate-200 border-slate-700',
    icon: Inbox
  },
  IN_DIAGNOSIS: {
    label: 'In Diagnosis',
    color: 'bg-cyan-950 text-cyan-400 border-cyan-800',
    icon: Search
  },
  QUOTATION_PENDING: {
    label: 'Quotation Pending',
    color: 'bg-amber-950 text-amber-400 border-amber-800',
    icon: FileText
  },
  APPROVED: {
    label: 'Approved by Customer',
    color: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    icon: CheckCircle
  },
  WAITING_PARTS: {
    label: 'Waiting for Parts',
    color: 'bg-purple-950 text-purple-400 border-purple-800',
    icon: Package
  },
  IN_REPAIR: {
    label: 'In Repair',
    color: 'bg-sky-950 text-sky-400 border-sky-800',
    icon: Wrench
  },
  TESTING_QC: {
    label: 'Testing & QC',
    color: 'bg-teal-950 text-teal-300 border-teal-800',
    icon: Activity
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    color: 'bg-green-950 text-green-300 border-green-700 font-semibold ring-1 ring-green-500/30',
    icon: CheckCheck
  },
  DELIVERED: {
    label: 'Delivered / Closed',
    color: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    icon: Archive
  },
  CANCELLED: {
    label: 'Cancelled / Returned',
    color: 'bg-rose-950 text-rose-400 border-rose-800',
    icon: XCircle
  }
};

export default function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-slate-800 text-slate-400 border-slate-700',
    icon: Activity
  };

  const Icon = config.icon;
  const sizeClasses = size === 'lg' 
    ? 'px-3 py-1.5 text-sm gap-2' 
    : size === 'xs'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-full border ${config.color} ${sizeClasses} transition-all`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}
