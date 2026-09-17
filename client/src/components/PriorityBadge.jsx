import React from 'react';
import { AlertTriangle, AlertCircle, ArrowDown, ArrowRight } from 'lucide-react';

export default function PriorityBadge({ priority }) {
  switch (priority) {
    case 'Urgent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-800 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          Urgent
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400 border border-amber-800">
          <AlertTriangle className="w-3 h-3" />
          High
        </span>
      );
    case 'Low':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <ArrowDown className="w-3 h-3" />
          Low
        </span>
      );
    case 'Normal':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-900">
          <ArrowRight className="w-3 h-3" />
          Normal
        </span>
      );
  }
}
