/**
 * Utility functions for exporting tabular data to Microsoft Excel (.csv and .xls).
 * Supports UTF-8 BOM encoding for seamless character rendering (₹, accents, Tamil/Hindi)
 * and XML Spreadsheet 2003 for rich Excel workbook formatting.
 */

// Helper to escape CSV cell values (RFC 4180 compliant)
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // If text starts with dangerous formula triggers (=, +, -, @), format safely
  if (/^[=+\-@]/.test(str)) {
    // If it looks like a phone number e.g. +91 98765 43210, use Excel text formula to preserve formatting
    if (/^\+\d+[\d\s\-()]*$/.test(str)) {
      return `="${str}"`;
    }
    str = "'" + str;
  }

  return `"${str.replace(/"/g, '""')}"`;
}

// Helper to escape XML characters
function escapeXml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Get current date string for file naming (YYYY-MM-DD)
export function getExportDateStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Exports data as an RFC-4180 compliant CSV file with UTF-8 BOM.
 * Excel natively associates with .csv and opens it directly with correct columns and characters.
 */
export function exportToCsv(filename, columns, data) {
  if (!Array.isArray(data) || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  const rows = [];
  
  // Header Row
  rows.push(columns.map(c => sanitizeCsvValue(c.header)).join(','));

  // Data Rows
  for (const item of data) {
    const row = columns.map(c => {
      const raw = item[c.key];
      const val = typeof c.format === 'function' ? c.format(raw, item) : raw;
      return sanitizeCsvValue(val);
    });
    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows opens it in UTF-8
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const finalFilename = `${filename}_${getExportDateStr()}.csv`;
  downloadBlob(blob, finalFilename);
}

/**
 * Exports data as XML Spreadsheet 2003 (.xls).
 * Native Microsoft Excel format with colored header row, font styling, and numeric data types.
 */
export function exportToXls(filename, columns, data, sheetName = 'Sheet1') {
  if (!Array.isArray(data) || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
  xml += ' <Styles>\n';
  xml += '  <Style ss:ID="Header">\n';
  xml += '   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>\n';
  xml += '   <Interior ss:Color="#0284C7" ss:Pattern="Solid"/>\n';
  xml += '   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>\n';
  xml += '   <Borders>\n';
  xml += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0369A1"/>\n';
  xml += '   </Borders>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Default">\n';
  xml += '   <Font ss:Color="#000000" ss:Size="10"/>\n';
  xml += '   <Alignment ss:Vertical="Center"/>\n';
  xml += '   <Borders>\n';
  xml += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>\n';
  xml += '   </Borders>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Number">\n';
  xml += '   <Font ss:Color="#000000" ss:Size="10"/>\n';
  xml += '   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n';
  xml += '   <NumberFormat ss:Format="#,##0.00"/>\n';
  xml += '   <Borders>\n';
  xml += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>\n';
  xml += '   </Borders>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Integer">\n';
  xml += '   <Font ss:Color="#000000" ss:Size="10"/>\n';
  xml += '   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n';
  xml += '   <NumberFormat ss:Format="#,##0"/>\n';
  xml += '   <Borders>\n';
  xml += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>\n';
  xml += '   </Borders>\n';
  xml += '  </Style>\n';
  xml += ' </Styles>\n';
  xml += ` <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">\n`;
  xml += '  <Table>\n';

  // Column definitions with suggested widths
  for (const col of columns) {
    const width = Math.max(80, (col.header?.length || 10) * 9);
    xml += `   <Column ss:Width="${width}"/>\n`;
  }

  // Header Row
  xml += '   <Row ss:Height="24">\n';
  for (const col of columns) {
    xml += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>\n`;
  }
  xml += '   </Row>\n';

  // Data Rows
  for (const item of data) {
    xml += '   <Row ss:Height="20">\n';
    for (const col of columns) {
      const raw = item[col.key];
      const val = typeof col.format === 'function' ? col.format(raw, item) : raw;

      let type = 'String';
      let styleId = 'Default';

      if (typeof val === 'number' && !isNaN(val)) {
        type = 'Number';
        styleId = Number.isInteger(val) ? 'Integer' : 'Number';
      }

      xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(val ?? '')}</Data></Cell>\n`;
    }
    xml += '   </Row>\n';
  }

  xml += '  </Table>\n';
  xml += ' </Worksheet>\n';
  xml += '</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const finalFilename = `${filename}_${getExportDateStr()}.xls`;
  downloadBlob(blob, finalFilename);
}

/**
 * General export helper function.
 */
export function exportToExcel(filename, columns, data, { format = 'csv', sheetName = 'Sheet1' } = {}) {
  if (format === 'xls') {
    return exportToXls(filename, columns, data, sheetName);
  }
  return exportToCsv(filename, columns, data);
}

// Helper to trigger browser download
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
}
