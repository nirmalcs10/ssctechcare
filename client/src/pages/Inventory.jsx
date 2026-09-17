import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Edit, 
  Trash2, 
  X,
  PackageCheck
} from 'lucide-react';
import { api } from '../api';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [stockChange, setStockChange] = useState('');

  // New item form
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    category: 'RAM',
    brand_compat: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    min_threshold: '3',
    location: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadInventory();
  }, [selectedCat, showLowStockOnly, searchQuery]);

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCat !== 'ALL') params.category = selectedCat;
      if (showLowStockOnly) params.low_stock = 'true';
      if (searchQuery) params.search = searchQuery;

      const data = await api.getInventory(params);
      setItems(data);
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await api.createInventoryItem(newItem);
      setIsAddOpen(false);
      setNewItem({
        sku: '',
        name: '',
        category: 'RAM',
        brand_compat: '',
        cost_price: '',
        selling_price: '',
        stock_quantity: '',
        min_threshold: '3',
        location: ''
      });
      loadInventory();
      loadCategories();
    } catch (err) {
      alert('Failed to add part: ' + err.message);
    }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    if (!stockItem || !stockChange) return;
    try {
      await api.adjustStock(stockItem.id, stockChange, 'Manual workshop adjustment');
      setIsStockOpen(false);
      setStockItem(null);
      setStockChange('');
      loadInventory();
    } catch (err) {
      alert('Failed to adjust stock: ' + err.message);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!confirm(`Delete "${name}" from inventory?`)) return;
    try {
      const res = await api.deleteInventoryItem(id);
      if (res.error) {
        alert(res.error);
      } else {
        loadInventory();
      }
    } catch (err) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Spare Parts & Warehouse Inventory</h1>
          <p className="text-sm text-slate-400">Track replacement displays, SSDs, RAM, batteries, cooling fans & thermals</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Spare Part</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === 'ALL'
                ? 'bg-sky-500 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Low stock toggle */}
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              showLowStockOnly
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Low Stock Alerts</span>
          </button>

          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, model..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Inventory Items Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading parts catalog...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Boxes className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No spare parts found</p>
            <p className="text-xs text-slate-500 mt-1">Adjust filters or click "Add Spare Part".</p>
          </div>
        ) : (
          <div className="overflow-x-auto touch-scroll overscroll-y-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[700px]">
              <thead className="bg-slate-800/80 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Part Name & Compatibility</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Cost (₹)</th>
                  <th className="py-3 px-4 text-right">Selling Price (₹)</th>
                  <th className="py-3 px-4 text-center">Stock Level</th>
                  <th className="py-3 px-4">Shelf / Bin</th>
                  <th className="py-3 px-4 text-right">Stock Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {items.map(item => {
                  const isLowStock = item.stock_quantity <= item.min_threshold;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-400 text-xs">
                        {item.sku}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{item.name}</div>
                        {item.brand_compat && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Fits: {item.brand_compat}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ₹{parseFloat(item.cost_price).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                        ₹{parseFloat(item.selling_price).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isLowStock
                            ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}>
                          {item.stock_quantity}
                          {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {item.location || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Adjust Button */}
                          <button
                            onClick={() => {
                              setStockItem(item);
                              setIsStockOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors"
                          >
                            +/- Stock
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Part Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add New Spare Part / Material</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Part SKU / Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SSD-1TB-NVME"
                    value={newItem.sku}
                    onChange={e => setNewItem({ ...newItem, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Storage, RAM, Display..."
                    value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Part Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kingston 1TB NVMe M.2 SSD"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Compatible Brands / Models</label>
                <input
                  type="text"
                  placeholder="e.g. Dell XPS, Lenovo ThinkPad, HP..."
                  value={newItem.brand_compat}
                  onChange={e => setNewItem({ ...newItem, brand_compat: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    value={newItem.cost_price}
                    onChange={e => setNewItem({ ...newItem, cost_price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Selling / Retail Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newItem.selling_price}
                    onChange={e => setNewItem({ ...newItem, selling_price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={newItem.stock_quantity}
                    onChange={e => setNewItem({ ...newItem, stock_quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Low Stock Alert at</label>
                  <input
                    type="number"
                    value={newItem.min_threshold}
                    onChange={e => setNewItem({ ...newItem, min_threshold: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bin / Shelf</label>
                  <input
                    type="text"
                    placeholder="Rack A-2"
                    value={newItem.location}
                    onChange={e => setNewItem({ ...newItem, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
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
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isStockOpen && stockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">
              Adjust Stock: <span className="text-sky-400">{stockItem.name}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Current stock: <span className="font-bold text-white">{stockItem.stock_quantity}</span>
            </p>

            <form onSubmit={handleStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Adjustment (e.g. +5 to add stock, or -2 for damage)
                </label>
                <input
                  type="number"
                  required
                  placeholder="+5 or -2"
                  value={stockChange}
                  onChange={e => setStockChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsStockOpen(false);
                    setStockItem(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold"
                >
                  Update Quantity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
