import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Plus, 
  Phone, 
  Mail, 
  CheckCircle2, 
  X, 
  Pencil, 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Search 
} from 'lucide-react';
import { api } from '../api';

export default function Technicians({ onSelectTicket }) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ message: '', type: 'success' });

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingTech, setDeletingTech] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedTechJobs, setSelectedTechJobs] = useState(null);

  const [newTech, setNewTech] = useState({
    name: '',
    phone: '',
    email: '',
    specialization: 'Chip Level / Motherboard & Micro-soldering',
    status: 'Active'
  });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback({ message: '', type: 'success' });
    }, 4000);
  };

  const loadTechs = async () => {
    try {
      setLoading(true);
      const data = await api.getTechnicians();
      setTechnicians(data);
    } catch (err) {
      console.error('Failed to load technicians:', err);
      showFeedback('Failed to load technicians: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTechs();
  }, []);

  const handleAddTechnician = async (e) => {
    e.preventDefault();
    try {
      await api.createTechnician(newTech);
      setIsAddOpen(false);
      setNewTech({
        name: '',
        phone: '',
        email: '',
        specialization: 'General Hardware',
        status: 'Active'
      });
      showFeedback('Technician added successfully');
      loadTechs();
    } catch (err) {
      showFeedback('Failed to add technician: ' + err.message, 'error');
    }
  };

  const handleUpdateTechnician = async (e) => {
    e.preventDefault();
    if (!editingTech) return;
    setEditLoading(true);
    try {
      await api.updateTechnician(editingTech.id, {
        name: editingTech.name,
        phone: editingTech.phone,
        email: editingTech.email,
        specialization: editingTech.specialization,
        status: editingTech.status
      });
      setEditingTech(null);
      showFeedback(`Technician "${editingTech.name}" updated successfully`);
      loadTechs();
    } catch (err) {
      showFeedback('Failed to update technician: ' + err.message, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDeleteTechnician = async () => {
    if (!deletingTech) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await api.deleteTechnician(deletingTech.id);
      if (res && res.error) {
        setDeleteError(res.error);
        return;
      }
      showFeedback(res.message || `Technician "${deletingTech.name}" deleted successfully`);
      setDeletingTech(null);
      loadTechs();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete technician');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewTechJobs = async (tech) => {
    try {
      const tickets = await api.getTechnicianTickets(tech.id);
      setSelectedTechJobs({ tech, tickets: Array.isArray(tickets) ? tickets : [] });
    } catch (err) {
      console.error('Failed to load tickets for technician:', err);
    }
  };

  const filteredTechs = technicians.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.specialization && t.specialization.toLowerCase().includes(q)) ||
      (t.phone && t.phone.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Technicians</h1>
          <p className="text-sm text-slate-400">Manage hardware repair specialists, monitor active workloads & performance</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Technician</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-fadeIn shadow-lg ${
          feedback.type === 'error'
            ? 'bg-rose-950/80 border border-rose-700 text-rose-300'
            : 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
        }`}>
          {feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by technician name, specialization, phone..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
            Loading technicians...
          </div>
        ) : filteredTechs.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-500">
            {searchQuery ? 'No technicians match your search.' : 'No technicians found.'}
          </div>
        ) : (
          filteredTechs.map(t => (
            <div
              key={t.id}
              className="bg-slate-800/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Avatar, Status & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-sky-500/20 shrink-0">
                      {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{t.name}</h3>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.status === 'Active'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                          : t.status === 'On Leave'
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  </div>

                  {/* Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingTech({ ...t })}
                      title="Edit Technician"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-700/60 border border-transparent hover:border-slate-600/60 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingTech(t);
                        setDeleteError('');
                      }}
                      title="Delete Technician"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Specialization */}
                <div>
                  <p className="text-xs text-sky-400 font-medium">{t.specialization || 'General Hardware'}</p>
                </div>

                {/* Contact Information */}
                <div className="space-y-1.5 text-xs text-slate-400">
                  {t.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-slate-300">{t.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 italic">
                      <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>No phone provided</span>
                    </div>
                  )}

                  {t.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-300">{t.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 italic">
                      <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>No email provided</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Workload Stats */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/60 text-xs">
                <button
                  type="button"
                  onClick={() => handleViewTechJobs(t)}
                  title="Click to view assigned job cards"
                  className="p-2 bg-slate-800/80 hover:bg-slate-750 rounded-xl border border-slate-700/50 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block text-[11px]">Active Jobs</span>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </div>
                  <span className="font-bold text-sky-400 text-base">{t.active_jobs || 0}</span>
                </button>

                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block text-[11px]">Completed</span>
                  <span className="font-bold text-emerald-400 text-base">{t.completed_jobs || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Technician Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Technician</span>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTechnician} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Technician Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newTech.name}
                  onChange={e => setNewTech({ ...newTech, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Specialization / Expertise</label>
                <input
                  type="text"
                  placeholder="e.g. Display & Hinges, Apple MacBooks, Chip Level..."
                  value={newTech.specialization}
                  onChange={e => setNewTech({ ...newTech, specialization: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={newTech.phone}
                    onChange={e => setNewTech({ ...newTech, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="tech@service.com"
                    value={newTech.email}
                    onChange={e => setNewTech({ ...newTech, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Status</label>
                <select
                  value={newTech.status}
                  onChange={e => setNewTech({ ...newTech, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-md shadow-sky-600/20 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Technician</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Technician Modal */}
      {editingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Pencil className="w-4 h-4" />
                <span>Edit Technician</span>
              </div>
              <button onClick={() => setEditingTech(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTechnician} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Technician Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={editingTech.name}
                  onChange={e => setEditingTech({ ...editingTech, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Specialization / Expertise</label>
                <input
                  type="text"
                  placeholder="e.g. Display & Hinges, Apple MacBooks, Chip Level..."
                  value={editingTech.specialization || ''}
                  onChange={e => setEditingTech({ ...editingTech, specialization: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={editingTech.phone || ''}
                    onChange={e => setEditingTech({ ...editingTech, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="tech@service.com"
                    value={editingTech.email || ''}
                    onChange={e => setEditingTech({ ...editingTech, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Availability Status</label>
                <select
                  value={editingTech.status || 'Active'}
                  onChange={e => setEditingTech({ ...editingTech, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Active">Active (Available for Assignment)</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTech(null)}
                  disabled={editLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-sky-600/20 transition-all active:scale-95"
                >
                  {editLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Technician Modal */}
      {deletingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Delete Technician</span>
              </div>
              <button onClick={() => setDeletingTech(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shrink-0">
                  {deletingTech.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm leading-tight">{deletingTech.name}</h4>
                  <p className="text-xs text-sky-400">{deletingTech.specialization || 'General Hardware'}</p>
                </div>
              </div>

              {/* Workload info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block text-[11px]">Active Jobs</span>
                  <span className="font-bold text-sky-400 text-base">{deletingTech.active_jobs || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block text-[11px]">Completed Jobs</span>
                  <span className="font-bold text-emerald-400 text-base">{deletingTech.completed_jobs || 0}</span>
                </div>
              </div>

              {(deletingTech.active_jobs || 0) > 0 ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Active job assignments exist</p>
                    <p className="text-[11px] text-amber-400/80 leading-relaxed">
                      This technician is currently assigned to {deletingTech.active_jobs} active repair ticket(s). Deleting will safely unassign this technician from those jobs so other staff can take them over.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Are you sure you want to remove <strong className="text-slate-200">{deletingTech.name}</strong> from the workshop technician directory? This action cannot be undone.
                </p>
              )}

              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTech(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTechnician}
                disabled={deleteLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all active:scale-95"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Technician</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Assigned Jobs Modal */}
      {selectedTechJobs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <span>{selectedTechJobs.tech.name}'s Assigned Jobs</span>
                </h3>
                <p className="text-xs text-slate-400">Total: {selectedTechJobs.tickets.length} tickets</p>
              </div>
              <button onClick={() => setSelectedTechJobs(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {selectedTechJobs.tickets.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No tickets currently assigned to this technician.
                </div>
              ) : (
                selectedTechJobs.tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      if (onSelectTicket) onSelectTicket(ticket.id);
                      setSelectedTechJobs(null);
                    }}
                    className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-sky-500/50 rounded-xl cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sky-400 text-xs">{ticket.ticket_number}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold">
                        {ticket.status}
                      </span>
                    </div>
                    <div className="text-xs text-white font-medium">
                      {ticket.brand} {ticket.model}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Customer: {ticket.customer_name}</span>
                      <span className="text-amber-400 font-semibold">{ticket.priority}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
