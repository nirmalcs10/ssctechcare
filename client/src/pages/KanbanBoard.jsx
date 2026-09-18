import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Clock, 
  User, 
  Laptop, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import PriorityBadge from '../components/PriorityBadge';

const KANBAN_COLUMNS = [
  { id: 'RECEIVED', label: 'Received / Intake', color: 'border-slate-700 bg-slate-800/40 text-slate-300' },
  { id: 'IN_DIAGNOSIS', label: 'In Diagnosis', color: 'border-cyan-800/60 bg-cyan-950/20 text-cyan-400' },
  { id: 'WAITING_PARTS', label: 'Waiting for Parts', color: 'border-purple-800/60 bg-purple-950/20 text-purple-400' },
  { id: 'IN_REPAIR', label: 'In Repair', color: 'border-sky-800/60 bg-sky-950/20 text-sky-400' },
  { id: 'TESTING_QC', label: 'Testing & QC', color: 'border-teal-800/60 bg-teal-950/20 text-teal-400' },
  { id: 'READY_FOR_PICKUP', label: 'Ready for Pickup', color: 'border-emerald-800/60 bg-emerald-950/20 text-emerald-400' }
];

export default function KanbanBoard({ onSelectTicket, onOpenNewTicket }) {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTech, setSelectedTech] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ticketsData, techsData] = await Promise.all([
        api.getTickets(),
        api.getTechnicians()
      ]);
      setTickets(ticketsData);
      setTechnicians(techsData);
    } catch (err) {
      console.error('Failed to load Kanban data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveStatus = async (ticketId, currentStatus, direction) => {
    const colIds = KANBAN_COLUMNS.map(c => c.id);
    const currentIndex = colIds.indexOf(currentStatus);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < colIds.length) {
      const targetStatus = colIds[newIndex];
      try {
        await api.updateTicketStatus(ticketId, targetStatus, `Moved to ${targetStatus} on Kanban board`, 'Technician');
        // Update local state smoothly
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: targetStatus } : t));
      } catch (err) {
        alert('Failed to update status: ' + err.message);
      }
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (selectedTech !== 'ALL' && String(t.technician_id) !== String(selectedTech)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Technician Workbench & Workflow</h1>
          <p className="text-sm text-slate-400">Visual staging pipeline across hardware intake, diagnosis, repair & QC</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter by tech */}
          <select
            value={selectedTech}
            onChange={e => setSelectedTech(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Technicians</option>
            {technicians.filter(t => t.status !== 'Inactive').map(t => {
              const isLeave = t.status === 'On Leave' || t.status?.toLowerCase().includes('leave');
              return (
                <option key={t.id} value={t.id}>
                  {t.name} {isLeave ? '(Today on leave)' : ''}
                </option>
              );
            })}
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="Refresh Board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[650px] overflow-x-auto touch-scroll pb-4">
        {KANBAN_COLUMNS.map((col, colIdx) => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className={`rounded-2xl border ${col.color} p-3 flex flex-col shrink-0 min-w-[260px] lg:min-w-0`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider">{col.label}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white">
                  {colTickets.length}
                </span>
              </div>

              {/* Tickets in this column */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTickets.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                    No jobs
                  </div>
                ) : (
                  colTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket.id)}
                      className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/50 rounded-xl p-3 shadow-md space-y-2 cursor-pointer transition-all hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-sky-400 group-hover:text-sky-300">
                          {ticket.ticket_number}
                        </span>
                        <PriorityBadge priority={ticket.priority} />
                      </div>

                      <div>
                        <h4 className="font-semibold text-xs text-white line-clamp-1">
                          {ticket.brand} {ticket.model}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {ticket.problem_description}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700/50">
                        <span>{ticket.customer_name}</span>
                        <span className="text-slate-300 font-medium flex items-center gap-1">
                          <span>{ticket.technician_name ? ticket.technician_name.split(' ')[0] : 'Unassigned'}</span>
                          {(ticket.technician_status === 'On Leave' || ticket.technician_status?.toLowerCase().includes('leave')) && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold" title="Today this technician is on leave">
                              On Leave
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Move status buttons */}
                      <div 
                        className="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[10px]"
                        onClick={e => e.stopPropagation()}
                      >
                        {colIdx > 0 ? (
                          <button
                            onClick={() => handleMoveStatus(ticket.id, ticket.status, -1)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white flex items-center gap-0.5"
                            title="Move to previous stage"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            <span>Back</span>
                          </button>
                        ) : <div />}

                        {colIdx < KANBAN_COLUMNS.length - 1 ? (
                          <button
                            onClick={() => handleMoveStatus(ticket.id, ticket.status, 1)}
                            className="p-1 rounded hover:bg-slate-700 text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-medium ml-auto"
                            title="Move to next stage"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : <div />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
