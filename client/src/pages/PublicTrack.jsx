import React, { useState } from 'react';
import { 
  Search, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  Phone, 
  MapPin, 
  Laptop, 
  ShieldCheck, 
  AlertCircle,
  PackageCheck
} from 'lucide-react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';

const STAGE_MILESTONES = [
  { id: 'RECEIVED', label: 'Device Received' },
  { id: 'IN_DIAGNOSIS', label: 'Diagnosis & Inspection' },
  { id: 'IN_REPAIR', label: 'Repair in Progress' },
  { id: 'TESTING_QC', label: 'Testing & Quality Check' },
  { id: 'READY_FOR_PICKUP', label: 'Ready for Collection' }
];

export default function PublicTrack({ onBackToLogin, isLoggedIn }) {
  const [identifier, setIdentifier] = useState('REP-2026-0001');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await api.trackTicket(identifier.trim());
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || 'Unable to locate ticket');
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = result?.ticket?.status;

  const isStageDone = (stageId) => {
    const order = ['RECEIVED', 'IN_DIAGNOSIS', 'QUOTATION_PENDING', 'APPROVED', 'WAITING_PARTS', 'IN_REPAIR', 'TESTING_QC', 'READY_FOR_PICKUP', 'DELIVERED'];
    const currIdx = order.indexOf(currentStatus);
    const stageIdx = order.indexOf(stageId);
    return currIdx >= stageIdx;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {onBackToLogin && (
        <div className="flex justify-end">
          <button
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:text-white transition-all shadow-sm"
          >
            <span>{isLoggedIn ? '← Back to Management Desk' : 'Staff Sign In →'}</span>
          </button>
        </div>
      )}

      {/* Tracking Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Customer Live Self-Service Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Track Your Computer Repair</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Enter your Ticket Number (e.g. REP-2026-0001) or 10-digit registered phone number to view live workshop updates.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            required
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="Enter Ticket # (REP-...) or Mobile Phone"
            className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-lg text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-sky-500/25 transition-all active:scale-95 disabled:opacity-50 shrink-0"
        >
          {loading ? 'Tracking...' : 'Check Status'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Result View */}
      {result && (
        <div className="bg-slate-800/50 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 animate-in fade-in duration-300">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
            <div>
              <span className="text-xs font-mono font-bold text-sky-400">
                Ticket: {result.ticket.ticket_number}
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                {result.ticket.brand} {result.ticket.model}
              </h2>
              <p className="text-xs text-slate-400">
                Registered to: <strong className="text-slate-200">{result.ticket.customer_name}</strong>
              </p>
            </div>
            <div>
              <StatusBadge status={result.ticket.status} size="lg" />
            </div>
          </div>

          {/* Ready For Pickup Notification Banner */}
          {result.ticket.status === 'READY_FOR_PICKUP' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-500/40 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <PackageCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-300 text-base">Your device is ready for collection!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Quality check has passed. You can visit our service center anytime during business hours to pick up your device.
                </p>
                <div className="flex items-center gap-4 text-xs text-emerald-400 mt-2 font-medium">
                  <span>📍 {result.shop?.shop_address}</span>
                  <span>📞 {result.shop?.shop_phone}</span>
                </div>
              </div>
            </div>
          )}

          {/* Visual Milestone Stepper */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Repair Progress Milestones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {STAGE_MILESTONES.map((m, idx) => {
                const done = isStageDone(m.id);
                const isCurrent = currentStatus === m.id;
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isCurrent
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold ring-1 ring-sky-500'
                        : done
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-400 font-medium'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-500'
                    }`}
                  >
                    <div className="flex justify-center mb-1.5">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <span className="text-xs block">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
            <div>
              <span className="text-slate-400 block mb-1">Customer Reported Fault:</span>
              <p className="text-white font-medium">{result.ticket.problem_description}</p>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Estimated Completion Date:</span>
              <p className="text-white font-semibold">
                {result.ticket.estimated_delivery
                  ? new Date(result.ticket.estimated_delivery).toLocaleDateString('en-GB')
                  : 'Diagnosis in progress'}
              </p>
            </div>
          </div>

          {/* Timeline Milestones */}
          {result.timeline && result.timeline.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Service Activity Updates
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.timeline.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-white block">{item.action}</span>
                      <span className="text-slate-400">{item.description}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 ml-4">
                      {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shop Support Contact Card */}
          <div className="pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              <p className="font-semibold text-white">{result.shop?.shop_name}</p>
              <p>{result.shop?.shop_address}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${result.shop?.shop_phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium border border-slate-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-sky-400" />
                <span>Call Center</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
