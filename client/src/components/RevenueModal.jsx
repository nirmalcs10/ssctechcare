import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  ShoppingBag, 
  Boxes, 
  X, 
  RefreshCw, 
  Search, 
  Phone, 
  Receipt, 
  CreditCard, 
  ArrowUpRight,
  Package,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  Users
} from 'lucide-react';
import { api } from '../api';

export default function RevenueModal({ isOpen, onClose, onNavigate, onSettleInvoice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeView, setActiveView] = useState('dues'); // 'dues' | 'profit' | 'inventory'
  const [dueFilter, setDueFilter] = useState('pending'); // 'pending' | 'all'

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen]);

  const fetchFallbackAnalytics = async () => {
    const [invoices, inventory, tickets, customers] = await Promise.all([
      api.getInvoices().catch(() => []),
      api.getInventory().catch(() => []),
      api.getTickets().catch(() => []),
      api.getCustomers().catch(() => [])
    ]);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curYearMonth = `${curYear}-${curMonth}`;

    let totalRevenue = 0;
    let totalBilled = 0;
    let monthRevenue = 0;
    let monthBilled = 0;
    let monthDue = 0;
    let monthLabor = 0;
    let monthPartsTotal = 0;
    let monthDiscount = 0;

    const customerMap = {};
    const invoicedTicketIds = new Set();
    const pendingInvoices = [];

    (customers || []).forEach(c => {
      customerMap[c.id] = {
        customer_id: c.id,
        customer_name: c.name,
        customer_phone: c.phone || '-',
        customer_email: c.email || '',
        unpaid_invoice_count: 0,
        pending_ticket_count: 0,
        total_due: 0,
        total_invoiced: 0,
        total_paid: 0,
        invoice_numbers: [],
        items: []
      };
    });

    (invoices || []).forEach(inv => {
      if (inv.ticket_id) invoicedTicketIds.add(inv.ticket_id);
      const paid = Number(inv.amount_paid) || 0;
      const billed = Number(inv.grand_total) || 0;
      const due = Number(inv.balance_due) || 0;
      totalRevenue += paid;
      totalBilled += billed;

      const created = inv.created_at || '';
      const isThisMonth = created.startsWith(curYearMonth);
      if (isThisMonth) {
        monthRevenue += paid;
        monthBilled += billed;
        monthDue += due;
        monthLabor += Number(inv.labor_charges) || 0;
        monthPartsTotal += Number(inv.parts_total) || 0;
        monthDiscount += Number(inv.discount) || 0;
      }

      const cid = inv.customer_id;
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customer_id: cid,
          customer_name: inv.customer_name || 'Customer #' + cid,
          customer_phone: inv.customer_phone || '-',
          customer_email: inv.customer_email || '',
          unpaid_invoice_count: 0,
          pending_ticket_count: 0,
          total_due: 0,
          total_invoiced: 0,
          total_paid: 0,
          invoice_numbers: [],
          items: []
        };
      }
      customerMap[cid].total_invoiced += billed;
      customerMap[cid].total_paid += paid;

      if (due > 0) {
        pendingInvoices.push(inv);
        customerMap[cid].unpaid_invoice_count += 1;
        customerMap[cid].total_due += due;
        if (inv.invoice_number) customerMap[cid].invoice_numbers.push(inv.invoice_number);
        customerMap[cid].items.push({
          type: 'invoice',
          id: inv.id,
          ticket_id: inv.ticket_id,
          ref: inv.invoice_number,
          status: inv.payment_status || 'Unpaid',
          total: billed,
          paid: paid,
          due: due
        });
      }
    });

    (tickets || []).forEach(t => {
      if (t.status !== 'CANCELLED' && !invoicedTicketIds.has(t.id)) {
        const est = Number(t.estimated_cost) || 0;
        const adv = Number(t.advance_paid) || 0;
        const due = Math.max(0, est - adv);
        const cid = t.customer_id;

        if (customerMap[cid]) {
          customerMap[cid].total_invoiced += est;
          customerMap[cid].total_paid += adv;

          if (due > 0) {
            customerMap[cid].total_due += due;
            customerMap[cid].pending_ticket_count += 1;
            customerMap[cid].items.push({
              type: 'ticket',
              id: t.id,
              ticket_id: t.id,
              ref: t.ticket_number,
              status: t.status,
              total: est,
              paid: adv,
              due: due
            });
          }
        }
      }
    });

    const customerList = Object.values(customerMap);
    const customerWiseDue = customerList
      .filter(c => c.total_due > 0)
      .map(c => ({
        ...c,
        invoice_numbers: c.invoice_numbers.length > 0 
          ? c.invoice_numbers.join(', ') 
          : (c.items || []).map(it => it.ref).join(', ')
      }))
      .sort((a, b) => b.total_due - a.total_due);

    const overallTotalDue = customerWiseDue.reduce((sum, c) => sum + c.total_due, 0);

    let totalUnusedStockCost = 0;
    let totalUnusedStockRetail = 0;
    let totalStockUnits = 0;
    let monthPurchase = 0;
    let monthPurchaseUnits = 0;
    let monthPurchaseItems = 0;

    (inventory || []).forEach(item => {
      const qty = Number(item.stock_quantity) || 0;
      const cost = Number(item.cost_price) || 0;
      const retail = Number(item.selling_price) || 0;

      if (qty > 0) {
        totalUnusedStockCost += qty * cost;
        totalUnusedStockRetail += qty * retail;
        totalStockUnits += qty;
      }

      const created = item.created_at || '';
      if (created.startsWith(curYearMonth)) {
        monthPurchase += qty * cost;
        monthPurchaseUnits += qty;
        monthPurchaseItems += 1;
      }
    });

    const partsMargin = Math.max(0, monthPartsTotal * 0.35);
    const totalProfitThisMonth = Math.max(0, (monthLabor + partsMargin) - monthDiscount);

    return {
      totalRevenue,
      totalBilled,
      totalDue: overallTotalDue,
      allTimeInvoices: (invoices || []).length,
      monthRevenue,
      monthBilled,
      monthDue,
      monthInvoices: (invoices || []).filter(i => (i.created_at || '').startsWith(curYearMonth)).length,
      customerWiseDue,
      allCustomers: customerList,
      pendingInvoices,
      profitThisMonth: {
        totalProfit: totalProfitThisMonth,
        laborIncome: monthLabor,
        partsRevenue: monthPartsTotal,
        partsCost: Math.max(0, monthPartsTotal - partsMargin),
        partsMargin,
        discountGiven: monthDiscount,
        totalCollected: monthRevenue
      },
      purchaseThisMonth: {
        totalPurchase: monthPurchase,
        unitsPurchased: monthPurchaseUnits,
        itemsCount: monthPurchaseItems
      },
      unusedStock: {
        totalCost: totalUnusedStockCost,
        totalRetail: totalUnusedStockRetail,
        potentialProfit: Math.max(0, totalUnusedStockRetail - totalUnusedStockCost),
        totalUnits: totalStockUnits,
        distinctSkus: (inventory || []).filter(i => (Number(i.stock_quantity) || 0) > 0).length
      }
    };
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      let res;
      try {
        res = await api.getRevenueAnalytics();
      } catch (err) {
        console.warn('Direct analytics endpoint unavailable, calculating from standard collections:', err);
        res = await fetchFallbackAnalytics();
      }
      setData(res);
    } catch (err) {
      console.error('Failed to load revenue analytics:', err);
      setError(err.message || 'Unable to fetch financial metrics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const displayedCustomers = dueFilter === 'all'
    ? (data?.allCustomers && data.allCustomers.length > 0 ? data.allCustomers : data?.customerWiseDue || [])
    : (data?.customerWiseDue || []);

  const filteredCustomerDues = displayedCustomers.filter(c => {
    if (!customerSearch.trim()) return true;
    const term = customerSearch.toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(term) ||
      (c.customer_phone || '').includes(term) ||
      (c.invoice_numbers || '').toLowerCase().includes(term) ||
      (c.items || []).some(it => (it.ref || '').toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Revenue & Financial Analytics</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Live Audit
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Financial performance, customer outstanding dues, monthly profit, procurement & stock valuation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAnalytics}
              disabled={loading}
              title="Refresh financial data"
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 touch-scroll flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-400">Auditing financial records...</p>
            </div>
          ) : data ? (
            <>
              {/* 5 Core Metrics Requested by User */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                
                {/* 1. Total Revenue */}
                <div className="bg-gradient-to-br from-slate-800/90 to-slate-850/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Total Revenue</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    ₹{Number(data.totalRevenue || 0).toLocaleString()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300 font-medium">
                      This Month: <strong className="text-emerald-400">₹{Number(data.monthRevenue || 0).toLocaleString()}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Total Invoiced: ₹{Number(data.totalBilled || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 2. Customer Wise Due */}
                <div 
                  onClick={() => setActiveView('dues')}
                  className={`border rounded-2xl p-4 shadow-lg cursor-pointer transition-all relative overflow-hidden group ${
                    activeView === 'dues' 
                      ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-rose-500/50 ring-2 ring-rose-500/20' 
                      : 'bg-slate-800/70 border-slate-750 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Customer Dues</span>
                    <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-rose-300 tracking-tight">
                    ₹{Number(data.totalDue || 0).toLocaleString()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300 font-medium">
                      <strong className="text-rose-400">{data.customerWiseDue?.length || 0}</strong> customer(s) pending
                    </span>
                    <span className="text-[10px] text-sky-400 font-semibold flex items-center gap-1 group-hover:underline">
                      Click to view list &rarr;
                    </span>
                  </div>
                </div>

                {/* 3. Total Profit This Month */}
                <div 
                  onClick={() => setActiveView('profit')}
                  className={`border rounded-2xl p-4 shadow-lg cursor-pointer transition-all relative overflow-hidden group ${
                    activeView === 'profit' 
                      ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-sky-500/50 ring-2 ring-sky-500/20' 
                      : 'bg-slate-800/70 border-slate-750 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Profit This Month</span>
                    <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-sky-300 tracking-tight">
                    ₹{Number(data.profitThisMonth?.totalProfit || 0).toLocaleString()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300">
                      Labor: <strong className="text-slate-200">₹{Number(data.profitThisMonth?.laborIncome || 0).toLocaleString()}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Parts Margin: +₹{Number(data.profitThisMonth?.partsMargin || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 4. Total Purchase This Month */}
                <div 
                  onClick={() => setActiveView('profit')}
                  className="bg-slate-800/70 border border-slate-750 hover:border-slate-700 p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Purchase This Month</span>
                    <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-300 tracking-tight">
                    ₹{Number(data.purchaseThisMonth?.totalPurchase || 0).toLocaleString()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300">
                      Procurement: <strong className="text-slate-200">{data.purchaseThisMonth?.unitsPurchased || 0} units</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Across {data.purchaseThisMonth?.itemsCount || 0} catalog item(s)
                    </span>
                  </div>
                </div>

                {/* 5. Total Unused Stock Amount */}
                <div 
                  onClick={() => setActiveView('inventory')}
                  className={`border rounded-2xl p-4 shadow-lg cursor-pointer transition-all relative overflow-hidden group ${
                    activeView === 'inventory' 
                      ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-purple-500/50 ring-2 ring-purple-500/20' 
                      : 'bg-slate-800/70 border-slate-750 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Unused Stock Amount</span>
                    <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400">
                      <Boxes className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-purple-300 tracking-tight">
                    ₹{Number(data.unusedStock?.totalCost || 0).toLocaleString()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300">
                      Retail: <strong className="text-slate-200">₹{Number(data.unusedStock?.totalRetail || 0).toLocaleString()}</strong>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Est. Profit on Shelf: +₹{Number(data.unusedStock?.potentialProfit || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

              </div>

              {/* View Selector Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/80">
                  <button
                    onClick={() => setActiveView('dues')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeView === 'dues' 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Customer-Wise Dues ({data.customerWiseDue?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveView('profit')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeView === 'profit' 
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Monthly Profit & Purchases</span>
                  </button>

                  <button
                    onClick={() => setActiveView('inventory')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeView === 'inventory' 
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Stock & Capital Valuation</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('invoices');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-sky-400 hover:text-sky-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Open Invoices Page</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('inventory');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-purple-400 hover:text-purple-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Open Inventory</span>
                  </button>
                </div>
              </div>

              {/* View 1: Customer-Wise Due Breakdown */}
              {activeView === 'dues' && (
                <div className="bg-slate-850/90 border border-slate-750 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>Customer Balances & Dues</span>
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Total Due: ₹{Number(data.totalDue || 0).toLocaleString()}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Breakdown of every customer with unsettled invoices and active uninvoiced repair jobs.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700">
                        <button
                          onClick={() => setDueFilter('pending')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            dueFilter === 'pending'
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Dues Only ({data.customerWiseDue?.length || 0})</span>
                        </button>
                        <button
                          onClick={() => setDueFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            dueFilter === 'all'
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          <span>All ({data.allCustomers?.length || data.customerWiseDue?.length || 0})</span>
                        </button>
                      </div>

                      <div className="relative w-full sm:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search customer, phone, ticket..."
                          className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  {filteredCustomerDues.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-750 rounded-2xl bg-slate-800/30">
                      <AlertCircle className="w-8 h-8 mx-auto text-emerald-400/60 mb-2" />
                      <p className="font-semibold text-slate-300 text-sm">
                        {customerSearch ? 'No matching customers found.' : 'All clear! No customer has outstanding dues.'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        All invoices and repair jobs are fully paid and settled.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-750">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-750">
                          <tr>
                            <th className="py-3 px-3.5">Customer</th>
                            <th className="py-3 px-3.5">Contact</th>
                            <th className="py-3 px-3.5">Reference (Invoice / Job)</th>
                            <th className="py-3 px-3.5 text-right">Billed / Value</th>
                            <th className="py-3 px-3.5 text-right">Paid / Advance</th>
                            <th className="py-3 px-3.5 text-right text-rose-400">Balance Due</th>
                            <th className="py-3 px-3.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-750 bg-slate-800/40">
                          {filteredCustomerDues.map((c) => (
                            <tr key={c.customer_id} className="hover:bg-slate-750/50 transition-colors">
                              <td className="py-3 px-3.5 font-bold text-white">
                                <div className="text-slate-100">{c.customer_name}</div>
                                {c.customer_email && <div className="text-[10px] text-slate-400 font-normal">{c.customer_email}</div>}
                              </td>
                              <td className="py-3 px-3.5">
                                <a 
                                  href={`tel:${c.customer_phone}`} 
                                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono text-xs"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{c.customer_phone}</span>
                                </a>
                              </td>
                              <td className="py-3 px-3.5">
                                {c.items && c.items.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {c.items.slice(0, 3).map((it, idx) => (
                                      <div 
                                        key={idx} 
                                        className={`inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded border max-w-fit ${
                                          it.type === 'invoice'
                                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                                            : 'bg-sky-500/10 border-sky-500/25 text-sky-300'
                                        }`}
                                      >
                                        <span className="font-bold">{it.type === 'invoice' ? 'Inv' : 'Job'}:</span>
                                        <span>{it.ref}</span>
                                        {it.due > 0 && (
                                          <span className="text-rose-400 font-bold ml-1">₹{Number(it.due).toLocaleString()}</span>
                                        )}
                                      </div>
                                    ))}
                                    {c.items.length > 3 && (
                                      <span className="text-[10px] text-slate-400">+{c.items.length - 3} more</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-mono text-xs text-slate-400 bg-slate-750/70 px-2 py-0.5 rounded-md border border-slate-700">
                                    {c.invoice_numbers || '-'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-right font-medium text-slate-300">
                                ₹{Number(c.total_invoiced || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3.5 text-right font-medium text-emerald-400">
                                ₹{Number(c.total_paid || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3.5 text-right font-black text-sm">
                                {Number(c.total_due) > 0 ? (
                                  <span className="text-rose-400 font-bold">₹{Number(c.total_due).toLocaleString()}</span>
                                ) : (
                                  <span className="text-emerald-400 font-medium">₹0</span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                {Number(c.total_due) > 0 ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    {(c.unpaid_invoice_count > 0 || (c.items || []).some(i => i.type === 'invoice' && i.due > 0)) && (
                                      <button
                                        onClick={() => {
                                          onClose();
                                          if (onSettleInvoice) {
                                            const inv = (data.pendingInvoices || []).find(i => i.customer_id === c.customer_id)
                                              || (c.items || []).find(i => i.type === 'invoice');
                                            if (inv) {
                                              onSettleInvoice(inv.id);
                                            } else {
                                              onNavigate('invoices');
                                            }
                                          } else {
                                            onNavigate('invoices');
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all active:scale-95"
                                        title="Settle unpaid invoice"
                                      >
                                        <CreditCard className="w-3 h-3" />
                                        <span>Settle</span>
                                      </button>
                                    )}

                                    {((c.items || []).some(i => i.type === 'ticket' && i.due > 0)) && (
                                      <button
                                        onClick={() => {
                                          onClose();
                                          const ticketItem = (c.items || []).find(i => i.type === 'ticket');
                                          if (ticketItem) {
                                            onNavigate('invoices', { ticketId: ticketItem.ticket_id });
                                          } else {
                                            onNavigate('invoices');
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all active:scale-95"
                                        title="Create invoice or bill repair job"
                                      >
                                        <Receipt className="w-3 h-3" />
                                        <span>Bill Job</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                                    <CheckCircle2 className="w-3 h-3" /> Settled
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Monthly Profit & Purchase Detail */}
              {activeView === 'profit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Profit Calculation Box */}
                  <div className="bg-slate-850/90 border border-slate-750 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-750">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">Monthly Profit Breakdown</h4>
                          <span className="text-[11px] text-slate-400">Current calendar month calculation</span>
                        </div>
                      </div>
                      <span className="text-xl font-black text-sky-400">
                        ₹{Number(data.profitThisMonth?.totalProfit || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-750">
                        <span>Labor Charges Collected (100% Service Margin):</span>
                        <strong className="text-emerald-400">+₹{Number(data.profitThisMonth?.laborIncome || 0).toLocaleString()}</strong>
                      </div>

                      <div className="flex justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-750">
                        <span>Parts Billed to Customers:</span>
                        <span className="font-semibold text-slate-200">₹{Number(data.profitThisMonth?.partsRevenue || 0).toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-750">
                        <span>Cost of Parts Incurred (Procurement Cost):</span>
                        <strong className="text-rose-400">-₹{Number(data.profitThisMonth?.partsCost || 0).toLocaleString()}</strong>
                      </div>

                      <div className="flex justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-750">
                        <span>Net Parts Markup Margin:</span>
                        <strong className="text-emerald-400">+₹{Number(data.profitThisMonth?.partsMargin || 0).toLocaleString()}</strong>
                      </div>

                      {Number(data.profitThisMonth?.discountGiven || 0) > 0 && (
                        <div className="flex justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-750">
                          <span>Discounts Deducted:</span>
                          <strong className="text-amber-400">-₹{Number(data.profitThisMonth?.discountGiven || 0).toLocaleString()}</strong>
                        </div>
                      )}

                      <div className="flex justify-between p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sm font-bold text-white mt-3">
                        <span>Total Net Profit This Month:</span>
                        <span className="text-sky-400 text-base">₹{Number(data.profitThisMonth?.totalProfit || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Purchases Box */}
                  <div className="bg-slate-850/90 border border-slate-750 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-750">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">Monthly Inventory Procurement</h4>
                          <span className="text-[11px] text-slate-400">Stock purchased & restocked this month</span>
                        </div>
                      </div>
                      <span className="text-xl font-black text-amber-400">
                        ₹{Number(data.purchaseThisMonth?.totalPurchase || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-750 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Capital Spent on Stock:</span>
                          <span className="font-bold text-white">₹{Number(data.purchaseThisMonth?.totalPurchase || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Quantity Added/Purchased:</span>
                          <span className="font-bold text-amber-400">{data.purchaseThisMonth?.unitsPurchased || 0} Units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Distinct Inventory SKUs Added:</span>
                          <span className="font-bold text-slate-200">{data.purchaseThisMonth?.itemsCount || 0} Items</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-800/40 rounded-xl border border-dashed border-slate-750 text-slate-400 text-xs">
                        <p>
                          💡 <em>Pro-tip: Keeping cost prices updated in Inventory ensures high-fidelity gross profit calculation for each customer job.</em>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onNavigate('inventory');
                        }}
                        className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Package className="w-4 h-4" />
                        <span>Manage Stock & Restock Parts</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* View 3: Inventory Valuation & Unused Stock Detail */}
              {activeView === 'inventory' && (
                <div className="bg-slate-850/90 border border-slate-750 rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-750">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">Unused Stock & Assets Valuation</h4>
                        <p className="text-xs text-slate-400">Valuation of spare parts currently sitting on shelves & bins</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onNavigate('inventory');
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
                    >
                      <span>Open Inventory</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="p-4 bg-slate-800/70 border border-slate-750 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unused Stock Cost (Capital Tied)</span>
                      <div className="text-xl font-black text-purple-300 mt-1">
                        ₹{Number(data.unusedStock?.totalCost || 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Calculated as Unit Cost × In-Stock Quantity
                      </p>
                    </div>

                    <div className="p-4 bg-slate-800/70 border border-slate-750 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Retail Value</span>
                      <div className="text-xl font-black text-sky-300 mt-1">
                        ₹{Number(data.unusedStock?.totalRetail || 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Estimated revenue if all inventory is sold
                      </p>
                    </div>

                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Potential Gross Margin</span>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        +₹{Number(data.unusedStock?.potentialProfit || 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Expected markup on available stock
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
                    <div className="flex items-center gap-4">
                      <span>Total Stock Units: <strong className="text-white">{data.unusedStock?.totalUnits || 0} Units</strong></span>
                      <span>Catalog Items: <strong className="text-white">{data.unusedStock?.distinctSkus || 0} SKUs</strong></span>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      Audited live across all storage locations & bins.
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Financial Ledger</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl font-semibold transition-all active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
