import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Printer, 
  Receipt, 
  Laptop, 
  Clock, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Tickets' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'IN_DIAGNOSIS', label: 'In Diagnosis' },
  { id: 'IN_REPAIR', label: 'In Repair' },
  { id: 'TESTING_QC', label: 'Testing & QC' },
  { id: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { id: 'DELIVERED', label: 'Delivered' }
];

export default function Tickets({ onSelectTicket, onOpenNewTicket, onPrintJobCard }) {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedTech, setSelectedTech] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTechs();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [selectedStatus, selectedPriority, selectedTech, searchQuery]);

  const loadTechs = async () => {
    try {
      const data = await api.getTechnicians();
      setTechnicians(data);
    } catch (err) {
      console.error('Failed to load technicians', err);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedPriority !== 'ALL') params.priority = selectedPriority;
      if (selectedTech !== 'ALL') params.technician_id = selectedTech;
      if (searchQuery) params.search = searchQuery;

      const data = await api.getTickets(params);
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Repair Job Cards & Tickets</h1>
          <p className="text-sm text-slate-400">Track and manage hardware intake, technician assignments & progress</p>
        </div>
        <button
          onClick={onOpenNewTicket}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Repair Ticket</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Status Scrollable Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none touch-scroll">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === tab.id
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket #, customer, phone, serial, model..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Priority Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent Only</option>
              <option value="High">High Priority</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Technician Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading repair tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Laptop className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No repair tickets found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or create a new job card.</p>
          </div>
        ) : (
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-left text-xs sm:text-sm min-w-[750px]">
              <thead className="bg-slate-800/80 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Ticket / Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Device Details</th>
                  <th className="py-3 px-4">Issue Reported</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {tickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    onClick={() => onSelectTicket(ticket.id)}
                  >
                    {/* Ticket # & Check-in Date */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-sky-400 text-sm group-hover:text-sky-300 flex items-center gap-1.5">
                        <span>{ticket.ticket_number}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(ticket.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{ticket.customer_name}</div>
                      <div className="text-slate-400 text-xs">{ticket.customer_phone}</div>
                    </td>

                    {/* Device Specs */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                          {ticket.device_type}
                        </span>
                        <span>{ticket.brand} {ticket.model}</span>
                      </div>
                      {ticket.serial_number && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          S/N: {ticket.serial_number}
                        </div>
                      )}
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="line-clamp-2 text-xs text-slate-300 font-medium">
                        {ticket.problem_description}
                      </p>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ticket.status} />
                    </td>

                    {/* Priority Badge */}
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={ticket.priority} />
                    </td>

                    {/* Technician */}
                    <td className="py-3.5 px-4 text-xs">
                      {ticket.technician_name ? (
                        <div>
                          <span className="text-slate-200 font-medium">{ticket.technician_name}</span>
                          {(ticket.technician_status === 'On Leave' || ticket.technician_status?.toLowerCase().includes('leave')) && (
                            <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Today on leave
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectTicket(ticket.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="View Job Card"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onPrintJobCard(ticket.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition-colors"
                          title="Print Job Card"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
