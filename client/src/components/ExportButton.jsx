import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, ChevronDown, Check, Download } from 'lucide-react';
import { exportToExcel } from '../utils/export';

export default function ExportButton({
  filename = 'SSC_Export',
  columns = [],
  data = [],
  label = 'Export Excel',
  sheetName = 'Sheet1',
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = (format) => {
    setIsOpen(false);
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }
    exportToExcel(filename, columns, data, { format, sheetName });
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      {/* Primary Action Button */}
      <div className="inline-flex rounded-xl shadow-sm">
        <button
          type="button"
          disabled={disabled || !data || data.length === 0}
          onClick={() => handleExport('csv')}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-l-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          title={`Export ${data?.length || 0} records to Excel`}
        >
          {exported ? (
            <Check className="w-4 h-4 text-emerald-300 animate-scaleIn" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          )}
          <span>{exported ? 'Exported!' : label}</span>
        </button>

        {/* Dropdown Options Toggle */}
        <button
          type="button"
          disabled={disabled || !data || data.length === 0}
          onClick={() => setIsOpen(!isOpen)}
          className="px-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-y border-r border-l-0 border-emerald-500/30 rounded-r-xl text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          title="Choose Excel format"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Format Selector Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 animate-fadeIn">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            Export Format Options ({data.length} records)
          </div>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 transition-colors flex items-center gap-2.5 text-slate-200 hover:text-white"
          >
            <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold">Excel Spreadsheet (.csv)</div>
              <div className="text-[10px] text-slate-400">Universal, opens directly in MS Excel</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExport('xls')}
            className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 transition-colors flex items-center gap-2.5 text-slate-200 hover:text-white"
          >
            <div className="p-1 rounded bg-sky-500/20 text-sky-400">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold">Excel Workbook (.xls)</div>
              <div className="text-[10px] text-slate-400">Styled XML workbook with colored headers</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
