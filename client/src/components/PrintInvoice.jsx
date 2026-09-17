import React from 'react';
import { Printer, X, Wrench, CheckCircle, AlertCircle } from 'lucide-react';

export default function PrintInvoice({ invoice, onClose }) {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const settings = invoice.settings || {};
  const shopName = settings.shop_name || 'SSC TechCare Computer Solutions';
  const shopPhone = settings.shop_phone || '+91 98765 43210';
  const shopEmail = settings.shop_email || 'support@ssctechcare.com';
  const shopAddress = settings.shop_address || 'Shop #12, First Floor, Silicon Arcade, Tech Park Road';
  const currency = settings.currency_symbol || '₹';

  const isPaid = invoice.payment_status === 'Paid';
  const isPartial = invoice.payment_status === 'Partial';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-4">
        {/* Screen Toolbar */}
        <div className="no-print bg-slate-800 text-white px-6 py-3 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Tax Invoice Print Preview - {invoice.invoice_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tax Invoice (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="printable-area p-8 sm:p-12 text-slate-800 font-sans text-xs sm:text-sm leading-relaxed">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
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
              <span className="inline-block px-3 py-1 bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded">
                TAX INVOICE
              </span>
              <h2 className="text-lg sm:text-xl font-mono font-bold text-slate-900 mt-2">
                {invoice.invoice_number}
              </h2>
              <p className="text-[11px] text-slate-500">
                Invoice Date: {new Date(invoice.created_at || Date.now()).toLocaleDateString('en-GB')}
              </p>
              <p className="text-[11px] text-slate-500">
                Job Card Ref: <span className="font-mono font-bold text-slate-800">{invoice.ticket_number}</span>
              </p>
            </div>
          </div>

          {/* Billing & Device Info */}
          <div className="grid grid-cols-2 gap-6 my-6">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                Billed To (Customer)
              </h3>
              <p className="font-semibold text-slate-900 text-sm">{invoice.customer_name}</p>
              <p className="text-slate-700">Phone: <span className="font-semibold">{invoice.customer_phone}</span></p>
              {invoice.customer_email && <p className="text-slate-600">Email: {invoice.customer_email}</p>}
              {invoice.customer_address && <p className="text-slate-600">Address: {invoice.customer_address}</p>}
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                Serviced Device Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Device Type:</span>
                  <p className="font-semibold text-slate-900">{invoice.device_type || 'Computer / Laptop'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Brand & Model:</span>
                  <p className="font-semibold text-slate-900">{invoice.device_brand} {invoice.device_model}</p>
                </div>
                <div>
                  <span className="text-slate-500">Serial Number:</span>
                  <p className="font-mono text-slate-900">{invoice.serial_number || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Lead Technician:</span>
                  <p className="font-semibold text-slate-900">{invoice.technician_name || 'Service Bench'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden my-4">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">Item / Service Description</th>
                  <th className="py-2.5 px-4 text-center w-20">Qty</th>
                  <th className="py-2.5 px-4 text-right w-28">Rate ({currency})</th>
                  <th className="py-2.5 px-4 text-right w-32">Total ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Labor Charges */}
                <tr>
                  <td className="py-2.5 px-4 text-center text-slate-500">1</td>
                  <td className="py-2.5 px-4">
                    <p className="font-semibold text-slate-900">Professional Hardware Labor & Diagnosis Services</p>
                    <p className="text-[11px] text-slate-500">Inspection, testing, assembly & quality verification</p>
                  </td>
                  <td className="py-2.5 px-4 text-center">1</td>
                  <td className="py-2.5 px-4 text-right">{parseFloat(invoice.labor_charges || 0).toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-medium">{parseFloat(invoice.labor_charges || 0).toLocaleString()}</td>
                </tr>

                {/* Replaced Parts */}
                {invoice.parts && invoice.parts.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td className="py-2.5 px-4 text-center text-slate-500">{idx + 2}</td>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900">{p.part_name}</p>
                      <p className="text-[11px] text-slate-500">Replacement spare part</p>
                    </td>
                    <td className="py-2.5 px-4 text-center">{p.quantity}</td>
                    <td className="py-2.5 px-4 text-right">{parseFloat(p.unit_price).toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right font-medium">{parseFloat(p.total_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation Summary */}
          <div className="flex justify-between items-start my-6">
            <div className="max-w-xs text-xs space-y-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-800 text-[11px] uppercase mb-1">Payment Method</p>
                <p className="font-semibold text-slate-900">{invoice.payment_method || 'Cash'}</p>
                {invoice.notes && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">{invoice.notes}</p>
                )}
              </div>

              <div className={`p-3 rounded-lg border ${
                isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                isPartial ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center gap-1.5 font-bold uppercase text-xs">
                  {isPaid ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>Payment Status: {invoice.payment_status}</span>
                </div>
              </div>
            </div>

            <div className="w-72 border border-slate-200 rounded-lg overflow-hidden text-xs sm:text-sm">
              <div className="p-3 space-y-2 bg-slate-50/60">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-medium text-slate-800">{currency}{parseFloat(invoice.subtotal).toLocaleString()}</span>
                </div>

                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({invoice.tax_rate}%):</span>
                    <span className="font-medium text-slate-800">{currency}{parseFloat(invoice.tax_amount).toLocaleString()}</span>
                  </div>
                )}

                {invoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-medium">-{currency}{parseFloat(invoice.discount).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-base">
                  <span>Grand Total:</span>
                  <span>{currency}{parseFloat(invoice.grand_total).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 bg-white space-y-1.5 text-xs">
                {invoice.advance_deducted > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Advance Deposit Paid:</span>
                    <span className="font-medium text-slate-800">{currency}{parseFloat(invoice.advance_deducted).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Total Paid:</span>
                  <span className="font-semibold text-emerald-700">{currency}{parseFloat(invoice.amount_paid).toLocaleString()}</span>
                </div>

                <div className="flex justify-between font-bold text-sm border-t border-dashed border-slate-300 pt-1.5 text-slate-900">
                  <span>Balance Due:</span>
                  <span className={invoice.balance_due > 0 ? 'text-rose-600' : 'text-slate-900'}>
                    {currency}{parseFloat(invoice.balance_due).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Warranty & Signature Footer */}
          <div className="grid grid-cols-2 gap-12 mt-12 pt-6 border-t border-slate-300">
            <div>
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
                Hardware Warranty Policy
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Replaced components carry a 30-day functional warranty from date of delivery. Warranty does not cover physical drops, liquid damage, or unauthorized customer disassembly.
              </p>
            </div>

            <div>
              <div className="h-10"></div>
              <div className="border-t border-slate-800 pt-1 text-center">
                <p className="font-bold text-xs text-slate-900">Authorized Signatory</p>
                <p className="text-[10px] text-slate-500">For {shopName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
