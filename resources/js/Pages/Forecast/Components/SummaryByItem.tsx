import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Info, Loader2 } from 'lucide-react';
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
    category: true, line: false, group: false, itemCode: true, description: false, brand: false, 
    ln_price: false, cogs_price: false, cogs_currency: false, kmi_qty: true, kme_qty: true, 
    total_qty: false, avg12m: false, avg6m: false, avg3m: false, confirmed_qty: true   
};

type SortColumn = 'itemCode' | 'category';
type SortDirection = 'asc' | 'desc';

export default function SummaryByItem({ isActive, dbLobs, dbProducts, dbPricing, dbEntries, searchTerm, user }: any) {
  const { USD_TO_AED_RATE } = useExchangeRates();
  const [masterMonthFilter, setMasterMonthFilter] = useState(getNextMonthString());
  const [isLoadingData, setIsLoadingData] = useState(false);
  const fetchedMonth = useRef<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortColumn, direction: SortDirection }>({ key: 'category', direction: 'asc' });
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { visibleCols, toggleColumn } = useColumnVisibility('kmePlannerMasterColumnPrefs', DEFAULT_COLS);

  const isAdmin = user.role_id === 2;

 useEffect(() => {
      if (!isActive) return;
      const showSpinner = fetchedMonth.current !== masterMonthFilter;
      
      if (showSpinner) {
          setIsLoadingData(true);
      }
      router.reload({
          only: ['dbProductsMonth', 'dbPricingMonth', 'dbEntriesMonth'],
          data: { summary_month: masterMonthFilter },
          onFinish: () => {
              if (showSpinner) {
                  setIsLoadingData(false);
                  fetchedMonth.current = masterMonthFilter; // mark this month as loaded
              }
          }
      });
  }, [isActive, masterMonthFilter]);

  const handleSort = (key: SortColumn) => {
      setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const activeReps = useMemo(() => {
      if (!Array.isArray(dbEntries)) return [];
      const reps = new Set<string>();
      dbEntries.forEach((e: any) => {
          if (e.planning_month === masterMonthFilter && Number(e.planned_quantity) > 0) {
              const lob = dbLobs?.find((l: any) => l.lob_id === e.lob_id);
              if (lob) reps.add(lob.sales_rep_name || lob.sales_representative_no || 'Unknown');
          }
      });
      return Array.from(reps).sort(); 
  }, [dbEntries, masterMonthFilter, dbLobs]);

  const forecastStatsMap = useMemo(() => {
    if (!Array.isArray(dbEntries)) return {};
    const map: Record<number, { totalQty: number, totalConfirmedQty: number, totalNetSales: number, reps: Record<string, { qty: number, confirmedQty: number, netSales: number }> }> = {};
    dbEntries.forEach((entry: any) => {
        if (entry.planning_month === masterMonthFilter && Number(entry.planned_quantity) > 0) {
            const pid = Number(entry.product_id);
            if (!map[pid]) map[pid] = { totalQty: 0, totalConfirmedQty: 0, totalNetSales: 0, reps: {} };
            const lob = dbLobs?.find((l: any) => l.lob_id === entry.lob_id);
            const repName = lob ? (lob.sales_rep_name || lob.sales_representative_no || 'Unknown') : 'Unknown';
            if (!map[pid].reps[repName]) map[pid].reps[repName] = { qty: 0, confirmedQty: 0, netSales: 0 };
            
            const qty = Number(entry.planned_quantity);
            const confirmedQty = Number(entry.confirmed_quantity || 0);
            const amount = Number(entry.total_amount);

            map[pid].reps[repName].qty += qty;
            map[pid].reps[repName].confirmedQty += confirmedQty;
            map[pid].reps[repName].netSales += amount;
            
            map[pid].totalQty += qty;
            map[pid].totalConfirmedQty += confirmedQty;
            map[pid].totalNetSales += amount; 
        }
    });
    return map;
  }, [dbEntries, masterMonthFilter, dbLobs]);

  const masterProducts = useMemo(() => {
      if (!Array.isArray(dbProducts) || !Array.isArray(dbPricing)) return [];
      let activeProducts = dbProducts.filter((p: any) => forecastStatsMap[p.product_id] !== undefined);
      activeProducts = activeProducts.map((prod: any) => {
          const stats = forecastStatsMap[prod.product_id];
          
          // weighted average LN price calculation
          let calculatedLnPrice = 0;
          if (stats.totalQty > 0) {
              calculatedLnPrice = stats.totalNetSales / stats.totalQty;
          } else {
              // Fallback to DB price only if there is 0 quantity in the forecast
              const fallbackPrice = dbPricing.find((p: any) => p.product_id === prod.product_id && p.lob_id === null) 
                                 || dbPricing.find((p: any) => p.product_id === prod.product_id);
              if (fallbackPrice) calculatedLnPrice = Number(fallbackPrice.price);
          }

          const cogsRaw = Number(prod.cogs_price) || 0;
          const isCogsUsd = (prod.cogs_currency || '').toUpperCase() === 'USD';
          
          return { 
              ...prod, forecast_qty: stats.totalQty, confirmed_qty: stats.totalConfirmedQty, net_sales: stats.totalNetSales, rep_data: stats.reps, 
              ln_price: calculatedLnPrice, cogs_aed_value: isCogsUsd ? (cogsRaw * USD_TO_AED_RATE) : cogsRaw, is_cogs_usd: isCogsUsd
          };
      });

      if (debouncedSearchTerm) {
          const lower = debouncedSearchTerm.toLowerCase();
          activeProducts = activeProducts.filter((item: any) => 
              (item.product_model || '').toLowerCase().includes(lower) || (item.item_code || '').toLowerCase().includes(lower) ||
              (item.item_description || '').toLowerCase().includes(lower) || (item.product_category || '').toLowerCase().includes(lower) ||
              (item.item_group || '').toLowerCase().includes(lower) || (item.product_line || '').toLowerCase().includes(lower) ||
              (item.brand || '').toLowerCase().includes(lower)
          );
      }

      activeProducts.sort((a: any, b: any) => {
          const dir = sortConfig.direction === 'asc' ? 1 : -1;
          if (sortConfig.key === 'category') {
              const catCompare = (a.product_category || '').localeCompare(b.product_category || '');
              return catCompare !== 0 ? catCompare * dir : (a.item_code || '').localeCompare(b.item_code || '');
          } else {
              const catCompare = (a.product_category || '').localeCompare(b.product_category || '');
              return catCompare !== 0 ? catCompare : (a.item_code || '').localeCompare(b.item_code || '') * dir;
          }
      });

      const dataWithSubtotals: any[] = [];
      let currentGroup: any[] = [];
      let actualItemNumber = 1;

      for (let i = 0; i < activeProducts.length; i++) {
          const row = activeProducts[i];
          row.display_index = actualItemNumber++;
          dataWithSubtotals.push(row);
          currentGroup.push(row);

          if (!activeProducts[i + 1] || activeProducts[i + 1].product_category !== row.product_category) {
              const sumCogsAed = currentGroup.reduce((sum, r) => sum + (r.cogs_aed_value || 0), 0);
              const repSubtotals: Record<string, { qty: number, confirmedQty: number, netSales: number }> = {};
              activeReps.forEach(rep => {
                  repSubtotals[rep] = { 
                      qty: currentGroup.reduce((sum, r) => sum + (r.rep_data[rep]?.qty || 0), 0), 
                      confirmedQty: currentGroup.reduce((sum, r) => sum + (r.rep_data[rep]?.confirmedQty || 0), 0), 
                      netSales: currentGroup.reduce((sum, r) => sum + (r.rep_data[rep]?.netSales || 0), 0) 
                  };
              });
              
              dataWithSubtotals.push({
                  isSubtotal: true, unique_key: `subtotal-cat-${row.product_category}`, product_category: row.product_category || 'Uncategorized', 
                  ln_price: currentGroup.reduce((sum, r) => sum + (r.ln_price || 0), 0), cogs_aed_value: sumCogsAed, cogs_usd_value: sumCogsAed / USD_TO_AED_RATE,
                  kmi_qty: currentGroup.reduce((sum, r) => sum + (Number(r.kmi_qty || r.kmmi_qty) || 0), 0), kme_qty: currentGroup.reduce((sum, r) => sum + (Number(r.kme_qty) || 0), 0),
                  total_qty: currentGroup.reduce((sum, r) => sum + (Number(r.total_qty) || 0), 0), avg_12m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_12m_sales) || 0), 0),
                  avg_6m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_6m_sales) || 0), 0), avg_3m_sales: currentGroup.reduce((sum, r) => sum + (Number(r.avg_3m_sales) || 0), 0),
                  forecast_qty: currentGroup.reduce((sum, r) => sum + (r.forecast_qty || 0), 0), confirmed_qty: currentGroup.reduce((sum, r) => sum + (r.confirmed_qty || 0), 0), net_sales: currentGroup.reduce((sum, r) => sum + (r.net_sales || 0), 0), rep_subtotals: repSubtotals
              });
              currentGroup = [];
          }
      }
      return dataWithSubtotals;
  }, [dbProducts, debouncedSearchTerm, forecastStatsMap, sortConfig, activeReps, dbPricing]);

  const { currentPage, totalPages, paginatedData, goToNextPage, goToPrevPage, setCurrentPage } = usePagination(masterProducts, ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [debouncedSearchTerm, sortConfig, setCurrentPage]);

  const gridTotals = useMemo(() => {
      const totals = { forecast_qty: 0, confirmed_qty: 0, net_sales: 0, kmi_qty: 0, kme_qty: 0, total_qty: 0, reps: {} as Record<string, {qty: number, confirmedQty: number, netSales: number}> };
      activeReps.forEach(r => totals.reps[r] = {qty: 0, confirmedQty: 0, netSales: 0});
      masterProducts.forEach((row: any) => {
          if (!row.isSubtotal) {
              totals.forecast_qty += row.forecast_qty; 
              totals.confirmed_qty += row.confirmed_qty;
              totals.net_sales += row.net_sales;
              totals.kmi_qty += Number(row.kmi_qty || row.kmmi_qty || 0); totals.kme_qty += Number(row.kme_qty || 0); totals.total_qty += Number(row.total_qty || 0);
              activeReps.forEach(rep => { 
                  totals.reps[rep].qty += (row.rep_data[rep]?.qty || 0); 
                  totals.reps[rep].confirmedQty += (row.rep_data[rep]?.confirmedQty || 0); 
                  totals.reps[rep].netSales += (row.rep_data[rep]?.netSales || 0); 
              });
          }
      });
      return totals;
  }, [masterProducts, activeReps]);

  const handleExportCSV = () => {
    // hide  total columns in export if not admin
    const adminHeaders = isAdmin ? (visibleCols.confirmed_qty ? ['Total Forecast Qty', 'Total Confirm Qty', 'Total Net Sales (AED)'] : ['Total Forecast Qty', 'Total Net Sales (AED)']) : [];
    
    const repHeaders = activeReps.flatMap(rep => {
        const cols = [`${rep} (Forecast Qty)`];
        if (visibleCols.confirmed_qty) cols.push(`${rep} (Confirm Qty)`);
        cols.push(`${rep} (Amount AED)`);
        return cols;
    });

    // 'Weighted Avg Price (AED)'
    const headers = ['No', 'Product Category', 'Product Line', 'Product Group', 'Product Model', 'Item Code', 'Item Description', 'Brand', 'Weighted Avg Price (AED)', 'COGS Price', 'COGS Currency', 'KMI On Hand', 'KME On Hand', 'Total On Hand', '12M Avg (Sales)', '6M Avg (Sales)', '3M Avg (Sales)', ...repHeaders, ...adminHeaders];
    
    const exportData = masterProducts.filter((prod: any) => !prod.isSubtotal);
    const rows = exportData.map((prod: any) => {
        const safeDesc = prod.item_description ? `"${prod.item_description.replace(/"/g, '""')}"` : '""';
        const repExportCols = activeReps.flatMap(rep => { 
            const repData = prod.rep_data[rep] || { qty: 0, confirmedQty: 0, netSales: 0 }; 
            return visibleCols.confirmed_qty ? [repData.qty, repData.confirmedQty, repData.netSales.toFixed(2)] : [repData.qty, repData.netSales.toFixed(2)]; 
        });
        
        const adminData = isAdmin ? (visibleCols.confirmed_qty ? [prod.forecast_qty || 0, prod.confirmed_qty || 0, (prod.net_sales || 0).toFixed(2)] : [prod.forecast_qty || 0, (prod.net_sales || 0).toFixed(2)]) : [];

        return [prod.display_index, `"${prod.product_category || '-'}"`, `"${prod.product_line || '-'}"`, `"${prod.item_group || '-'}"`, `"${prod.product_model || '-'}"`, `"${prod.item_code || '-'}"`, safeDesc, `"${prod.brand || '-'}"`, prod.ln_price > 0 ? prod.ln_price.toFixed(2) : '#N/A', prod.cogs_price ? Number(prod.cogs_price).toFixed(2) : '#N/A', prod.cogs_currency || '-', prod.kmi_qty || prod.kmmi_qty || 0, prod.kme_qty || 0, prod.total_qty || 0, Number(prod.avg_12m_sales || 0).toFixed(1), Number(prod.avg_6m_sales || 0).toFixed(1), Number(prod.avg_3m_sales || 0).toFixed(1), ...repExportCols, ...adminData].join(',');
    });
    downloadCSV(`Summary_by_Items_${masterMonthFilter}.csv`, headers, rows);
  };

  let activeColCount = 4 + Object.values(visibleCols).filter(Boolean).length + (activeReps.length * (visibleCols.confirmed_qty ? 3 : 2));
  if (isAdmin) activeColCount += (visibleCols.confirmed_qty ? 3 : 2); // Add span for admin columns

  let colSpanOffset = 1; 
  if (visibleCols.category) colSpanOffset++; if (visibleCols.line) colSpanOffset++; if (visibleCols.group) colSpanOffset++;
  if (visibleCols.itemCode) colSpanOffset++; if (visibleCols.description) colSpanOffset++; if (visibleCols.brand) colSpanOffset++;

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden flex flex-col h-full max-h-[800px] animate-in fade-in duration-300">
        <div className="p-5 border-b border-base-300 bg-base-200/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-base-content uppercase tracking-wider">Summary By Item Code</h3>
            <div className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-lg px-2 py-1 shadow-sm">
                <span className="text-xs font-bold text-base-content/60 uppercase">Forecast View:</span>
                <MonthPicker value={masterMonthFilter} onChange={setMasterMonthFilter} className="text-xs font-black text-success h-6 px-1 cursor-pointer" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="text-xs text-base-content/60 font-bold bg-base-300 px-3 py-1.5 rounded-full">{masterProducts.filter(p => !p.isSubtotal).length} Rows</div>
              
              <ColumnSettings>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.category} onChange={() => toggleColumn('category')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Product Category</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.line} onChange={() => toggleColumn('line')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Product Line</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.group} onChange={() => toggleColumn('group')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Product Group</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.itemCode} onChange={() => toggleColumn('itemCode')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Item Code</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.description} onChange={() => toggleColumn('description')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Item Description</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.brand} onChange={() => toggleColumn('brand')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Brand</label>
                  <div className="border-t border-base-200 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-success"><input type="checkbox" checked={visibleCols.ln_price} onChange={() => toggleColumn('ln_price')} className="rounded border-base-content/15 text-success focus:ring-success" />Weighted Avg Price (AED)</label>         
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-error"><input type="checkbox" checked={visibleCols.cogs_price} onChange={() => toggleColumn('cogs_price')} className="rounded border-base-content/15 text-error focus:ring-error" />COGS Price</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-error"><input type="checkbox" checked={visibleCols.cogs_currency} onChange={() => toggleColumn('cogs_currency')} className="rounded border-base-content/15 text-error focus:ring-error" />COGS Currency</label>
                  <div className="border-t border-base-200 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.kmi_qty} onChange={() => toggleColumn('kmi_qty')} className="rounded border-base-content/15 text-accent focus:ring-accent" />KMI On Hand</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.kme_qty} onChange={() => toggleColumn('kme_qty')} className="rounded border-base-content/15 text-accent focus:ring-accent" />KME On Hand</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.total_qty} onChange={() => toggleColumn('total_qty')} className="rounded border-base-content/15 text-accent focus:ring-accent" />Total On Hand</label>
                  <div className="border-t border-base-200 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.avg12m} onChange={() => toggleColumn('avg12m')} className="rounded border-base-content/15 text-accent focus:ring-accent" />12M Avg (Sales)</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.avg6m} onChange={() => toggleColumn('avg6m')} className="rounded border-base-content/15 text-accent focus:ring-accent" />6M Avg (Sales)</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-accent"><input type="checkbox" checked={visibleCols.avg3m} onChange={() => toggleColumn('avg3m')} className="rounded border-base-content/15 text-accent focus:ring-accent" />3M Avg (Sales)</label>
                  <div className="border-t border-base-200 my-1 pt-1"></div>
                  <label className="flex items-center gap-2 text-xs font-medium text-base-content/80 cursor-pointer hover:text-success"><input type="checkbox" checked={visibleCols.confirmed_qty} onChange={() => toggleColumn('confirmed_qty')} className="rounded border-base-content/15 text-success focus:ring-success" />Confirmed Qty</label>
              </ColumnSettings>

              <button onClick={handleExportCSV} disabled={masterProducts.length === 0} className="flex items-center gap-2 text-xs font-bold bg-base-100 border border-base-content/15 text-base-content/80 px-3 py-1.5 rounded-lg hover:bg-base-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  <Download size={14} /> Export CSV
              </button>
          </div>
        </div>
        <div className="overflow-auto flex-1 relative" aria-busy={isLoadingData}>
            {isLoadingData ? (
                <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center text-base-content/60 bg-base-200/50 gap-3 z-50">
                    <Loader2 size={30} className="animate-spin text-primary" />
                    <span className="text-sm font-medium">Aggregating Data for {masterMonthFilter}...</span>
                </div>
            ) : (
            <table className="w-full text-[12px] text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-center">No</th>
                        {visibleCols.category && (
                            <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold hover:brightness-95 transition-colors cursor-pointer group" onClick={() => handleSort('category')}>
                                <div className="flex items-center justify-between gap-2">Product Category {sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-accent"/> : <ArrowDown size={14} className="text-accent"/>) : <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100" />}</div>
                            </th>
                        )}
                        {visibleCols.line && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">Product Line</th>}
                        {visibleCols.group && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">Product Group</th>}
                        <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">Product Model</th>
                        {visibleCols.itemCode && (
                            <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold hover:brightness-95 transition-colors cursor-pointer group" onClick={() => handleSort('itemCode')}>
                                <div className="flex items-center justify-between gap-2">Item Code {sortConfig.key === 'itemCode' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-accent"/> : <ArrowDown size={14} className="text-accent"/>) : <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100" />}</div>
                            </th>
                        )}
                        {visibleCols.description && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">Item Description</th>}
                        {visibleCols.brand && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">Brand</th>}

                        {visibleCols.ln_price && (
                            <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold">
                                <div 
                                    className="flex items-center justify-end gap-1.5 cursor-help" 
                                    title="Formula: (Total Net Sales / Total Forecast Qty)"
                                >
                                    Weighted Avg Price (AED)
                                    <Info size={14} className="text-base-content/60 hover:text-base-content/80 transition-colors" />
                                </div>
                            </th>
                        )}
                        
                        {visibleCols.cogs_price && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-right">COGS Price</th>}
                        {visibleCols.cogs_currency && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-center">COGS Currency</th>}
                        {visibleCols.kmi_qty && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-center">KMI On Hand</th>}
                        {visibleCols.kme_qty && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-center">KME On Hand</th>}
                        {visibleCols.total_qty && <th className="border border-base-content/15 bg-primary-tint px-3 py-2 text-base-content font-bold text-center">Total On Hand</th>}
                        {visibleCols.avg12m && <th className="border border-base-content/15 bg-accent-tint px-3 py-2 text-accent font-bold text-center">12M Avg (Sales)</th>}
                        {visibleCols.avg6m && <th className="border border-base-content/15 bg-accent-tint px-3 py-2 text-accent font-bold text-center">6M Avg (Sales)</th>}
                        {visibleCols.avg3m && <th className="border border-base-content/15 bg-accent-tint px-3 py-2 text-accent font-bold text-center">3M Avg (Sales)</th>}
                        {activeReps.map(rep => (
                            <React.Fragment key={rep}>
                                <th className="border border-base-content/15 bg-accent-tint px-3 py-2 text-accent font-bold text-center shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.05)] border-l-base-content/25"><div>{rep}</div><div className="font-normal opacity-80">Forecast Qty</div></th>
                                {visibleCols.confirmed_qty && (
                                    <th className="border border-base-content/15 bg-success-tint px-3 py-2 text-success font-bold text-center shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.05)]"><div>{rep}</div><div className="font-normal opacity-80">Confirm Qty</div></th>
                                )}
                                <th className="border border-base-content/15 bg-accent-tint px-3 py-2 text-accent font-bold text-center shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.05)]"><div>{rep}</div><div className="font-normal opacity-80">Amount (AED)</div></th>
                            </React.Fragment>
                        ))}
                        
                        {/* HIDE  IF NOT ADMIN */}
                        {isAdmin && (
                            <>
                                <th className="border border-base-content/15 bg-success px-3 py-2 text-white font-bold text-center shadow-lg border-l-base-content/25"><div>Total Forecast</div><div className="font-normal opacity-80">Qty</div></th>
                                {visibleCols.confirmed_qty && (
                                    <th className="border border-base-content/15 bg-success px-3 py-2 text-white font-bold text-center shadow-lg"><div>Total Confirm</div><div className="font-normal opacity-80">Qty</div></th>
                                )}
                                <th className="border border-base-content/15 bg-success px-3 py-2 text-white font-bold text-center shadow-lg"><div>Total Forecast</div><div className="font-normal opacity-80">Net Sales (AED)</div></th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                    {paginatedData.map((prod: any) => {
                        if (prod.isSubtotal) {
                            return (
                                <tr key={prod.unique_key} className="bg-base-300/50 transition-colors border-y border-base-content/15">
                                    <td className="border border-base-300 px-3 py-2"></td>
                                    <td colSpan={colSpanOffset} className="border border-base-300 px-3 py-2 text-right text-base-content/80 font-bold uppercase tracking-wider">Total {prod.product_category}</td>
                                    {visibleCols.ln_price && <td className="border border-base-300 px-3 py-2 text-right text-success">{prod.ln_price.toFixed(2)}</td>}
                                    {visibleCols.cogs_price && (<td className="border border-base-300 px-3 py-2 text-right text-error"><div className="flex flex-col items-end"><span>{prod.cogs_usd_value.toFixed(2)}</span><span className="text-base-content/60">(AED {prod.cogs_aed_value.toFixed(2)})</span></div></td>)}
                                    {visibleCols.cogs_currency && <td className="border border-base-300 px-3 py-2 text-center text-base-content/60">USD</td>}
                                    {visibleCols.kmi_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content">{prod.kmi_qty}</td>}
                                    {visibleCols.kme_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content">{prod.kme_qty}</td>}
                                    {visibleCols.total_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content bg-base-300/50">{prod.total_qty}</td>}
                                    {visibleCols.avg12m && <td className="border border-base-300 px-3 py-2 text-center text-accent">{prod.avg_12m_sales.toFixed(1)}</td>}
                                    {visibleCols.avg6m && <td className="border border-base-300 px-3 py-2 text-center text-accent">{prod.avg_6m_sales.toFixed(1)}</td>}
                                    {visibleCols.avg3m && <td className="border border-base-300 px-3 py-2 text-center text-accent">{prod.avg_3m_sales.toFixed(1)}</td>}
                                    {activeReps.map(rep => {
                                        const repData = prod.rep_subtotals[rep] || { qty: 0, confirmedQty: 0, netSales: 0 };
                                        return (
                                            <React.Fragment key={rep}>
                                                <td className={`border border-base-content/15 px-3 py-2 text-center border-l-base-content/15 ${repData.qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/30'}`}>{repData.qty > 0 ? repData.qty : '-'}</td>
                                                {visibleCols.confirmed_qty && (
                                                    <td className={`border border-base-content/15 px-3 py-2 text-center ${repData.confirmedQty > 0 ? 'bg-success/10 text-success' : 'text-base-content/30'}`}>{repData.confirmedQty > 0 ? repData.confirmedQty : '-'}</td>
                                                )}
                                                <td className={`border border-base-content/15 px-3 py-2 text-right ${repData.qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/30'}`}>{repData.qty > 0 ? repData.netSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                    
                                    {/* HIDE IF NOT ADMIN */}
                                    {isAdmin && (
                                        <>
                                            <td className="border border-base-content/15 bg-success/15 px-3 py-2 text-center text-base-content shadow-inner border-l-base-content/25">{prod.forecast_qty > 0 ? prod.forecast_qty : '-'}</td>
                                            {visibleCols.confirmed_qty && (
                                                <td className="border border-base-content/15 bg-success/15 px-3 py-2 text-center text-base-content shadow-inner">{prod.confirmed_qty > 0 ? prod.confirmed_qty : '-'}</td>
                                            )}
                                            <td className="border border-base-content/15 bg-success/15 px-3 py-2 text-right text-base-content shadow-inner">{prod.forecast_qty > 0 ? prod.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                        </>
                                    )}
                                </tr>
                            );
                        }
                        const isCogsUsd = (prod.cogs_currency || '').toUpperCase() === 'USD';
                        const cogsPriceAed = isCogsUsd && prod.cogs_price ? (Number(prod.cogs_price) * USD_TO_AED_RATE).toFixed(2) : null;

                        return (
                            <tr key={prod.unique_key || prod.product_id} className="hover:bg-base-200 transition-colors">
                                <td className="border border-base-300 px-3 py-2 text-center text-base-content/60">{prod.display_index}</td>
                                {visibleCols.category && <td className="border border-base-300 px-3 py-2 text-base-content/80">{prod.product_category}</td>}
                                {visibleCols.line && <td className="border border-base-300 px-3 py-2 text-base-content/80">{prod.product_line}</td>}
                                {visibleCols.group && <td className="border border-base-300 px-3 py-2 text-base-content/80">{prod.item_group}</td>}
                                <td className="border border-base-300 px-3 py-2 text-base-content font-bold">{prod.product_model}</td>
                                {visibleCols.itemCode && <td className="border border-base-300 px-3 py-2 text-base-content/60 font-mono">{prod.item_code}</td>}
                                {visibleCols.description && <td className="border border-base-300 px-3 py-2 text-base-content/70 truncate max-w-xs">{prod.item_description}</td>}
                                {visibleCols.brand && <td className="border border-base-300 px-3 py-2 text-base-content/80">{prod.brand}</td>}
                                {visibleCols.ln_price && <td className={`border border-base-300 px-3 py-2 text-right tracking-wider ${prod.ln_price > 0 ? 'text-success' : 'text-base-content/30 italic'}`}>{prod.ln_price > 0 ? prod.ln_price.toFixed(2) : '#N/A'}</td>}
                                {visibleCols.cogs_price && (
                                    <td className={`border border-base-300 px-3 py-2 text-right tracking-wider ${prod.cogs_price ? 'text-error' : 'text-base-content/30 italic'}`}>
                                        {prod.cogs_price ? (<div className="flex flex-col items-end"><span>{Number(prod.cogs_price).toFixed(2)}</span>{prod.is_cogs_usd && <span className="text-base-content/60">(AED {cogsPriceAed})</span>}</div>) : '#N/A'}
                                    </td>
                                )}
                                {visibleCols.cogs_currency && <td className="border border-base-300 px-3 py-2 text-center text-base-content/70">{prod.cogs_currency || '-'}</td>}
                                {visibleCols.kmi_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content/80">{prod.kmi_qty || prod.kmmi_qty || 0}</td>}
                                {visibleCols.kme_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content/80">{prod.kme_qty || 0}</td>}
                                {visibleCols.total_qty && <td className="border border-base-300 px-3 py-2 text-center text-base-content bg-base-300/30">{prod.total_qty || 0}</td>}
                                {visibleCols.avg12m && <td className="border border-base-300 px-3 py-2 text-center text-accent bg-accent/5">{Number(prod.avg_12m_sales || 0).toFixed(1)}</td>}
                                {visibleCols.avg6m && <td className="border border-base-300 px-3 py-2 text-center text-accent bg-accent/5">{Number(prod.avg_6m_sales || 0).toFixed(1)}</td>}
                                {visibleCols.avg3m && <td className="border border-base-300 px-3 py-2 text-center text-accent bg-accent/5">{Number(prod.avg_3m_sales || 0).toFixed(1)}</td>}
                                {activeReps.map(rep => {
                                    const repData = prod.rep_data[rep] || { qty: 0, confirmedQty: 0, netSales: 0 };
                                    return (
                                        <React.Fragment key={rep}>
                                            <td className={`border border-base-300 px-3 py-2 text-center border-l-base-content/15 ${repData.qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/30'}`}>{repData.qty > 0 ? repData.qty : '-'}</td>
                                            {visibleCols.confirmed_qty && (
                                                <td className={`border border-base-300 px-3 py-2 text-center ${repData.confirmedQty > 0 ? 'bg-success/10 text-success' : 'text-base-content/30'}`}>{repData.confirmedQty > 0 ? repData.confirmedQty : '-'}</td>
                                            )}
                                            <td className={`border border-base-300 px-3 py-2 text-right ${repData.qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/30'}`}>{repData.qty > 0 ? repData.netSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                        </React.Fragment>
                                    );
                                })}
                                
                                {/* HIDE IF NOT ADMIN */}
                                {isAdmin && (
                                    <>
                                        <td className={`border border-base-content/15 px-3 py-2 text-center border-l-base-content/25 ${prod.forecast_qty > 0 ? 'bg-success/10 text-base-content' : 'text-base-content/30'}`}>{prod.forecast_qty > 0 ? prod.forecast_qty : '-'}</td>
                                        {visibleCols.confirmed_qty && (
                                            <td className={`border border-base-content/15 px-3 py-2 text-center ${prod.confirmed_qty > 0 ? 'bg-success/10 text-base-content' : 'text-base-content/30'}`}>{prod.confirmed_qty > 0 ? prod.confirmed_qty : '-'}</td>
                                        )}
                                        <td className={`border border-base-content/15 px-3 py-2 text-right ${prod.forecast_qty > 0 ? 'bg-success/10 text-base-content' : 'text-base-content/30'}`}>{prod.forecast_qty > 0 ? prod.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                    </>
                                )}
                            </tr>
                        );
                    })}
                    {masterProducts.length === 0 && <tr><td colSpan={activeColCount} className="p-10 text-center text-base-content/60 italic">{searchTerm ? 'No products match your search.' : `No forecast entries found for ${masterMonthFilter}. Add data in the Sales Forecast tab.`}</td></tr>}
                </tbody>
                
                {masterProducts.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] bg-base-150 font-bold text-base-content/80">
                        <tr>
                            <td colSpan={colSpanOffset + 1} className="px-4 py-3 text-right uppercase tracking-wider">Total (All Pages)</td>
                            {visibleCols.ln_price && <td className="px-3 py-3 text-center border-l border-base-300">-</td>}
                            {visibleCols.cogs_price && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.cogs_currency && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.kmi_qty && <td className="px-3 py-3 text-center text-base-content">{gridTotals.kmi_qty}</td>}
                            {visibleCols.kme_qty && <td className="px-3 py-3 text-center text-base-content">{gridTotals.kme_qty}</td>}
                            {visibleCols.total_qty && <td className="px-3 py-3 text-center text-base-content">{gridTotals.total_qty}</td>}
                            {visibleCols.avg12m && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.avg6m && <td className="px-3 py-3 text-center">-</td>}
                            {visibleCols.avg3m && <td className="px-3 py-3 text-center">-</td>}
                            {activeReps.map(rep => (
                                <React.Fragment key={rep}>
                                    <td className={`border border-base-content/15 px-3 py-2 text-center border-l-base-content/15 ${gridTotals.reps[rep].qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/60'}`}>{gridTotals.reps[rep].qty > 0 ? gridTotals.reps[rep].qty : '-'}</td>
                                    {visibleCols.confirmed_qty && (
                                        <td className={`border border-base-content/15 px-3 py-2 text-center ${gridTotals.reps[rep].confirmedQty > 0 ? 'bg-success/10 text-success' : 'text-base-content/60'}`}>{gridTotals.reps[rep].confirmedQty > 0 ? gridTotals.reps[rep].confirmedQty : '-'}</td>
                                    )}
                                    <td className={`border border-base-content/15 px-3 py-2 text-right ${gridTotals.reps[rep].qty > 0 ? 'bg-accent/5 text-base-content' : 'text-base-content/60'}`}>{gridTotals.reps[rep].qty > 0 ? gridTotals.reps[rep].netSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                </React.Fragment>
                            ))}
                            
                            {/* HIDE IF NOT ADMIN */}
                            {isAdmin && (
                                <>
                                    <td className={`border border-base-content/15 px-3 py-2 text-center border-l-base-content/25 ${gridTotals.forecast_qty > 0 ? 'bg-success/15 text-base-content shadow-inner' : 'text-base-content/60'}`}>{gridTotals.forecast_qty > 0 ? gridTotals.forecast_qty : '-'}</td>
                                    {visibleCols.confirmed_qty && (
                                        <td className={`border border-base-content/15 px-3 py-2 text-center ${gridTotals.confirmed_qty > 0 ? 'bg-success/15 text-base-content shadow-inner' : 'text-base-content/60'}`}>{gridTotals.confirmed_qty > 0 ? gridTotals.confirmed_qty : '-'}</td>
                                    )}
                                    <td className={`border border-base-content/15 px-3 py-2 text-right ${gridTotals.forecast_qty > 0 ? 'bg-success/15 text-base-content shadow-inner' : 'text-base-content/60'}`}>{gridTotals.forecast_qty > 0 ? gridTotals.net_sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                </>
                            )}
                        </tr>
                    </tfoot>
                )}
            </table>
        )}
        </div>
        
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={masterProducts.filter(p => !p.isSubtotal).length} itemsPerPage={ITEMS_PER_PAGE} onPrev={goToPrevPage} onNext={goToNextPage} />
    </div>
  );
}