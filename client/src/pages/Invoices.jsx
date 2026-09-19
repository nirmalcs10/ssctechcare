import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Plus, 
  Printer, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  CreditCard,
  Eye,
  X
} from 'lucide-react';
import { api } from '../api';

export default function Invoices({ onPrintInvoice, onSelectTicket, preselectedTicketId }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Create Invoice Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [ticketsList, setTicketsList] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(preselectedTicketId || '');
  const [ticketDetails, setTicketDetails] = useState(null);
  const [laborCharges, setLaborCharges] = useState('800');
  const [taxRate, setTaxRate] = useState('18');
  const [discount, setDiscount] = useState('0');
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI / QR');
  const [invoiceNotes, setInvoiceNotes] = useState('30-day hardware service warranty.');

  // Payment Modal
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');

  useEffect(() => {
    loadInvoices();
    loadTickets();
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    if (preselectedTicketId) {
      // Check if invoice already exists for this ticket
      const existing = invoices.find(inv => String(inv.ticket_id) === String(preselectedTicketId));
      if (existing) {
        if (Number(existing.balance_due) > 0) {
          setPayInvoice(existing);
          setPayAmount(String(existing.balance_due));
          setIsPayOpen(true);
        } else {
          onPrintInvoice(existing.id);
        }
        return;
      }
      setSelectedTicketId(preselectedTicketId);
      setIsCreateOpen(true);
    }
  }, [preselectedTicketId, invoices]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketForInvoice(selectedTicketId);
    } else {
      setTicketDetails(null);
    }
  }, [selectedTicketId]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;

      const data = await api.getInvoices(params);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      const list = await api.getTickets();
      setTicketsList(list);
    } catch (err) {
      console.error('Failed to load tickets list:', err);
    }
  };

  const loadTicketForInvoice = async (id) => {
    try {
      const data = await api.getTicket(id);
      setTicketDetails(data);
      // Auto-set suggested labor based on repair complexity
      if (data.parts && data.parts.length > 0) {
        setLaborCharges('1200');
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedTicketId) {
      alert('Please select a repair ticket');
      return;
    }

    try {
      const res = await api.createInvoice({
        ticket_id: selectedTicketId,
        labor_charges: parseFloat(laborCharges || 0),
        tax_rate: parseFloat(taxRate || 0),
        discount: parseFloat(discount || 0),
        amount_paid: parseFloat(amountPaidNow || 0),
        payment_method: paymentMethod,
        notes: invoiceNotes
      });

      if (res.error) {
        alert(res.error);
      } else {
        setIsCreateOpen(false);
        loadInvoices();
        onPrintInvoice(res.id);
      }
    } catch (err) {
      alert('Failed to generate invoice: ' + err.message);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payInvoice || !payAmount) return;

    try {
      await api.recordPayment(payInvoice.id, {
        amount: parseFloat(payAmount),
        payment_method: payMethod
      });

      if (payInvoice.ticket_id) {
        try {
          const t = await api.getTicket(payInvoice.ticket_id);
          if (t && t.status === 'READY_FOR_PICKUP') {
            if (confirm(`Payment recorded. Ticket ${t.ticket_number} is currently 'Ready for Pickup'. Mark device as DELIVERED now?`)) {
              await api.updateTicketStatus(
                t.id,
                'DELIVERED',
                `Payment of ₹${parseFloat(payAmount).toLocaleString()} recorded via ${payMethod}. Device delivered to customer.`,
                'Billing'
              );
            }
          }
        } catch (ignoreErr) {}
      }

      setIsPayOpen(false);
      setPayInvoice(null);
      setPayAmount('');
      loadInvoices();
    } catch (err) {
      alert('Failed to record payment: ' + err.message);
    }
  };

  // Live calculations for Create Modal
  const partsSum = ticketDetails?.parts?.reduce((acc, p) => acc + (p.total_price || 0), 0) || 0;
  const subtotal = partsSum + (parseFloat(laborCharges) || 0);
  const taxAmount = (subtotal * (parseFloat(taxRate) || 0)) / 100;
  const grandTotal = Math.max(0, subtotal + taxAmount - (parseFloat(discount) || 0));
  const advance = parseFloat(ticketDetails?.advance_paid || 0);
  const paidNow = parseFloat(amountPaidNow || 0);
  const balanceDue = Math.max(0, grandTotal - advance - paidNow);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Tax Invoices</h1>
          <p className="text-sm text-slate-400">Generate customer receipts, compute labor + parts, and manage collections</p>
        </div>
        <button
          onClick={() => {
            setSelectedTicketId('');
            setTicketDetails(null);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Invoice</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
          {['ALL', 'Paid', 'Partial', 'Unpaid'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'ALL' ? 'All Invoices' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, customer, ticket..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No invoices generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Create an invoice from an active repair ticket.</p>
          </div>
        ) : (
          <div className="overflow-x-auto touch-scroll overscroll-y-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[750px]">
              <thead className="bg-slate-800/80 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Invoice # / Date</th>
                  <th className="py-3 px-4">Ticket Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                  <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-sky-400 text-xs">{inv.invoice_number}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(inv.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs">
                      <button
                        onClick={() => onSelectTicket(inv.ticket_id)}
                        className="text-slate-300 hover:text-sky-400 underline font-semibold"
                      >
                        {inv.ticket_number}
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{inv.customer_name}</div>
                      <div className="text-slate-400 text-xs">{inv.customer_phone}</div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {inv.device_brand} {inv.device_model}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ₹{parseFloat(inv.grand_total).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <span className={inv.balance_due > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        ₹{parseFloat(inv.balance_due).toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        inv.payment_status === 'Paid'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : inv.payment_status === 'Partial'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.balance_due > 0 && (
                          <button
                            onClick={() => {
                              setPayInvoice(inv);
                              setPayAmount(inv.balance_due);
                              setIsPayOpen(true);
                            }}
                            className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 text-xs font-semibold rounded border border-emerald-800 transition-colors"
                          >
                            Receive Pay
                          </button>
                        )}
                        <button
                          onClick={() => onPrintInvoice(inv.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors"
                          title="Print Tax Invoice"
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

      {/* Create Invoice Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Generate Repair Tax Invoice</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              {/* Select ticket */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Repair Job Ticket *</label>
                <select
                  value={selectedTicketId}
                  onChange={e => setSelectedTicketId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">-- Choose Ticket --</option>
                  {ticketsList.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.ticket_number} - {t.customer_name} ({t.brand} {t.model})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Ticket Summary */}
              {ticketDetails && (
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Customer: <strong className="text-white">{ticketDetails.customer_name}</strong></span>
                    <span>Device: <strong className="text-white">{ticketDetails.brand} {ticketDetails.model}</strong></span>
                  </div>
                  {ticketDetails.parts && ticketDetails.parts.length > 0 && (
                    <div className="text-slate-400">
                      <span>Parts Installed: </span>
                      {ticketDetails.parts.map(p => `${p.quantity}x ${p.part_name} (₹${p.total_price})`).join(', ')}
                    </div>
                  )}
                  {ticketDetails.advance_paid > 0 && (
                    <div className="text-emerald-400 font-medium">
                      Advance deposit recorded: ₹{parseFloat(ticketDetails.advance_paid).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Billing Numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Labor / Service Charge (₹)</label>
                  <input
                    type="number"
                    value={laborCharges}
                    onChange={e => setLaborCharges(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Calculation Preview Card */}
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Parts Subtotal:</span>
                  <span>₹{partsSum.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Labor Fees:</span>
                  <span>₹{(parseFloat(laborCharges) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax Amount ({taxRate}%):</span>
                  <span>₹{taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm border-t border-slate-700 pt-1.5">
                  <span>Grand Total:</span>
                  <span className="text-sky-400">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Advance Deducted:</span>
                  <span>-₹{advance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-dashed border-slate-700 pt-1 text-white">
                  <span>Remaining Balance:</span>
                  <span className={balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    ₹{balanceDue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount Paid Now (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. Full or partial amount"
                    value={amountPaidNow}
                    onChange={e => setAmountPaidNow(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="UPI / QR">UPI / QR</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-lg font-semibold"
                >
                  Generate Invoice & Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayOpen && payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              Receive Payment: <span className="text-sky-400">{payInvoice.invoice_number}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Customer: <span className="font-semibold text-white">{payInvoice.customer_name}</span> | Outstanding: <span className="font-bold text-rose-400">₹{payInvoice.balance_due.toLocaleString()}</span>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount to Pay (₹) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
