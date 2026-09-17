import React, { useState, useEffect } from 'react';
import { X, Wrench, User, Laptop, CheckSquare, Shield, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { formatLocalDate } from '../utils/date';

const DEVICE_TYPES = [
  'Laptop',
  'Desktop',
  'Gaming Rig',
  'MacBook',
  'iMac',
  'All-in-One',
  'Mini PC',
  'Server',
  'Printer',
  'Monitor',
  'Other'
];

const GENERAL_BRANDS = [
  'Acer',
  'Apple',
  'Asus',
  'Compaq',
  'Dell',
  'Elcot',
  'HP',
  'Lenovo',
  'Toshiba',
  'Other'
];

const DESKTOP_BRANDS = [
  'Acer',
  'Compaq',
  'Dell',
  'HP',
  'Lenovo',
  'Other'
];

const ALL_IN_ONE_BRANDS = [
  'Acer',
  'Apple',
  'Dell',
  'HP',
  'Lenovo',
  'Other'
];

const getBrandsForDeviceType = (deviceType) => {
  if (deviceType === 'Desktop') return DESKTOP_BRANDS;
  if (deviceType === 'All-in-One') return ALL_IN_ONE_BRANDS;
  return GENERAL_BRANDS;
};

const COMMON_ACCESSORIES = [
  'Power Adapter / Charger',
  'Laptop Sleeve / Bag',
  'Wireless Mouse',
  'USB Dongle / Cable',
  'Original Packaging Box'
];

const PHYSICAL_CONDITIONS = [
  'Clean / No physical scratches',
  'Minor body scratches',
  'Chassis dent / drop mark',
  'Hinges loose / cracked',
  'Missing base screws',
  'Suspected liquid spill'
];

export default function NewTicketModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [customBrand, setCustomBrand] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    customer_phone: '',
    customer_name: '',
    customer_email: '',
    customer_address: '',
    device_type: 'Laptop',
    brand: 'Acer',
    model: '',
    serial_number: '',
    device_password: '',
    accessories: ['Power Adapter / Charger'],
    physical_condition: ['Minor body scratches'],
    inspection_checklist: {
      powerState: 'Powers On',
      display: 'OK',
      keyboard: 'OK',
      trackpad: 'OK',
      ports: 'OK',
      battery: 'OK',
      thermals: 'Normal',
      smartHealth: 'Good'
    },
    problem_description: '',
    priority: 'Normal',
    technician_id: '',
    estimated_cost: '',
    estimated_delivery: '',
    advance_paid: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadTechs();
      setCustomBrand('');
      // Set default delivery date 2 days from now in computer local date
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setFormData(prev => ({
        ...prev,
        estimated_delivery: formatLocalDate(d)
      }));
    }
  }, [isOpen]);

  const loadTechs = async () => {
    try {
      const data = await api.getTechnicians();
      setTechnicians(data);
      if (data.length > 0 && !formData.technician_id) {
        // Pre-select first active technician (exclude Inactive and On Leave)
        const firstActive = data.find(t => t.status === 'Active');
        if (firstActive) {
          setFormData(prev => ({ ...prev, technician_id: firstActive.id }));
        }
      }
    } catch (err) {
      console.error('Failed to load technicians', err);
    }
  };

  // Phone auto-lookup
  const handlePhoneBlur = async () => {
    if (formData.customer_phone.length >= 7) {
      try {
        const customers = await api.getCustomers(formData.customer_phone);
        const match = customers.find(c => c.phone === formData.customer_phone);
        if (match) {
          setFormData(prev => ({
            ...prev,
            customer_name: match.name,
            customer_email: match.email || '',
            customer_address: match.address || ''
          }));
        }
      } catch (e) {
        // ignore lookup errors
      }
    }
  };

  const toggleAccessory = (item) => {
    setFormData(prev => {
      const list = prev.accessories.includes(item)
        ? prev.accessories.filter(a => a !== item)
        : [...prev.accessories, item];
      return { ...prev, accessories: list };
    });
  };

  const toggleCondition = (item) => {
    setFormData(prev => {
      const list = prev.physical_condition.includes(item)
        ? prev.physical_condition.filter(c => c !== item)
        : [...prev.physical_condition, item];
      return { ...prev, physical_condition: list };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.customer_phone) {
      setError('Customer name and phone number are required');
      return;
    }
    if (!formData.model || !formData.problem_description) {
      setError('Device model and problem description are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        brand: formData.brand === 'Other' && customBrand.trim() ? customBrand.trim() : formData.brand
      };
      const res = await api.createTicket(payload);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess(res);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create repair ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/60 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Create New Repair Job Card</h3>
              <p className="text-xs text-slate-400">Intake device details, accessories checklist, and customer contact</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Customer Info */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-3">
              <User className="w-3.5 h-3.5" />
              <span>Customer Information</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9811223344"
                  value={formData.customer_phone}
                  onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                  onBlur={handlePhoneBlur}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={formData.customer_name}
                  onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={formData.customer_email}
                  onChange={e => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Address / Landmark</label>
                <input
                  type="text"
                  placeholder="Area / City"
                  value={formData.customer_address}
                  onChange={e => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Device Hardware Specs */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-3">
              <Laptop className="w-3.5 h-3.5" />
              <span>Device & Hardware Specifications</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Device Type</label>
                <select
                  value={formData.device_type}
                  onChange={e => {
                    const newType = e.target.value;
                    const brands = getBrandsForDeviceType(newType);
                    setFormData(prev => ({
                      ...prev,
                      device_type: newType,
                      brand: brands.includes(prev.brand) ? prev.brand : brands[0]
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {DEVICE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Brand</label>
                <select
                  value={formData.brand}
                  onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {getBrandsForDeviceType(formData.device_type).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {formData.brand === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify brand (e.g. MSI, Samsung, Sony)"
                    value={customBrand}
                    onChange={e => setCustomBrand(e.target.value)}
                    className="mt-2 w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none animate-fadeIn"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Model <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspiron 5570, XPS 15"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Serial Number / Service Tag</label>
                <input
                  type="text"
                  placeholder="e.g. 8XYZ192"
                  value={formData.serial_number}
                  onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Device PIN / OS Password</label>
                <input
                  type="text"
                  placeholder="PIN / Password for testing"
                  value={formData.device_password}
                  onChange={e => setFormData({ ...formData, device_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Accessories & Physical Condition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Accessories Received with Device:
              </label>
              <div className="space-y-1.5">
                {COMMON_ACCESSORIES.map(acc => (
                  <label key={acc} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={formData.accessories.includes(acc)}
                      onChange={() => toggleAccessory(acc)}
                      className="rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500"
                    />
                    <span>{acc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Intake Physical Condition:
              </label>
              <div className="space-y-1.5">
                {PHYSICAL_CONDITIONS.map(cond => (
                  <label key={cond} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={formData.physical_condition.includes(cond)}
                      onChange={() => toggleCondition(cond)}
                      className="rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500"
                    />
                    <span>{cond}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Problem Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Customer Reported Issue / Faults <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe symptoms: e.g. Display blank, Blue Screen crash, liquid spill, hinge cracked, battery swollen..."
              value={formData.problem_description}
              onChange={e => setFormData({ ...formData, problem_description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Section 5: Assignment & Estimates */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Assignment & Initial Estimate</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent / Express</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assign Technician</label>
                {(() => {
                  const assignableTechs = technicians.filter(t => t.status !== 'Inactive');
                  const selectedTech = technicians.find(t => String(t.id) === String(formData.technician_id));
                  const selectedTechIsOnLeave = selectedTech && (selectedTech.status === 'On Leave' || selectedTech.status?.toLowerCase().includes('leave'));

                  return (
                    <>
                      <select
                        value={formData.technician_id}
                        onChange={e => setFormData({ ...formData, technician_id: e.target.value })}
                        className={`w-full px-3 py-2 text-sm bg-slate-800 border rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none transition-colors ${
                          selectedTechIsOnLeave ? 'border-amber-500/80 bg-amber-950/20 text-amber-200' : 'border-slate-700'
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

                      {selectedTechIsOnLeave && (
                        <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>
                            <strong>Notice:</strong> Today this technician is on leave ({selectedTech?.name}). You can still assign if needed, or select an active technician.
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Estimated Cost (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={formData.estimated_cost}
                  onChange={e => setFormData({ ...formData, estimated_cost: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Advance Received (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={formData.advance_paid}
                  onChange={e => setFormData({ ...formData, advance_paid: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Creating Job Card...' : 'Save & Generate Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
