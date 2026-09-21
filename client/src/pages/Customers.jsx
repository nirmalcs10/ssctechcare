import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Laptop, 
  Receipt, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  CreditCard, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { api } from '../api';
import EditCustomerModal from '../components/EditCustomerModal';

export default function Customers({ onSelectTicket, onNavigate }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [forceDeleteConfirm, setForceDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    alt_phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(searchQuery);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  const handleSelectCustomer = async (id) => {
    try {
      const data = await api.getCustomer(id);
      setSelectedCustomer(data);
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createCustomer(newCust);
      if (res.error) {
        alert(res.error);
      } else {
        setIsAddOpen(false);
        setNewCust({ name: '', phone: '', alt_phone: '', email: '', address: '', notes: '' });
        loadCustomers();
      }
    } catch (err) {
      alert('Failed to register customer: ' + err.message);
    }
  };

  const handleInitiateDelete = (customer) => {
    setDeletingCustomer(customer);
    setForceDeleteConfirm(false);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const needForce = (deletingCustomer.total_tickets || 0) > 0 || forceDeleteConfirm;
      const res = await api.deleteCustomer(deletingCustomer.id, needForce);
      if (res && res.error) {
        setDeleteError(res.error);
        setIsDeleting(false);
        return;
      }
      if (selectedCustomer && selectedCustomer.id === deletingCustomer.id) {
        setSelectedCustomer(null);
      }
      setDeletingCustomer(null);
      setForceDeleteConfirm(false);
      loadCustomers();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete customer');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Database & Repair History</h1>
          <p className="text-sm text-slate-400">View client contact profiles, past serviced laptops, and total billing history</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, phone number, email..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-500">
            No customers found.
          </div>
        ) : (
          customers.map(c => (
            <div
              key={c.id}
              onClick={() => handleSelectCustomer(c.id)}
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-lg space-y-3 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">{c.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-sky-400 mt-1 font-medium">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{c.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600">
                    {c.total_tickets || 0} repairs
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(c);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-700/60 transition-colors"
                    title="Edit Customer Details"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInitiateDelete(c);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {c.email && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}

              {c.address && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{c.address}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Billed:</span>
                  <span className="font-bold text-slate-200">₹{parseFloat(c.total_spent || 0).toLocaleString()}</span>
                </div>
                {Number(c.total_due || 0) > 0 ? (
                  <div className="flex items-center gap-1 font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/25">
                    <span>Due:</span>
                    <span>₹{Number(c.total_due).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25 text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Settled</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Profile Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400">Customer ID #{selectedCustomer.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(selectedCustomer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                  title="Edit Customer Information"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Info</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInitiateDelete(selectedCustomer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold border border-rose-500/30 transition-colors"
                  title="Delete Customer Profile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-sky-400" />
                <span className="font-semibold">{selectedCustomer.phone}</span>
                {selectedCustomer.alt_phone && (
                  <span className="text-slate-500">/ {selectedCustomer.alt_phone}</span>
                )}
              </div>
              {selectedCustomer.email && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.address && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>{selectedCustomer.address}</span>
                </div>
              )}
            </div>

            {/* Financial Overview Card */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-800/80 border border-slate-750 rounded-xl">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Total Billed</p>
                <p className="text-base font-bold text-white mt-0.5">
                  ₹{Number(selectedCustomer.total_spent || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Outstanding Due</p>
                <p className={`text-base font-bold mt-0.5 ${Number(selectedCustomer.total_due || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ₹{Number(selectedCustomer.total_due || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Invoices & Billing History */}
            {selectedCustomer.invoices && selectedCustomer.invoices.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Invoices & Billing ({selectedCustomer.invoices.length})</span>
                </h4>
                <div className="space-y-2.5">
                  {selectedCustomer.invoices.map(inv => {
                    const billed = Number(inv.grand_total) || 0;
                    const paid = Number(inv.amount_paid) || 0;
                    const due = Number(inv.balance_due) || 0;
                    const isPaid = inv.payment_status === 'Paid' || due === 0;
                    return (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-400">{inv.invoice_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                          }`}>
                            {inv.payment_status || (due === 0 ? 'Paid' : 'Unpaid')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 text-[11px]">
                          <span>Billed: ₹{billed.toLocaleString()}</span>
                          <span>Paid: ₹{paid.toLocaleString()}</span>
                          <span className={due > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            Due: ₹{due.toLocaleString()}
                          </span>
                        </div>
                        {due > 0 && onNavigate && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(null);
                              onNavigate('invoices', { invoiceId: inv.id });
                            }}
                            className="w-full py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Collect Payment / Settle (₹{due.toLocaleString()})</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Repair History List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                <span>Service & Repair History ({selectedCustomer.tickets ? selectedCustomer.tickets.length : 0})</span>
              </h4>
              <div className="space-y-3">
                {selectedCustomer.tickets && selectedCustomer.tickets.length === 0 ? (
                  <p className="text-xs text-slate-500">No repair tickets recorded yet.</p>
                ) : (
                  selectedCustomer.tickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedCustomer(null);
                        onSelectTicket(t.id);
                      }}
                      className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl space-y-1.5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-sky-400">{t.ticket_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200">
                          {t.status}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-white">
                        {t.brand} {t.model} ({t.device_type})
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{t.problem_description}</p>
                      <div className="text-[10px] text-slate-500 pt-1 flex justify-between items-center">
                        <span>{new Date(t.created_at).toLocaleDateString('en-GB')}</span>
                        {t.grand_total ? (
                          <span className="font-bold text-emerald-400">₹{parseFloat(t.grand_total).toLocaleString()}</span>
                        ) : t.estimated_cost ? (
                          <span className="text-slate-400">Est: ₹{parseFloat(t.estimated_cost).toLocaleString()}</span>
                        ) : null}
                      </div>
                      {onNavigate && ['READY_FOR_PICKUP', 'DELIVERED', 'RESOLVED'].includes(t.status) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(null);
                            onNavigate('invoices', { ticketId: t.id });
                          }}
                          className="w-full mt-2 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Generate / View Invoice</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Register New Customer</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={newCust.name}
                  onChange={e => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9811223344"
                    value={newCust.phone}
                    onChange={e => setNewCust({ ...newCust, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={newCust.alt_phone}
                    onChange={e => setNewCust({ ...newCust, alt_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={newCust.email}
                  onChange={e => setNewCust({ ...newCust, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Address / Landmark</label>
                <textarea
                  rows={2}
                  placeholder="Address or area"
                  value={newCust.address}
                  onChange={e => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <EditCustomerModal
          isOpen={!!editingCustomer}
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={(updated) => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            if (selectedCustomer && selectedCustomer.id === updated.id) {
              setSelectedCustomer(prev => ({ ...prev, ...updated }));
            }
            loadCustomers();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 border-rose-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">Delete Customer Profile</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to remove this customer record?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer Summary Box */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Name:</span>
                <span className="font-semibold text-white">{deletingCustomer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono text-sky-400">{deletingCustomer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Repair History:</span>
                <span className="font-semibold text-amber-400">{deletingCustomer.total_tickets || 0} Tickets</span>
              </div>
            </div>

            {/* Conditional Warning if has tickets */}
            {(deletingCustomer.total_tickets || 0) > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Associated repair records exist</p>
                    <p className="text-[11px] text-amber-400/80 leading-relaxed">
                      This customer is linked to {deletingCustomer.total_tickets} repair ticket(s) and invoices. Deleting this customer will also permanently delete those tickets, spare parts logs, and invoices.
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forceDeleteConfirm}
                    onChange={(e) => setForceDeleteConfirm(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-900 w-4 h-4"
                  />
                  <span className="text-xs text-slate-300">
                    I understand this action is permanent and wish to delete this customer along with all associated tickets.
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                This customer has no repair history and can be safely deleted.
              </p>
            )}

            {/* Error banner */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || ((deletingCustomer.total_tickets || 0) > 0 && !forceDeleteConfirm)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/50 disabled:text-rose-400/50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{(deletingCustomer.total_tickets || 0) > 0 ? 'Force Delete Customer' : 'Delete Customer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
