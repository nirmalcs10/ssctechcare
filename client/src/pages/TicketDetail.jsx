import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Receipt, 
  Phone, 
  Mail, 
  MapPin, 
  Laptop, 
  Key, 
  Eye, 
  EyeOff, 
  Wrench, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Send, 
  Clock, 
  AlertCircle,
  Calendar,
  DollarSign,
  Package,
  Activity,
  Cpu,
  Edit,
  X,
  Truck,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import EditCustomerModal from '../components/EditCustomerModal';
import { formatDateTime } from '../utils/date';

const WORKFLOW_STEPS = [
  'RECEIVED',
  'IN_DIAGNOSIS',
  'QUOTATION_PENDING',
  'APPROVED',
  'WAITING_PARTS',
  'IN_REPAIR',
  'TESTING_QC',
  'READY_FOR_PICKUP',
  'DELIVERED'
];

export default function TicketDetail({ 
  ticketId, 
  onBack, 
  onPrintJobCard, 
  onGenerateInvoice, 
  onViewInvoice,
  currentUser,
  initialAction,
  onClearAction
}) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);

  // Note form state
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineActor, setTimelineActor] = useState('Technician');

  // Add Part modal state
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partSerialNo, setPartSerialNo] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partPrice, setPartPrice] = useState('');
  const [customPartName, setCustomPartName] = useState('');
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignTechId, setReassignTechId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);

  // Delivery & Payment Modal state
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState('Cash');
  const [deliveryPaymentAmount, setDeliveryPaymentAmount] = useState('');
  const [deliveryMarkDelivered, setDeliveryMarkDelivered] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  useEffect(() => {
    loadTicketData();
    loadAuxData();
  }, [ticketId]);

  useEffect(() => {
    if (initialAction === 'deliver' && ticket) {
      handleOpenDelivery();
      if (onClearAction) onClearAction();
    }
  }, [initialAction, ticket]);

  const handleOpenDelivery = () => {
    if (ticket?.invoice) {
      setDeliveryPaymentAmount(String(ticket.invoice.balance_due ?? 0));
    }
    setIsDeliveryModalOpen(true);
  };

  const handleRecordDeliveryPayment = async (e) => {
    if (e) e.preventDefault();
    if (!ticket?.invoice) return;

    const amt = parseFloat(deliveryPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setDeliveryLoading(true);
    try {
      await api.recordPayment(ticket.invoice.id, {
        amount: amt,
        payment_method: deliveryPaymentMethod
      });

      if (deliveryMarkDelivered) {
        await api.updateTicketStatus(
          ticket.id,
          'DELIVERED',
          `Device handed over to customer. Collected ₹${amt.toLocaleString()} via ${deliveryPaymentMethod}.`,
          currentUser?.fullName || 'Staff'
        );
      }

      setIsDeliveryModalOpen(false);
      await loadTicketData();
    } catch (err) {
      alert('Payment recording failed: ' + err.message);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleConfirmDirectDelivery = async () => {
    if (!confirm('Mark device as Delivered & handed over to customer?')) return;
    setDeliveryLoading(true);
    try {
      await api.updateTicketStatus(
        ticket.id,
        'DELIVERED',
        'Device handed over to customer.',
        currentUser?.fullName || 'Staff'
      );
      setIsDeliveryModalOpen(false);
      await loadTicketData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleReassignTechnician = async (e) => {
    e.preventDefault();
    setReassignLoading(true);
    try {
      await api.updateTicket(ticket.id, { technician_id: reassignTechId });
      setIsReassignOpen(false);
      loadTicketData();
    } catch (err) {
      alert('Failed to reassign technician: ' + err.message);
    } finally {
      setReassignLoading(false);
    }
  };

  const loadTicketData = async () => {
    try {
      setLoading(true);
      const data = await api.getTicket(ticketId);
      setTicket(data);
    } catch (err) {
      console.error('Failed to load ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    try {
      const [techs, inv] = await Promise.all([
        api.getTechnicians(),
        api.getInventory()
      ]);
      setTechnicians(techs);
      setInventoryList(inv);
    } catch (err) {
      console.error('Failed to load aux data:', err);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateTicketStatus(ticket.id, newStatus, '', 'Technician');
      loadTicketData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!timelineNote.trim()) return;

    try {
      await api.addTimelineNote(ticket.id, {
        action: 'Technician Remark',
        description: timelineNote.trim(),
        actor: timelineActor
      });
      setTimelineNote('');
      loadTicketData();
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      let partName = customPartName;
      let unitPrice = parseFloat(partPrice);
      let invId = null;

      if (selectedPartId && selectedPartId !== 'OTHER') {
        const found = inventoryList.find(i => String(i.id) === String(selectedPartId));
        if (found) {
          invId = found.id;
          partName = found.name;
          if (!partPrice) unitPrice = found.selling_price;
        }
      }

      if (!partName || isNaN(unitPrice)) {
        alert('Please specify part and price');
        return;
      }

      await api.addTicketPart(ticket.id, {
        inventory_id: invId,
        part_name: partName,
        serial_no: partSerialNo ? partSerialNo.trim() : null,
        quantity: parseInt(partQty, 10),
        unit_price: unitPrice
      });

      setIsAddPartOpen(false);
      setSelectedPartId('');
      setCustomPartName('');
      setPartSerialNo('');
      setPartQty(1);
      setPartPrice('');
      loadTicketData();
      loadAuxData(); // Refresh stock counts
    } catch (err) {
      alert('Failed to add part: ' + err.message);
    }
  };

  const handleRemovePart = async (partId) => {
    if (!confirm('Remove this part and restore inventory stock?')) return;
    try {
      await api.removeTicketPart(ticket.id, partId);
      loadTicketData();
      loadAuxData();
    } catch (err) {
      alert('Failed to remove part: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-rose-400 font-semibold">Ticket not found.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-sm text-white">
          Back to Tickets
        </button>
      </div>
    );
  }

  const partsTotal = (ticket.parts || []).reduce((acc, p) => acc + (p.total_price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Back to Tickets"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-bold text-white">{ticket.ticket_number}</span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Intake Date: {new Date(ticket.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Deliver Device Button (When Ready for Pickup or Delivered) */}
          {ticket.status === 'READY_FOR_PICKUP' && (
            <button
              onClick={handleOpenDelivery}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95 animate-pulse"
              title="Deliver Device & Settle Payment"
            >
              <Truck className="w-4 h-4" />
              <span>Deliver Device</span>
            </button>
          )}

          {/* Print Job Card Button */}
          <button
            onClick={() => onPrintJobCard(ticket.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Job Sheet</span>
          </button>

          {/* Invoice Action (Non-technicians only) */}
          {currentUser?.role !== 'technician' && (
            ticket.invoice ? (
              <button
                onClick={() => onViewInvoice(ticket.invoice.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Receipt className="w-4 h-4" />
                <span>View Invoice ({ticket.invoice.invoice_number})</span>
              </button>
            ) : (
              <button
                onClick={() => onGenerateInvoice(ticket.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-lg shadow-sky-500/20 transition-all"
              >
                <Receipt className="w-4 h-4" />
                <span>Generate Invoice</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Ready for Pickup Delivery & Payment Banner */}
      {ticket.status === 'READY_FOR_PICKUP' && (
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/50 border border-emerald-500/40 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-emerald-950/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Device Ready for Pickup & Handover</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready for Delivery
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Repairs and quality testing are completed. Hand over the device to {ticket.customer_name} and settle any remaining balance.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenDelivery}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all shrink-0 active:scale-95"
          >
            <CreditCard className="w-4 h-4" />
            <span>Deliver & Go to Payment</span>
          </button>
        </div>
      )}

      {/* Delivered Notification Banner */}
      {ticket.status === 'DELIVERED' && (
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>This device has been handed over and marked as <strong className="text-emerald-400">Delivered</strong>.</span>
          </div>
          <button
            onClick={handleOpenDelivery}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors font-medium"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Delivery & Settlement Summary</span>
          </button>
        </div>
      )}

      {/* Interactive Workflow Status Transition Bar */}
      <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Repair Stage Progression
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {WORKFLOW_STEPS.map((st, idx) => {
            const isCurrent = ticket.status === st;
            return (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
                  isCurrent
                    ? 'bg-sky-500 text-white border-sky-400 font-bold shadow-md shadow-sky-500/30'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Details & Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer, Device, Diagnostics, Replaced Parts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Hardware Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Details */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Customer Info</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">ID #{ticket.customer_id}</span>
                  <button
                    type="button"
                    onClick={() => setIsEditCustomerOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors"
                    title="Edit Customer Details"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{ticket.customer_name}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                  <Phone className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-semibold">{ticket.customer_phone}</span>
                </div>
                {ticket.customer_alt_phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Alt: {ticket.customer_alt_phone}</span>
                  </div>
                )}
                {ticket.customer_email && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ticket.customer_email}</span>
                  </div>
                )}
                {ticket.customer_address && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ticket.customer_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Device Hardware Profile */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Device Hardware</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                  {ticket.device_type}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Brand / Model:</span>
                  <span className="font-semibold text-white">{ticket.brand} {ticket.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial / Service Tag:</span>
                  <span className="font-mono text-slate-200">{ticket.serial_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Device Password:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-200">
                      {ticket.device_password ? (showPassword ? ticket.device_password : '••••••••') : 'None'}
                    </span>
                    {ticket.device_password && (
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Lead Technician:</span>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="font-semibold text-sky-400 block">{ticket.technician_name || 'Unassigned'}</span>
                      {ticket.technician_status === 'On Leave' && (
                        <span className="text-[10px] text-amber-400 font-semibold flex items-center justify-end gap-1">
                          <AlertCircle className="w-3 h-3" /> Today on leave
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReassignTechId(ticket.technician_id || '');
                        setIsReassignOpen(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors"
                      title="Assign or Reassign Technician"
                    >
                      <Edit className="w-3 h-3" />
                      <span>{ticket.technician_id ? 'Change' : 'Assign'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fault Description & Physical Condition */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block mb-1">
                Reported Issue & Symptoms
              </span>
              <p className="text-sm text-slate-200 bg-slate-800/60 p-3 rounded-xl border border-slate-800 whitespace-pre-wrap">
                {ticket.problem_description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1.5">Accessories Received:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.accessories && ticket.accessories.length > 0 ? (
                    ticket.accessories.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        ✓ {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">No accessories received</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1.5">Intake Physical State:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.physical_condition && ticket.physical_condition.length > 0 ? (
                    ticket.physical_condition.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        • {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">Standard condition</span>
                  )}
                </div>
              </div>
            </div>

            {ticket.diagnosis_notes && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                  Diagnosis & Inspection Findings
                </span>
                <p className="text-sm text-slate-200 bg-cyan-950/20 p-3 rounded-xl border border-cyan-900/40 whitespace-pre-wrap">
                  {ticket.diagnosis_notes}
                </p>
              </div>
            )}
          </div>

          {/* Diagnostic Inspection Checklist Grid */}
          {ticket.inspection_checklist && Object.keys(ticket.inspection_checklist).length > 0 && (
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-sm">System Inspection Checklist</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {Object.entries(ticket.inspection_checklist).map(([key, val]) => (
                  <div key={key} className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 capitalize block">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="font-medium text-slate-200 mt-0.5 block">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replaced Spare Parts & Materials */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-white text-base">Replaced Spare Parts & Materials</h3>
              </div>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Part from Inventory</span>
              </button>
            </div>

            {ticket.parts && ticket.parts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No replacement parts added yet. Click "Add Part" to deduct from inventory.
              </p>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden text-xs">
                {ticket.parts && ticket.parts.map(p => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">{p.part_name}</p>
                      <p className="text-[11px] text-slate-400">
                        Qty: {p.quantity} × ₹{parseFloat(p.unit_price).toLocaleString()}
                        {p.serial_no && <span className="ml-2 font-mono text-emerald-400 font-medium">SN: {p.serial_no}</span>}
                        {p.sku && <span className="ml-2 font-mono text-sky-400/80">({p.sku})</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-white text-sm">
                        ₹{parseFloat(p.total_price).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleRemovePart(p.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove part and restore stock"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="p-3 bg-slate-800/60 flex justify-between font-bold text-xs">
                  <span className="text-slate-300">Total Spare Parts Cost:</span>
                  <span className="text-sky-400 text-sm">₹{partsTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Timeline Audit Log & Financial Estimate */}
        <div className="space-y-6">
          {/* Financial Overview Card */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 block border-b border-slate-800 pb-2">
              Cost & Billing Summary
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Cost:</span>
                <span className="font-bold text-white">₹{parseFloat(ticket.estimated_cost || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Advance Deposit Paid:</span>
                <span className="font-bold text-emerald-400">₹{parseFloat(ticket.advance_paid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spare Parts Incurred:</span>
                <span className="font-semibold text-slate-200">₹{partsTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est Delivery Date:</span>
                <span className="font-semibold text-slate-200">
                  {ticket.estimated_delivery ? new Date(ticket.estimated_delivery).toLocaleDateString('en-GB') : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity & Timeline Audit Feed */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-white text-sm">Workshop Timeline & Logs</h3>
            </div>

            {/* Add note form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                placeholder="Log benchmark result, customer call note, or diagnosis step..."
                value={timelineNote}
                onChange={e => setTimelineNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex items-center justify-between">
                <select
                  value={timelineActor}
                  onChange={e => setTimelineActor(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
                >
                  <option value="Technician">Technician</option>
                  <option value="Front Desk">Front Desk</option>
                  <option value="QC Tester">QC Tester</option>
                </select>
                <button
                  type="submit"
                  disabled={!timelineNote.trim()}
                  className="flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>Log Note</span>
                </button>
              </div>
            </form>

            {/* Timeline Events */}
            <div className="space-y-3 pt-2 max-h-96 overflow-y-auto">
              {ticket.timeline && ticket.timeline.map((event, idx) => (
                <div key={event.id || idx} className="relative pl-5 border-l-2 border-slate-700 space-y-0.5 text-xs">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-slate-900"></div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-200">{event.action}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                  <p className="text-slate-300">{event.description}</p>
                  <span className="text-[10px] text-slate-500">Actor: {event.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Part Modal */}
      {isAddPartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Add Spare Part to Repair Job</h3>
            <form onSubmit={handleAddPart} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select from Inventory</label>
                <select
                  value={selectedPartId}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedPartId(val);
                    if (val === 'OTHER') {
                      setPartPrice('');
                      setCustomPartName('');
                    } else if (val) {
                      const item = inventoryList.find(i => String(i.id) === val);
                      if (item) {
                        setPartPrice(item.selling_price);
                        if (item.serial_no) setPartSerialNo(item.serial_no);
                      }
                    } else {
                      setPartPrice('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">-- Choose Stock Item or Select Other Below --</option>
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.stock_quantity} in stock) - ₹{item.selling_price}
                    </option>
                  ))}
                  <option value="OTHER">Other (Custom Part / Non-Inventory Material)</option>
                </select>
              </div>

              {(selectedPartId === 'OTHER' || !selectedPartId) && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Custom Part / Material Name {selectedPartId === 'OTHER' ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    required={selectedPartId === 'OTHER' || !selectedPartId}
                    placeholder="e.g. Special IC / Thermal Gel / Custom Cable"
                    value={customPartName}
                    onChange={e => setCustomPartName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Serial No <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-89234871 (optional)"
                  value={partSerialNo}
                  onChange={e => setPartSerialNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={partQty}
                    onChange={e => setPartQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    placeholder="₹ Rate"
                    value={partPrice}
                    onChange={e => setPartPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPartOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold"
                >
                  Install & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditCustomerOpen && (
        <EditCustomerModal
          isOpen={isEditCustomerOpen}
          customer={{
            id: ticket.customer_id,
            name: ticket.customer_name,
            phone: ticket.customer_phone,
            alt_phone: ticket.customer_alt_phone,
            email: ticket.customer_email,
            address: ticket.customer_address
          }}
          onClose={() => setIsEditCustomerOpen(false)}
          onSuccess={() => {
            loadTicketData();
          }}
        />
      )}

      {/* Reassign Technician Modal */}
      {isReassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Assign / Reassign Technician</h3>
              <button onClick={() => setIsReassignOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignTechnician} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Assign Technician</label>
                {(() => {
                  const assignableTechs = technicians.filter(t => t.status !== 'Inactive');
                  const selectedTech = technicians.find(t => String(t.id) === String(reassignTechId));
                  const isSelectedOnLeave = selectedTech && (selectedTech.status === 'On Leave' || selectedTech.status?.toLowerCase().includes('leave'));

                  return (
                    <>
                      <select
                        value={reassignTechId}
                        onChange={e => setReassignTechId(e.target.value)}
                        className={`w-full px-3 py-2 text-sm bg-slate-800 border rounded-xl text-white focus:ring-2 focus:ring-sky-500 focus:outline-none transition-colors ${
                          isSelectedOnLeave ? 'border-amber-500/80 bg-amber-950/20 text-amber-200' : 'border-slate-700'
                        }`}
                      >
                        <option value="">Unassigned</option>
                        {assignableTechs.map(t => {
                          const isLeave = t.status === 'On Leave' || t.status?.toLowerCase().includes('leave');
                          return (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.specialization || 'General Hardware'}){isLeave ? ' — (Today this technician is on leave)' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {isSelectedOnLeave && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>
                            <strong>Notice:</strong> Today this technician is on leave ({selectedTech?.name}). You can still assign if needed, or select an active technician.
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReassignOpen(false)}
                  disabled={reassignLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-md shadow-sky-600/20 transition-all active:scale-95"
                >
                  {reassignLoading ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery & Payment Handover Modal */}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Device Delivery & Payment Handover</h3>
                  <p className="text-xs text-slate-400">
                    Ticket <span className="font-mono text-sky-400 font-semibold">{ticket.ticket_number}</span> • {ticket.customer_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeliveryModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Device Profile Card */}
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Device Handover</span>
                  <p className="text-sm font-bold text-white mt-0.5">{ticket.brand} {ticket.model}</p>
                  <p className="text-[11px] text-slate-400 font-mono">SN: {ticket.serial_number || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Customer</span>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{ticket.customer_name}</p>
                  <p className="text-[11px] text-sky-400">{ticket.customer_phone}</p>
                </div>
              </div>

              {/* SCENARIO 1: INVOICE EXISTS */}
              {ticket.invoice ? (
                <div className="space-y-4">
                  {/* Invoice Summary Card */}
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-sky-400" />
                        <span className="font-bold text-white">Invoice #{ticket.invoice.invoice_number}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        Number(ticket.invoice.balance_due) <= 0.01 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {ticket.invoice.payment_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Total Amount</span>
                        <span className="text-xs font-bold text-white mt-0.5 block">
                          ₹{parseFloat(ticket.invoice.grand_total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Paid Earlier</span>
                        <span className="text-xs font-bold text-emerald-400 mt-0.5 block">
                          ₹{parseFloat(ticket.invoice.amount_paid || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Balance Due</span>
                        <span className={`text-xs font-bold mt-0.5 block ${Number(ticket.invoice.balance_due) > 0 ? 'text-amber-400 font-extrabold' : 'text-slate-400'}`}>
                          ₹{parseFloat(ticket.invoice.balance_due || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Form (if balance due > 0) */}
                  {Number(ticket.invoice.balance_due) > 0 ? (
                    <form onSubmit={handleRecordDeliveryPayment} className="space-y-4">
                      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <CreditCard className="w-4 h-4" />
                          <span>Payment Settlement Option</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 font-medium mb-1">
                              Payment Amount to Collect (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-500 font-bold">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={ticket.invoice.balance_due}
                                value={deliveryPaymentAmount}
                                onChange={e => setDeliveryPaymentAmount(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              Outstanding: ₹{parseFloat(ticket.invoice.balance_due).toLocaleString()}
                            </span>
                          </div>

                          <div>
                            <label className="block text-slate-300 font-medium mb-1">
                              Payment Method
                            </label>
                            <select
                              value={deliveryPaymentMethod}
                              onChange={e => setDeliveryPaymentMethod(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="Cash">Cash</option>
                              <option value="UPI / QR">UPI / QR Code</option>
                              <option value="Card">Credit / Debit Card</option>
                              <option value="Bank Transfer">Bank Transfer / NEFT</option>
                            </select>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={deliveryMarkDelivered}
                            onChange={e => setDeliveryMarkDelivered(e.target.checked)}
                            className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-slate-300 text-[11px]">
                            Update ticket status to <strong>DELIVERED</strong> upon recording payment
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => onViewInvoice(ticket.invoice.id)}
                          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Full Invoice</span>
                        </button>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setIsDeliveryModalOpen(false)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={deliveryLoading}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>
                              {deliveryLoading ? 'Processing...' : `Collect ₹${deliveryPaymentAmount || 0} & Deliver`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    /* Invoice is Fully Paid */
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-white text-xs">Invoice is Fully Settled</h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Customer has settled all dues in full (₹0 balance). You can hand over the device and confirm delivery.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsDeliveryModalOpen(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(ticket.invoice.id)}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded-xl font-medium"
                        >
                          Print Invoice
                        </button>
                        {ticket.status !== 'DELIVERED' && (
                          <button
                            type="button"
                            onClick={handleConfirmDirectDelivery}
                            disabled={deliveryLoading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                          >
                            <Truck className="w-4 h-4" />
                            <span>{deliveryLoading ? 'Saving...' : 'Confirm Delivery & Handover'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SCENARIO 2: NO INVOICE GENERATED YET */
                <div className="space-y-4">
                  <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-300 text-xs">No Invoice Generated Yet</h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        An invoice is needed to collect final payment and hand over the device. You can quickly settle below or open the full invoice page.
                      </p>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/80 space-y-2.5">
                    <div className="flex justify-between text-slate-300">
                      <span>Spare Parts Incurred:</span>
                      <span className="font-semibold text-white">₹{partsTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Advance Deposit Paid:</span>
                      <span className="font-semibold text-emerald-400">-₹{parseFloat(ticket.advance_paid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Initial Estimated Cost:</span>
                      <span className="font-semibold text-slate-400">₹{parseFloat(ticket.estimated_cost || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Handover Without Auto-Invoice */}
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-4">
                    <p className="text-slate-300 text-xs">
                      Ready to deliver this repaired device to <strong>{ticket.customer_name}</strong>.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeliveryModalOpen(false);
                          onGenerateInvoice(ticket.id);
                        }}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Go to Invoices to Create Invoice</span>
                      </button>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsDeliveryModalOpen(false)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-medium text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmDirectDelivery}
                          disabled={deliveryLoading}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 text-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Truck className="w-4 h-4" />
                          <span>{deliveryLoading ? 'Saving...' : 'Confirm Delivery'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
