import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { router } from '@inertiajs/react';

// shared Utilities & Hooks
import { ITEMS_PER_PAGE } from '../Utils/constants';
import { useExchangeRates } from '../Hooks/useExchangeRates';
import { getNextMonthString } from '../Utils/helpers';
import { downloadCSV } from '../Utils/exportUtils';
import { useDebounce } from '../Hooks/useDebounce';
import { usePagination } from '../Hooks/usePagination';
import { useColumnVisibility } from '../Hooks/useColumnVisibility';
import Pagination from './Shared/Pagination';
import MonthPicker from './Shared/MonthPicker';
import ColumnSettings from './Shared/ColumnSetting';

const DEFAULT_COLS = {
    salesRep: true, bpName: true, lobName: true, category: true, line: false, group: false, itemCode: true, description: false, 
    brand: false, ln_price: false, cogs_price: false, cogs_currency: false, kmi_qty: true, 
    kme_qty: true, total_qty: false, avg12m: false, avg6m: false, avg3m: false, confirmed_qty: true   
};

type SortColumn = 'lobName' | 'bpName' | 'itemCode' | 'category' | 'salesRep';
type SortDirection = 'asc' | 'desc';

export default function SummaryByBP({ isActive, dbLobs, dbProducts, dbPricing, dbEntries, searchTerm, user }: any) {
  const { USD_TO_AED_RATE } = useExchangeRates();
  const [monthFilter, setMonthFilter] = useState(getNextMonthString());
  const [isLoadingData, setIsLoadingData] = useState(false); 
  const [sortConfig, setSortConfig] = useState<{ key: SortColumn, direction: SortDirection }>({ key: 'salesRep', direction: 'asc' });
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { visibleCols, toggleColumn } = useColumnVisibility('kmePlannerBPColumnPrefs', DEFAULT_COLS);

  const fetchedMonth = useRef<string | null>(null);

  useEffect(() => {
      if (!isActive) return;
      const showSpinner = fetchedMonth.current !== monthFilter;
      
      if (showSpinner) {
          setIsLoadingData(true);
      }
      router.reload({
          only: ['dbProductsMonth', 'dbPricingMonth', 'dbEntriesMonth'],
          data: { summary_month: monthFilter },
          onFinish: () => {
              if (showSpinner) {
                  setIsLoadingData(false);
                  fetchedMonth.current = monthFilter;
              }
          }
      });
  }, [isActive, monthFilter]); 

  const handleSort = (key: SortColumn) => {
      setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const { bpStatsMap } = useMemo(() => {
      if (!Array.isArray(dbEntries)) return { bpStatsMap: {} };
      const statsMap: Record<string, { totalQty: number, totalConfirmedQty: number, totalNetSales: number, lob_code: string, lob_name: string, rep_name: string, bp_name: string, product_id: number }> = {};

      dbEntries.forEach((entry: any) => {
          if (entry.planning_month === monthFilter && Number(entry.planned_quantity) > 0) {
              const lob = dbLobs?.find((l: any) => l.lob_id === entry.lob_id);
              if (!lob) return;

              const lobName = lob.lob_name || '-';
              const repName = lob.sales_rep_name || lob.sales_representative_no || 'Unknown';
              const bpName = lob.sold_to_bp_name || lob.sold_to_bp || '-';
              const bpCode = lob.sold_to_bp || lob.lob_code || 'Unknown';
              const pid = Number(entry.product_id);
              
              //  ensures uniqueness across the entire hierarchy
              const key = `${repName}-${bpName}-${lobName}-${pid}`;
              
              if (!statsMap[key]) {
                  statsMap[key] = { totalQty: 0, totalConfirmedQty: 0, totalNetSales: 0, lob_code: bpCode, lob_name: lobName, rep_name: repName, bp_name: bpName, product_id: pid };
              }

              const qty = Number(entry.planned_quantity);
              const confirmedQty = Number(entry.confirmed_quantity || 0);
              const amount = Number(entry.total_amount);

              statsMap[key].totalQty += qty;
              statsMap[key].totalConfirmedQty += confirmedQty;
              statsMap[key].totalNetSales += amount; 
          }
      });
      return { bpStatsMap: statsMap };
  }, [dbEntries, monthFilter, dbLobs]);

  const bpSummaryData = useMemo(() => {
      if (!Array.isArray(dbProducts) || !Array.isArray(dbPricing)) return [];
      let activeData = Object.values(bpStatsMap).map((stat: any) => {
          const prod = dbProducts.find((p: any) => p.product_id === stat.product_id) || {};
          const matchingLobs = dbLobs.filter((l: any) => (l.sold_to_bp || l.lob_code) === stat.lob_code).map((l: any) => l.lob_id);
          let basePrice = dbPricing.find((p: any) => p.product_id === stat.product_id && matchingLobs.includes(p.lob_id)) || dbPricing.find((p: any) => p.product_id === stat.product_id && p.lob_id === null);
          let exactLnPrice: number | null = null;
          if (basePrice) {
              exactLnPrice = Number(basePrice.price);
          }

          const cogsRaw = Number(prod.cogs_price) || 0;
          const isCogsUsd = (prod.cogs_currency || '').toUpperCase() === 'USD';

          return {
              ...prod, unique_key: `${stat.rep_name}-${stat.bp_name}-${stat.lob_name}-${stat.product_id}`, 
              lob_name: stat.lob_name, sales_rep_name: stat.rep_name, bp_name: stat.bp_name, bp_code: stat.lob_code,
              forecast_qty: stat.totalQty, confirmed_qty: stat.totalConfirmedQty, net_sales: stat.totalNetSales, 
              ln_price: exactLnPrice, cogs_aed_value: isCogsUsd ? (cogsRaw * USD_TO_AED_RATE) : cogsRaw, is_cogs_usd: isCogsUsd
          };
      });

      if (debouncedSearchTerm) {
          const lower = debouncedSearchTerm.toLowerCase();
          activeData = activeData.filter((item: any) => 
              (item.sales_rep_name || '').toLowerCase().includes(lower) || 
              (item.bp_name || '').toLowerCase().includes(lower) || (item.bp_code || '').toLowerCase().includes(lower) ||
              (item.lob_name || '').toLowerCase().includes(lower) || 
              (item.product_model || '').toLowerCase().includes(lower) || (item.item_code || '').toLowerCase().includes(lower) ||
              (item.item_description || '').toLowerCase().includes(lower) || (item.product_category || '').toLowerCase().includes(lower) ||
              (item.product_line || '').toLowerCase().includes(lower) || (item.brand || '').toLowerCase().includes(lower)
          );
      }

      activeData.sort((a: any, b: any) => {
          const dir = sortConfig.direction === 'asc' ? 1 : -1;
          
          //  Sorting: Rep -> BP -> LOB -> Category -> Model
          const repCompare = (a.sales_rep_name || '').localeCompare(b.sales_rep_name || '');
          if (repCompare !== 0) return sortConfig.key === 'salesRep' ? repCompare * dir : repCompare;

          const bpCompare = (a.bp_name || '').localeCompare(b.bp_name || '');
          if (bpCompare !== 0) return sortConfig.key === 'bpName' ? bpCompare * dir : bpCompare;
          
          const lobCompare = (a.lob_name || '').localeCompare(b.lob_name || '');
          if (lobCompare !== 0) return sortConfig.key === 'lobName' ? lobCompare * dir : lobCompare;
          
          const catCompare = (a.product_category || '').localeCompare(b.product_category || '');
          if (catCompare !== 0) return sortConfig.key === 'category' ? catCompare * dir : catCompare;
          
          return (a.product_model || '').localeCompare(b.product_model || '');
      });

      const dataWithSubtotals: any[] = [];
      let currentGroup: any[] = [];
      let actualItemNumber = 1; 

      for (let i = 0; i < activeData.length; i++) {
          const row = activeData[i];
          row.display_index = actualItemNumber++;
          dataWithSubtotals.push(row);
          currentGroup.push(row);

          const nextRow = activeData[i + 1];
          if (!nextRow || 
              nextRow.sales_rep_name !== row.sales_rep_name || 
              nextRow.bp_name !== row.bp_name || 
              nextRow.lob_name !== row.lob_name || 
              nextRow.product_category !== row.product_category) {
              
              const sumCogsAed = currentGroup.reduce((sum, r) => sum + (r.cogs_aed_value || 0), 0);

              dataWithSubtotals.push({
                  isSubtotal: true, unique_key: `subtotal-${row.sales_rep_name}-${row.bp_name}-${row.lob_name}-${row.product_category}`, 
                  lob_name: row.lob_name, sales_rep_name: row.sales_rep_name, bp_name: row.bp_name, bp_code: row.bp_code,
                  product_category: row.product_category || 'Uncategorized', ln_price: currentGroup.reduce((sum, r) => sum + (r.ln_price || 0), 0),
                  cogs_aed_value: sumCogsAed, cogs_usd_value: sumCogsAed / USD_TO_AED_RATE, kmi_qty: currentGroup.reduce((sum, r) => sum + (Number(r.kmi_qty || r.kmmi_qty) || 0), 0),
                  kme_qty: currentGroup.reduce((sum, r) => sum + (Number(r.kme_qty) || 0), 0), total_qty: currentGroup.reduce((sum, r) => sum + (Number(r.total_qty) || 0), 0),
                  avg_12m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_12m_sales) || 0), 0), avg_6m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_6m_sales) || 0), 0),
                  avg_3m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_3m_sales) || 0), 0), forecast_qty: currentGroup.reduce((sum, r) => sum + (r.forecast_qty || 0), 0),
                  confirmed_qty: currentGroup.reduce((sum, r) => sum + (r.confirmed_qty || 0), 0), net_sales: currentGroup.reduce((sum, r) => sum + (r.net_sales || 0), 0)
              });
              currentGroup = [];
          }
      }
      return dataWithSubtotals;
  }, [dbEntries, monthFilter, dbProducts, dbLobs, dbPricing, debouncedSearchTerm, sortConfig, bpStatsMap]);

  const { currentPage, totalPages, paginatedData, goToNextPage, goToPrevPage, setCurrentPage } = usePagination(bpSummaryData, ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [debouncedSearchTerm, sortConfig, setCurrentPage]);

  const gridTotals = useMemo(() => {
      const totals = { forecast_qty: 0, confirmed_qty: 0, net_sales: 0, kmi_qty: 0, kme_qty: 0, total_qty: 0 };
      bpSummaryData.forEach((row: any) => {
          if (!row.isSubtotal) {
              totals.forecast_qty += row.forecast_qty; 
              totals.confirmed_qty += row.confirmed_qty;
              totals.net_sales += row.net_sales;
              totals.kmi_qty += Number(row.kmi_qty || row.kmmi_qty || 0); totals.kme_qty += Number(row.kme_qty || 0); totals.total_qty += Number(row.total_qty || 0);
          }
      });
      return totals;
  }, [bpSummaryData]);

  const exportToCSV = () => {
    if (bpSummaryData.length === 0) return;
    
    const qtyHeaders = visibleCols.confirmed_qty ? ['Total Forecast Qty', 'Total Confirm Qty', 'Total Net Sales (AED)'] : ['Total Forecast Qty', 'Total Net Sales (AED)'];
    const headers = ['No', 'Sales Rep', 'BP Name', 'BP Code', 'LOB', 'Product Category', 'Product Line', 'Product Group', 'Product Model', 'Item Code', 'Item Description', 'Brand', 'LN Price (AED)', 'COGS Price', 'COGS Currency', 'KMI On Hand', 'KME On Hand', 'Total On Hand', '12M Avg (Sales)', '6M Avg (Sales)', '3M Avg (Sales)', ...qtyHeaders];
    
    const exportData = bpSummaryData.filter((item: any) => !item.isSubtotal);
    const rows = exportData.map((item: any) => {
        const safeDesc = item.item_description ? `"${item.item_description.replace(/"/g, '""')}"` : '""';
        const qtyData = visibleCols.confirmed_qty ? [item.forecast_qty || 0, item.confirmed_qty || 0, (item.net_sales || 0).toFixed(2)] : [item.forecast_qty || 0, (item.net_sales || 0).toFixed(2)];

        return [item.display_index, `"${item.sales_rep_name || '-'}"`, `"${item.bp_name || '-'}"`, `"${item.bp_code || '-'}"`, `"${item.lob_name || '-'}"`, `"${item.product_category || '-'}"`, `"${item.product_line || '-'}"`, `"${item.item_group || '-'}"`, `"${item.product_model || '-'}"`, `"${item.item_code || '-'}"`, safeDesc, `"${item.brand || '-'}"`, item.ln_price !== null ? item.ln_price.toFixed(2) : '#N/A', item.cogs_price ? Number(item.cogs_price).toFixed(2) : '#N/A', item.cogs_currency || '-', item.kmi_qty || item.kmmi_qty || 0, item.kme_qty || 0, item.total_qty || 0, Number(item.avg_12m_sales || 0).toFixed(1), Number(item.avg_6m_sales || 0).toFixed(1), Number(item.avg_3m_sales || 0).toFixed(1), ...qtyData].join(',');
    });
    downloadCSV(`Summary_by_BP_${monthFilter}.csv`, headers, rows);
  };

  let activeColCount = 3 + Object.values(visibleCols).filter(Boolean).length; 

  let subtotalColSpan = 1; 
  if (visibleCols.category) subtotalColSpan++; if (visibleCols.line) subtotalColSpan++; if (visibleCols.group) subtotalColSpan++;
  if (visibleCols.itemCode) subtotalColSpan++; if (visibleCols.description) subtotalColSpan++; if (visibleCols.brand) subtotalColSpan++;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[800px] animate-in fade-in duration-300">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Summary By Business Partner</h3>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Forecast View:</span>
                <MonthPicker value={monthFilter} onChange={setMonthFilter} className="text-xs font-black text-blue-600 h-6 px-1 cursor-pointer" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500 font-bold bg-slate-200 px-3 py-1.5 rounded-full">{bpSummaryData.filter(d => !d.isSubtotal).length} Rows</div>
              
              <ColumnSettings>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.salesRep} onChange={() => toggleColumn('salesRep')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Sales Rep</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.bpName} onChange={() => toggleColumn('bpName')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />BP Name</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.lobName} onChange={() => toggleColumn('lobName')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />LOB</label>
                  <div className="border-t border-slate-100 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.category} onChange={() => toggleColumn('category')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Product Category</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.line} onChange={() => toggleColumn('line')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Product Line</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.group} onChange={() => toggleColumn('group')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Product Group</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.itemCode} onChange={() => toggleColumn('itemCode')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Item Code</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.description} onChange={() => toggleColumn('description')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Item Description</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.brand} onChange={() => toggleColumn('brand')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Brand</label>
                  <div className="border-t border-slate-100 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-emerald-600"><input type="checkbox" checked={visibleCols.ln_price} onChange={() => toggleColumn('ln_price')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />LN Price (AED)</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-rose-600"><input type="checkbox" checked={visibleCols.cogs_price} onChange={() => toggleColumn('cogs_price')} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />COGS Price</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-rose-600"><input type="checkbox" checked={visibleCols.cogs_currency} onChange={() => toggleColumn('cogs_currency')} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />COGS Currency</label>
                  <div className="border-t border-slate-100 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.kmi_qty} onChange={() => toggleColumn('kmi_qty')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />KMI On Hand</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.kme_qty} onChange={() => toggleColumn('kme_qty')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />KME On Hand</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.total_qty} onChange={() => toggleColumn('total_qty')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Total On Hand</label>
                  <div className="border-t border-slate-100 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.avg12m} onChange={() => toggleColumn('avg12m')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />12M Avg (Sales)</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.avg6m} onChange={() => toggleColumn('avg6m')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />6M Avg (Sales)</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600"><input type="checkbox" checked={visibleCols.avg3m} onChange={() => toggleColumn('avg3m')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />3M Avg (Sales)</label>
                  <div className="border-t border-slate-100 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-emerald-600"><input type="checkbox" checked={visibleCols.confirmed_qty} onChange={() => toggleColumn('confirmed_qty')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />Confirmed Qty</label>
              </ColumnSettings>

              <button onClick={exportToCSV} disabled={bpSummaryData.length === 0} className="flex items-center gap-2 text-xs font-bold bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  <Download size={14} /> Export CSV
              </button>
          </div>
        </div>
    <div className="overflow-auto flex-1 relative" aria-busy={isLoadingData}>
        {isLoadingData ? (
            <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50 gap-3 z-50">
                <Loader2 size={30} className="animate-spin text-blue-500" />
                <span className="text-sm font-medium">Aggregating Data for {monthFilter}...</span>
            </div>
        ) : (
            <table className="w-full text-[12px] text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-center">No</th>
                        
                        {visibleCols.salesRep && (
                            <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold hover:bg-[#cde4bf] transition-colors cursor-pointer group" onClick={() => handleSort('salesRep')}>
                                <div className="flex items-center justify-between gap-2">Sales Rep {sortConfig.key === 'salesRep' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>) : <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100" />}</div>
                            </th>
                        )}
                        {visibleCols.bpName && (
                            <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold hover:bg-[#cde4bf] transition-colors cursor-pointer group" onClick={() => handleSort('bpName')}>
                                <div className="flex items-center justify-between gap-2">BP Name {sortConfig.key === 'bpName' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>) : <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100" />}</div>
                            </th>
                        )}
                        {visibleCols.lobName && (
                            <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold hover:bg-[#cde4bf] transition-colors cursor-pointer group" onClick={() => handleSort('lobName')}>
                                <div className="flex items-center justify-between gap-2">LOB {sortConfig.key === 'lobName' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>) : <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100" />}</div>
                            </th>
                        )}
                        {visibleCols.category && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Product Category</th>}
                        {visibleCols.line && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Product Line</th>}
                        {visibleCols.group && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Product Group</th>}
                        <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Product Model</th>
                        {visibleCols.itemCode && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Item Code</th>}
                        {visibleCols.description && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Item Description</th>}
                        {visibleCols.brand && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold">Brand</th>}
                        {visibleCols.ln_price && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-right">LN Price (AED)</th>}
                        {visibleCols.cogs_price && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-right">COGS Price</th>}
                        {visibleCols.cogs_currency && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-center">COGS Currency</th>}
                        {visibleCols.kmi_qty && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-center">KMI On Hand</th>}
                        {visibleCols.kme_qty && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-center">KME On Hand</th>}
                        {visibleCols.total_qty && <th className="border border-slate-300 bg-[#e2f0d9] px-3 py-2 text-slate-800 font-bold text-center">Total On Hand</th>}
                        {visibleCols.avg12m && <th className="border border-slate-300 bg-blue-100 px-3 py-2 text-blue-800 font-bold text-center">12M Avg (Sales)</th>}
                        {visibleCols.avg6m && <th className="border border-slate-300 bg-blue-100 px-3 py-2 text-blue-800 font-bold text-center">6M Avg (Sales)</th>}
                        {visibleCols.avg3m && <th className="border border-slate-300 bg-blue-100 px-3 py-2 text-blue-800 font-bold text-center">3M Avg (Sales)</th>}
                        
                        <th className="border border-slate-300 bg-emerald-600 px-3 py-2 text-white font-bold text-center shadow-lg border-l-slate-400"><div>Total Forecast Qty</div></th>
                        {visibleCols.confirmed_qty && (
                            <th className="border border-slate-300 bg-emerald-600 px-3 py-2 text-white font-bold text-center shadow-lg"><div> Total Confirm Qty</div></th>
                        )}
                        <th className="border border-slate-300 bg-emerald-600 px-3 py-2 text-white font-bold text-center shadow-lg"><div>Total Net Sales (AED)</div></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((item: any, idx: number) => {
                        const isFirstRep = idx === 0 || item.sales_rep_name !== paginatedData[idx - 1].sales_rep_name;
                        const isFirstBp = isFirstRep || item.bp_name !== paginatedData[idx - 1].bp_name;
                        const isFirstLob = isFirstBp || item.lob_name !== paginatedData[idx - 1].lob_name; // 1:1 with BP, shares boundary

                        let repRowSpan = 1; let bpRowSpan = 1; let lobRowSpan = 1;
                        
                        if (isFirstRep) {
                            for (let i = idx + 1; i < paginatedData.length; i++) {
                                if (paginatedData[i].sales_rep_name === item.sales_rep_name) repRowSpan++; else break;
                            }
                        }
                        if (isFirstBp) {
                            for (let i = idx + 1; i < paginatedData.length; i++) {
                                if (paginatedData[i].sales_rep_name === item.sales_rep_name && paginatedData[i].bp_name === item.bp_name) {
                                    bpRowSpan++;
                                    lobRowSpan++; // Matches BP exactly
                                } else break;
                            }
                        }

                        if (item.isSubtotal) {
                            return (
                                <tr key={item.unique_key} className="bg-slate-100/80 transition-colors border-y border-slate-300">
                                    <td className="border border-slate-200 px-3 py-2"></td>
                                    {/* Subtotal row sits beneath the grouping */}
                                    <td colSpan={subtotalColSpan} className="border border-slate-200 px-3 py-2 text-right text-slate-700 font-bold uppercase tracking-wider">Total {item.product_category}</td>
                                    {visibleCols.ln_price && <td className="border border-slate-200 px-3 py-2 text-right text-emerald-700">{item.ln_price > 0 ? item.ln_price.toFixed(2) : '-'}</td>}
                                    {visibleCols.cogs_price && (<td className="border border-slate-200 px-3 py-2 text-right text-rose-700"><div className="flex flex-col items-end"><span>{item.cogs_usd_value.toFixed(2)}</span><span className="text-slate-500">(AED {item.cogs_aed_value.toFixed(2)})</span></div></td>)}
                                    {visibleCols.cogs_currency && <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">USD</td>}
                                    {visibleCols.kmi_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-800">{item.kmi_qty}</td>}
                                    {visibleCols.kme_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-800">{item.kme_qty}</td>}
                                    {visibleCols.total_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-900 bg-slate-200/50">{item.total_qty}</td>}
                                    {visibleCols.avg12m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-800">{item.avg_12m_sales.toFixed(1)}</td>}
                                    {visibleCols.avg6m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-800">{item.avg_6m_sales.toFixed(1)}</td>}
                                    {visibleCols.avg3m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-800">{item.avg_3m_sales.toFixed(1)}</td>}
                                    
                                    <td className={`border border-slate-300 px-3 py-2 text-center border-l-slate-400 ${item.forecast_qty > 0 ? 'bg-emerald-50 text-slate-900' : 'text-slate-300'}`}>{item.forecast_qty > 0 ? item.forecast_qty : '-'}</td>
                                    {visibleCols.confirmed_qty && (
                                        <td className={`border border-slate-300 px-3 py-2 text-center ${item.confirmed_qty > 0 ? 'bg-emerald-50 text-slate-900' : 'text-slate-300'}`}>{item.confirmed_qty > 0 ? item.confirmed_qty : '-'}</td>
                                    )}
                                    <td className={`border border-slate-300 px-3 py-2 text-right ${item.forecast_qty > 0 ? 'bg-emerald-50 text-slate-900' : 'text-slate-300'}`}>{item.forecast_qty > 0 ? item.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                </tr>
                            );
                        }

                        const isCogsUsd = (item.cogs_currency || '').toUpperCase() === 'USD';
                        const cogsPriceAed = isCogsUsd && item.cogs_price ? (Number(item.cogs_price) * USD_TO_AED_RATE).toFixed(2) : null;

                        return (
                            <tr key={item.unique_key} className="hover:bg-slate-50 transition-colors">
                                <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{item.display_index}</td>
                                
                                {visibleCols.salesRep && isFirstRep && (<td rowSpan={repRowSpan} className="border border-slate-200 px-3 py-2 text-slate-700 font-bold align-middle max-w-[150px] whitespace-normal leading-relaxed bg-slate-50" title={item.sales_rep_name}>{item.sales_rep_name}</td>)}
                                {visibleCols.bpName && isFirstBp && (<td rowSpan={bpRowSpan} className="border border-slate-200 px-3 py-2 text-blue-700 font-bold align-middle max-w-[200px] whitespace-normal leading-relaxed bg-white" title={item.bp_name}>{item.bp_name}</td>)}
                                {visibleCols.lobName && isFirstLob && (<td rowSpan={lobRowSpan} className="border border-slate-200 px-3 py-2 text-slate-600 font-medium align-middle max-w-[150px] whitespace-normal leading-relaxed bg-white" title={item.lob_name}>{item.lob_name}</td>)}

                                {visibleCols.category && <td className="border border-slate-200 px-3 py-2 text-slate-700">{item.product_category}</td>}
                                {visibleCols.line && <td className="border border-slate-200 px-3 py-2 text-slate-700">{item.product_line}</td>}
                                {visibleCols.group && <td className="border border-slate-200 px-3 py-2 text-slate-700">{item.item_group}</td>}
                                <td className="border border-slate-200 px-3 py-2 text-slate-800 font-bold">{item.product_model}</td>
                                {visibleCols.itemCode && <td className="border border-slate-200 px-3 py-2 text-slate-500 font-mono">{item.item_code}</td>}
                                {visibleCols.description && <td className="border border-slate-200 px-3 py-2 text-slate-600 truncate max-w-xs">{item.item_description}</td>}
                                {visibleCols.brand && <td className="border border-slate-200 px-3 py-2 text-slate-700">{item.brand}</td>}
                                {visibleCols.ln_price && <td className={`border border-slate-200 px-3 py-2 text-right tracking-wider ${item.ln_price !== null ? 'text-emerald-600' : 'text-slate-300 italic'}`}>{item.ln_price !== null ? item.ln_price.toFixed(2) : '#N/A'}</td>}
                                {visibleCols.cogs_price && (
                                    <td className={`border border-slate-200 px-3 py-2 text-right tracking-wider ${item.cogs_price ? 'text-rose-600' : 'text-slate-300 italic'}`}>
                                        {item.cogs_price ? (<div className="flex flex-col items-end"><span>{Number(item.cogs_price).toFixed(2)}</span>{isCogsUsd && <span className="text-slate-500">(AED {cogsPriceAed})</span>}</div>) : '#N/A'}
                                    </td>
                                )}
                                {visibleCols.cogs_currency && <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{item.cogs_currency || '-'}</td>}
                                {visibleCols.kmi_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-700">{item.kmi_qty || item.kmmi_qty || 0}</td>}
                                {visibleCols.kme_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-700">{item.kme_qty || 0}</td>}
                                {visibleCols.total_qty && <td className="border border-slate-200 px-3 py-2 text-center text-slate-800 bg-slate-100/50">{item.total_qty || 0}</td>}
                                {visibleCols.avg12m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-700 bg-blue-50/30">{Number(item.avg_12m_sales || 0).toFixed(1)}</td>}
                                {visibleCols.avg6m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-700 bg-blue-50/30">{Number(item.avg_6m_sales || 0).toFixed(1)}</td>}
                                {visibleCols.avg3m && <td className="border border-slate-200 px-3 py-2 text-center text-blue-800 bg-blue-100/20">{Number(item.avg_3m_sales || 0).toFixed(1)}</td>}         
                                <td className={`border border-slate-200 px-3 py-2 text-center border-l-slate-300 ${item.forecast_qty > 0 ? 'bg-blue-50 text-slate-900' : 'text-slate-300'}`}>{item.forecast_qty > 0 ? item.forecast_qty : '-'}</td>
                                {visibleCols.confirmed_qty && (
                                    <td className={`border border-slate-200 px-3 py-2 text-center ${item.confirmed_qty > 0 ? 'bg-emerald-50 text-emerald-900' : 'text-slate-300'}`}>{item.confirmed_qty > 0 ? item.confirmed_qty : '-'}</td>
                                )}
                                <td className={`border border-slate-200 px-3 py-2 text-right ${item.forecast_qty > 0 ? 'bg-blue-50 text-slate-900' : 'text-slate-300'}`}>{item.forecast_qty > 0 ? item.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                            </tr>
                        );
                    })}
                    {bpSummaryData.length === 0 && <tr><td colSpan={activeColCount} className="p-10 text-center text-slate-500 italic">{searchTerm ? 'No entries match your search.' : `No forecast entries found for ${monthFilter}.`}</td></tr>}
                </tbody>

                {bpSummaryData.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] bg-slate-100 font-bold text-slate-700">
                        <tr>
                            <td colSpan={subtotalColSpan + (visibleCols.salesRep ? 1 : 0) + (visibleCols.bpName ? 1 : 0) + (visibleCols.lobName ? 1 : 0) + 1} className="px-4 py-3 text-right uppercase tracking-wider">Total (All Pages)</td>
                            {visibleCols.ln_price && <td className="px-3 py-3 text-center border-l border-slate-200">-</td>}
                            {visibleCols.cogs_price && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.cogs_currency && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.kmi_qty && <td className="px-3 py-3 text-center text-slate-800">{gridTotals.kmi_qty}</td>}
                            {visibleCols.kme_qty && <td className="px-3 py-3 text-center text-slate-800">{gridTotals.kme_qty}</td>}
                            {visibleCols.total_qty && <td className="px-3 py-3 text-center text-slate-900">{gridTotals.total_qty}</td>}
                            {visibleCols.avg12m && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.avg6m && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.avg3m && <td className="px-3 py-3 text-center">-</td>}
                            
                            <td className={`border border-slate-300 px-3 py-2 text-center border-l-slate-300 ${gridTotals.forecast_qty > 0 ? 'bg-emerald-200/60 text-slate-900 shadow-inner' : 'text-slate-500'}`}>{gridTotals.forecast_qty > 0 ? gridTotals.forecast_qty : '-'}</td>
                            {visibleCols.confirmed_qty && (
                                <td className={`border border-slate-300 px-3 py-2 text-center ${gridTotals.confirmed_qty > 0 ? 'bg-emerald-200/60 text-slate-900 shadow-inner' : 'text-slate-500'}`}>{gridTotals.confirmed_qty > 0 ? gridTotals.confirmed_qty : '-'}</td>
                            )}
                            <td className={`border border-slate-300 px-3 py-2 text-right ${gridTotals.forecast_qty > 0 ? 'bg-emerald-200/60 text-slate-900 shadow-inner' : 'text-slate-500'}`}>{gridTotals.forecast_qty > 0 ? gridTotals.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        )}
        </div>
        
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={bpSummaryData.length} itemsPerPage={ITEMS_PER_PAGE} onPrev={goToPrevPage} onNext={goToNextPage} />
    </div>
  );
}