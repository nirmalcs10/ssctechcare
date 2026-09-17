import React from 'react';
import { Printer, X, Wrench, Shield, CheckCircle } from 'lucide-react';

export default function PrintJobCard({ ticket, shopSettings = {}, onClose }) {
  if (!ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const shopName = shopSettings.shop_name || 'SSC TechCare Computer Solutions';
  const shopPhone = shopSettings.shop_phone || '+91 98765 43210';
  const shopEmail = shopSettings.shop_email || 'support@ssctechcare.com';
  const shopAddress = shopSettings.shop_address || 'Shop #12, First Floor, Silicon Arcade, Tech Park Road';
  const terms = shopSettings.terms_conditions || '1. Minimum diagnostic fee applies for all inspected equipment.\n2. SSC TechCare is not responsible for data loss. Please back up your data prior to service.\n3. Goods left uncollected beyond 30 days from completion date may incur storage charges.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-4">
        {/* Screen Toolbar */}
        <div className="no-print bg-slate-800 text-white px-6 py-3 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Job Card Print Preview - {ticket.ticket_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Job Sheet (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas (A4 standard) */}
        <div className="printable-area p-8 sm:p-12 text-slate-800 font-sans text-xs sm:text-sm leading-relaxed">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {shopName}
                </h1>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-md">{shopAddress}</p>
              <p className="text-xs text-slate-600 font-medium">Phone: {shopPhone} | Email: {shopEmail}</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                SERVICE INTAKE CARD
              </span>
              <h2 className="text-lg sm:text-xl font-mono font-bold text-slate-900 mt-2">
                {ticket.ticket_number}
              </h2>
              <p className="text-[11px] text-slate-500">
                Date: {new Date(ticket.created_at || Date.now()).toLocaleDateString('en-GB')} {new Date(ticket.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-2 gap-6 my-6">
            {/* Customer Details */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                Customer Information
              </h3>
              <p className="font-semibold text-slate-900 text-sm">{ticket.customer_name}</p>
              <p className="text-slate-700">Phone: <span className="font-semibold">{ticket.customer_phone}</span></p>
              {ticket.customer_alt_phone && <p className="text-slate-600">Alt Phone: {ticket.customer_alt_phone}</p>}
              {ticket.customer_email && <p className="text-slate-600">Email: {ticket.customer_email}</p>}
              {ticket.customer_address && <p className="text-slate-600">Address: {ticket.customer_address}</p>}
            </div>

            {/* Device & Hardware Profile */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                Device Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Device Type:</span>
                  <p className="font-semibold text-slate-900">{ticket.device_type}</p>
                </div>
                <div>
                  <span className="text-slate-500">Brand & Model:</span>
                  <p className="font-semibold text-slate-900">{ticket.brand} {ticket.model}</p>
                </div>
                <div>
                  <span className="text-slate-500">Serial / S.Tag:</span>
                  <p className="font-mono text-slate-900">{ticket.serial_number || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Device Passcode:</span>
                  <p className="font-mono text-slate-900">{ticket.device_password || 'None'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Condition & Accessories Table */}
          <div className="border border-slate-200 rounded-lg p-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-xs uppercase text-slate-800 block mb-1">Accessories Received:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.accessories && ticket.accessories.length > 0 ? (
                    ticket.accessories.map((a, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs">
                        ✓ {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Device Only (No accessories)</span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-bold text-xs uppercase text-slate-800 block mb-1">Physical Inspection Condition:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.physical_condition && ticket.physical_condition.length > 0 ? (
                    ticket.physical_condition.map((c, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700">
                        • {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Standard condition</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reported Fault & Symptoms */}
          <div className="border border-slate-200 rounded-lg p-4 my-4 bg-amber-50/40">
            <span className="font-bold text-xs uppercase text-slate-800 block mb-1">
              Customer Reported Fault / Issue:
            </span>
            <p className="text-slate-900 font-medium whitespace-pre-wrap">
              {ticket.problem_description}
            </p>
          </div>

          {/* Estimates & Financial Overview */}
          <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4 my-4 bg-slate-50">
            <div>
              <span className="text-slate-500 text-xs block">Estimated Delivery Date:</span>
              <p className="font-bold text-slate-900 text-sm">
                {ticket.estimated_delivery ? new Date(ticket.estimated_delivery).toLocaleDateString('en-GB') : 'To be advised'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Estimated Repair Cost:</span>
              <p className="font-bold text-slate-900 text-sm">
                ₹{parseFloat(ticket.estimated_cost || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Advance Deposit Paid:</span>
              <p className="font-bold text-emerald-700 text-sm">
                ₹{parseFloat(ticket.advance_paid || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="border-t border-slate-200 pt-4 mt-6">
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
              Terms & Service Conditions
            </h4>
            <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
              {terms}
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-10 pt-6 border-t border-dashed border-slate-300">
            <div>
              <div className="h-12"></div>
              <div className="border-t border-slate-800 pt-1 text-center">
                <p className="font-bold text-xs text-slate-900">Customer Signature</p>
                <p className="text-[10px] text-slate-500">I confirm the reported faults, accessories & physical condition.</p>
              </div>
            </div>

            <div>
              <div className="h-12"></div>
              <div className="border-t border-slate-800 pt-1 text-center">
                <p className="font-bold text-xs text-slate-900">Authorized Technician / Front Desk</p>
                <p className="text-[10px] text-slate-500">For {shopName}</p>
              </div>
            </div>
          </div>

          {/* Customer Self-Tracking Footer Note */}
          <div className="mt-6 pt-3 text-center text-[11px] text-slate-400 border-t border-slate-100">
            Track your device repair live anytime with Ticket <span className="font-mono font-bold text-slate-700">{ticket.ticket_number}</span> or your phone number.
          </div>
        </div>
      </div>
    </div>
  );
}
