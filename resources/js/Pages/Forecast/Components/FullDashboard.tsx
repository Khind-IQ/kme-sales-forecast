import React, { useState, useMemo, useEffect,useRef } from 'react';
import { router } from '@inertiajs/react';
import { Loader2, Info } from 'lucide-react';
import MonthRangePicker from './Shared/MonthRangePicker';
import SearchableSelect from './Shared/SearchableSelect';
import { useExchangeRates } from '../Hooks/useExchangeRates';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ChartDataLabels);
ChartJS.defaults.font.family = "'Figtree', ui-sans-serif, system-ui, -apple-system, sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#64748b';

// Muted, cohesive categorical palette (rep doughnut + its legend)
const CHART_COLORS = ['#1e6091', '#468faf', '#52796f', '#e09f3e', '#bc4749', '#6a4c93', '#1a759f', '#b5838d', '#76c893', '#c9ada7'];

// Series colors for the revenue / GP combo chart
const SERIES = {
    actual: '#1e6091',
    forecast: '#468faf',
    confirmed: '#76c893',
    forecastGp: '#e09f3e',
    actualGp: '#bc4749',
};

// Shared dark, rounded BI-style tooltip
const TOOLTIP: any = {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    titleColor: '#f8fafc',
    bodyColor: '#e2e8f0',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    usePointStyle: true,
    boxPadding: 6,
    titleFont: { size: 12, weight: '600' },
    bodyFont: { size: 11 },
};
const GRID_COLOR = '#eef2f6';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FullDashboard({ isActive, dbLobs, dbProducts, dbPricing = [], dbEntries, dbActualSales = [], dbEntriesYtd = [], dbActualSalesYtd = [], user }: any) {
  const { EXCHANGE_RATES, USD_TO_AED_RATE } = useExchangeRates();
  const [dashCurrency, setDashCurrency] = useState<'AED' | 'MYR' | 'USD'>('AED');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const fetchedRange = useRef<string | null>(null);
  
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const defaultMonth = `${currentYear}-${currentMonth}`;

  const [dashFilters, setDashFilters] = useState({
      startMonth: defaultMonth, 
      endMonth: defaultMonth,
      // Dashboard data is already access-scoped server-side (by the rep's LOB codes),
      // so default to "All" reps within that scope for everyone.
      lob: 'All', salesPerson: 'All', businessPartner: 'All',
      brand: 'All', productLine: 'All', productCategory: 'All', productGroup: 'All', productModel: 'All', itemCode: 'All'
  });

  useEffect(() => {
      if (!isActive) return;

      const currentRange = `${dashFilters.startMonth}_${dashFilters.endMonth}`;
      //only show spinner if date range changed
      const showSpinner = fetchedRange.current !== currentRange;

      if (showSpinner) {
          setIsLoadingData(true);
      }
      router.reload({
          only: ['dbDashLobs', 'dbDashProducts', 'dbDashEntries', 'dbDashActualSales'],
          data: { 
              start_month: dashFilters.startMonth, 
              end_month: dashFilters.endMonth,
              summary_month: '', 
              lob_id: ''        
          },
          onFinish: () => {
              if (showSpinner) {
                  setIsLoadingData(false);
                  fetchedRange.current = currentRange;
              }
          }
      });
  }, [dashFilters.startMonth, dashFilters.endMonth, isActive]);

  // Year-to-date data for the monthly chart — fetched once, independent of the month filter.
  const fetchedYtd = useRef(false);
  useEffect(() => {
      if (!isActive || fetchedYtd.current) return;
      router.reload({
          only: ['dbDashEntriesYtd', 'dbDashActualSalesYtd'],
          onFinish: () => { fetchedYtd.current = true; },
      });
  }, [isActive]);

  const lobsById = useMemo(() => {
      const map = new Map();
      (dbLobs || []).forEach((l: any) => map.set(Number(l.lob_id), l)); 
      return map;
  }, [dbLobs]);

  const productsById = useMemo(() => {
      const map = new Map();
      (dbProducts || []).forEach((p: any) => map.set(Number(p.product_id), p));
      return map;
  }, [dbProducts]);

  const repNameMap = useMemo(() => {
      const map = new Map<string, string>();
      (dbLobs || []).forEach((l: any) => {
          if (l.sales_representative_no && l.sales_rep_name) {
              map.set(String(l.sales_representative_no), l.sales_rep_name);
          }
      });
      return map;
  }, [dbLobs]);

  const dashboardFilterOptions = useMemo(() => {
    const lobsMap = new Map<string, string>(); 
    const bps = new Set<string>(); const brands = new Set<string>();
    const pLines = new Set<string>(); const pCats = new Set<string>();
    const pGroups = new Set<string>(); const pModels = new Set<string>();
    const itemCodes = new Set<string>(); const salesRepsMap = new Map<string, string>(); 

    const activeLobIds = new Set();
    const activeProductIds = new Set();

    const isCoreFilterMatch = (dateStr: string, repNo: string) => {
        if (!dateStr) return false;
        const monthStr = dateStr.substring(0, 7); 
        if (dashFilters.startMonth && monthStr < dashFilters.startMonth) return false;
        if (dashFilters.endMonth && monthStr > dashFilters.endMonth) return false;
        if (dashFilters.salesPerson !== 'All' && repNo !== dashFilters.salesPerson) return false;
        return true;
    };

    for (let i = 0; i < (dbEntries || []).length; i++) {
        const entry = dbEntries[i];
        const lob = lobsById.get(Number(entry.lob_id));
        const repNo = String(lob?.sales_representative_no || 'Unknown').trim();
        
        if (isCoreFilterMatch(entry.planning_month, repNo)) {
            activeLobIds.add(Number(entry.lob_id));
            activeProductIds.add(Number(entry.product_id));
        }
    }

    for (let i = 0; i < (dbActualSales || []).length; i++) {
        const actual = dbActualSales[i];
        const lob = lobsById.get(Number(actual.lob_id));
        const repNo = String(actual.sales_representative_no || lob?.sales_representative_no || 'Unknown').trim();

        if (isCoreFilterMatch(actual.invoice_date, repNo)) {
            activeLobIds.add(Number(actual.lob_id));
            activeProductIds.add(Number(actual.product_id));
        }
    }

    // include the selected rep's current LOBs
    // so their BP/LOB still show in the filters even with no sales
    if (dashFilters.salesPerson !== 'All') {
        (dbLobs || []).forEach((lob: any) => {
            if (String(lob?.sales_representative_no || '').trim() === dashFilters.salesPerson) {
                activeLobIds.add(Number(lob.lob_id));
            }
        });
    }

    (dbLobs || []).forEach((lob: any) => {
        if (lob.sales_representative_no) {
            salesRepsMap.set(String(lob.sales_representative_no).trim(), String(lob.sales_rep_name || lob.sales_representative_no).trim());
        }
        if (activeLobIds.has(Number(lob.lob_id))) {
            if (lob.lob_code) lobsMap.set(String(lob.lob_code).trim(), String(lob.lob_name || '').trim()); 
            if (lob.sold_to_bp_name) bps.add(String(lob.sold_to_bp_name).trim());
        }
    });

    (dbProducts || []).forEach((prod: any) => {
        if (activeProductIds.has(Number(prod.product_id))) {
            if (prod.brand) brands.add(String(prod.brand).trim()); 
            if (prod.product_line) pLines.add(String(prod.product_line).trim());
            if (prod.product_category) pCats.add(String(prod.product_category).trim()); 
            if (prod.item_group) pGroups.add(String(prod.item_group).trim());
            if (prod.product_model) pModels.add(String(prod.product_model).trim()); 
            if (prod.item_code) itemCodes.add(String(prod.item_code).trim());
        }
    });

    return {
        lobs: Array.from(lobsMap.entries()).map(([code, name]) => ({ code, name })).sort((a,b) => a.code.localeCompare(b.code)),
        bps: Array.from(bps).sort(), brands: Array.from(brands).sort(), pLines: Array.from(pLines).sort(),
        pCats: Array.from(pCats).sort(), pGroups: Array.from(pGroups).sort(), pModels: Array.from(pModels).sort(),
        itemCodes: Array.from(itemCodes).sort(),
        salesReps: Array.from(salesRepsMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [dbEntries, dbActualSales, lobsById, dbLobs, dbProducts, dashFilters.startMonth, dashFilters.endMonth, dashFilters.salesPerson]);

  const fullDashboardData = useMemo(() => {
    let forecastTotal = 0; let confirmedTotal = 0; let actualTotal = 0; let totalOnHand = 0;
    const tableGroups: Record<string, any> = {}; 
    const uniqueProductIdsInView = new Set();
    const lobChartGroups: Record<string, { lobName: string, forecast: number, confirmed: number, actual: number, forecastGp: number, actualGp: number }> = {};
    const repActuals: Record<string, number> = {};
    const productLineChartGroups: Record<string, { lineName: string, forecast: number }> = {};
    const productModelGroups: Record<string, any> = {};

    // check if date falls in range
    const passesFilters = (dateStr: string, lobId: number, productId: number, repNo: string) => {
        if (!dateStr) return false;
        const monthStr = dateStr.substring(0, 7);
        if (dashFilters.startMonth && monthStr < dashFilters.startMonth) return false;
        if (dashFilters.endMonth && monthStr > dashFilters.endMonth) return false;
        
        if (dashFilters.salesPerson !== 'All' && repNo !== dashFilters.salesPerson) return false;
        const lob = lobsById.get(lobId);
        if (dashFilters.lob !== 'All' && lob?.lob_code !== dashFilters.lob) return false;
        if (dashFilters.businessPartner !== 'All' && lob?.sold_to_bp_name !== dashFilters.businessPartner) return false;
        const product = productsById.get(productId);
        if (dashFilters.brand !== 'All' && product?.brand !== dashFilters.brand) return false;
        if (dashFilters.productLine !== 'All' && product?.product_line !== dashFilters.productLine) return false;
        if (dashFilters.productCategory !== 'All' && product?.product_category !== dashFilters.productCategory) return false;
        if (dashFilters.productGroup !== 'All' && product?.item_group !== dashFilters.productGroup) return false;
        if (dashFilters.productModel !== 'All' && product?.product_model !== dashFilters.productModel) return false;
        if (dashFilters.itemCode !== 'All' && product?.item_code !== dashFilters.itemCode) return false;
        return true; 
    };

    const initializeProductModelGroup = (pModel: string, product: any) => {
        if (!productModelGroups[pModel]) {
            productModelGroups[pModel] = {
                productModel: pModel, forecastQty: 0, forecastAmount: 0,
                onHandKME: Number(product?.kme_qty || 0), onHandKMI: Number(product?.kmi_qty || 0),
                totalOnHand: Number(product?.total_qty || 0), avg12m: Number(product?.avg_12m_sales || product?.avg_12m_qty || 0),
                avg6m: Number(product?.avg_6m_sales || product?.avg_6m_qty || 0), avg3m: Number(product?.avg_3m_sales || product?.avg_3m_qty || 0),
            };
        }
    };

    // Show LOBs the selected rep currently owns even with no forecast/actual activity,
    // so their assigned business partners appear as a 0/0/0 row (display-only, no DB write).
    // Only when a specific rep is filtered (Option 1) and no product-level filter is active
    // (a product filter can't be evaluated against a LOB that has no records).
    const noProductFilter =
        dashFilters.brand === 'All' && dashFilters.productLine === 'All' &&
        dashFilters.productCategory === 'All' && dashFilters.productGroup === 'All' &&
        dashFilters.productModel === 'All' && dashFilters.itemCode === 'All';

    if (dashFilters.salesPerson !== 'All' && noProductFilter) {
        (dbLobs || []).forEach((lob: any) => {
            const ownerNo = String(lob?.sales_representative_no || '').trim();
            if (!ownerNo || ownerNo !== dashFilters.salesPerson) return;
            if (dashFilters.lob !== 'All' && lob?.lob_code !== dashFilters.lob) return;
            if (dashFilters.businessPartner !== 'All' && lob?.sold_to_bp_name !== dashFilters.businessPartner) return;
            const salesRepName = repNameMap.get(ownerNo) || ownerNo;
            const rowKey = `lob-${lob.lob_id}-rep-${salesRepName}`;
            if (!tableGroups[rowKey]) {
                tableGroups[rowKey] = {
                    rowKey,
                    bpName: lob?.sold_to_bp_name || lob?.sold_to_bp || 'Unknown',
                    lobName: lob?.lob_name || lob?.lob_code || 'Unassigned',
                    salesRep: salesRepName,
                    forecast: 0, confirmed: 0, actual: 0,
                };
            }
        });
    }

    for (let i = 0; i < (dbEntries || []).length; i++) {
        const entry = dbEntries[i];
        const lob = lobsById.get(Number(entry.lob_id));
        const repNo = lob?.sales_representative_no || 'Unknown'; 
        
        if (!passesFilters(entry.planning_month, entry.lob_id, entry.product_id, repNo)) continue;

        uniqueProductIdsInView.add(entry.product_id);
        const bpName = lob?.sold_to_bp_name || lob?.sold_to_bp || 'Unknown';
        const lobName = lob?.lob_name || lob?.lob_code || 'Unassigned';
        const salesRepName = repNameMap.get(String(repNo)) || repNo; 
        
        const product = productsById.get(Number(entry.product_id));
        const pLine = product?.product_line || 'Unknown Line';
        const pModel = product?.product_model || product?.item_code || 'Unknown Model';
        
        const convertedAmount = Number(entry.total_amount) * EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];
        forecastTotal += convertedAmount;

        const plannedQty = Number(entry.planned_quantity || entry.quantities || entry.qty || 1);
        const priceAed = Number(entry.planned_price_aed) || (Number(entry.total_amount) / plannedQty);
        const confirmedAmountAed = Number(entry.confirmed_quantity || 0) * priceAed;
        const convertedConfirmedAmount = confirmedAmountAed * EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];
        confirmedTotal += convertedConfirmedAmount;

        const rowKey = `lob-${entry.lob_id}-rep-${salesRepName}`;
        if (!tableGroups[rowKey]) {
            tableGroups[rowKey] = { rowKey, bpName, lobName, salesRep: salesRepName, forecast: 0, confirmed: 0, actual: 0 };
        }
        tableGroups[rowKey].forecast += convertedAmount;
        tableGroups[rowKey].confirmed += convertedConfirmedAmount; 

        // Forecast gross profit = (plan price - COGS in AED) x planned qty, in display currency
        const cogsRawF = Number(product?.cogs_price) || 0;
        const cogsAedF = String(product?.cogs_currency || '').toUpperCase() === 'USD' ? cogsRawF * USD_TO_AED_RATE : cogsRawF;
        const forecastGp = (priceAed - cogsAedF) * plannedQty * EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];

        if (!lobChartGroups[lobName]) lobChartGroups[lobName] = { lobName, forecast: 0, confirmed: 0, actual: 0, forecastGp: 0, actualGp: 0 };
        lobChartGroups[lobName].forecast += convertedAmount;
        lobChartGroups[lobName].confirmed += convertedConfirmedAmount;
        lobChartGroups[lobName].forecastGp += forecastGp;

        if (!productLineChartGroups[pLine]) productLineChartGroups[pLine] = { lineName: pLine, forecast: 0 };
        productLineChartGroups[pLine].forecast += convertedAmount;

        initializeProductModelGroup(pModel, product);
        productModelGroups[pModel].forecastQty += Number(entry.quantities || entry.planned_quantity || entry.qty || 0);
        productModelGroups[pModel].forecastAmount += convertedAmount;
    }

    for (let i = 0; i < (dbActualSales || []).length; i++) {
        const actual = dbActualSales[i];
        const lob = lobsById.get(Number(actual.lob_id));
        const repNo = actual.sales_representative_no || lob?.sales_representative_no || 'Unknown';

        if (!passesFilters(actual.invoice_date, actual.lob_id, actual.product_id, repNo)) continue;

        uniqueProductIdsInView.add(actual.product_id);
        const bpName = lob?.sold_to_bp_name || lob?.sold_to_bp || 'Unknown';
        const lobName = lob?.lob_name || lob?.lob_code || 'Unassigned';
        const salesRepName = repNameMap.get(String(repNo)) || repNo;
        
        const product = productsById.get(Number(actual.product_id));
        const pLine = product?.product_line || 'Unknown Line';
        const pModel = product?.product_model || product?.item_code || 'Unknown Model';
        const convertedAmount = Number(actual.sales) * EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];
        actualTotal += convertedAmount;

        // Actual gross profit = actual sales - (COGS in AED x actual qty), in display currency
        const cogsRawA = Number(product?.cogs_price) || 0;
        const cogsAedA = String(product?.cogs_currency || '').toUpperCase() === 'USD' ? cogsRawA * USD_TO_AED_RATE : cogsRawA;
        const actualGp = (Number(actual.sales) - cogsAedA * Number(actual.quantities || 0)) * EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];

        const rowKey = `lob-${actual.lob_id}-rep-${salesRepName}`;
        if (!tableGroups[rowKey]) {
            tableGroups[rowKey] = { rowKey, bpName, lobName, salesRep: salesRepName, forecast: 0, confirmed: 0, actual: 0 };
        }
        tableGroups[rowKey].actual += convertedAmount;

        if (!lobChartGroups[lobName]) lobChartGroups[lobName] = { lobName, forecast: 0, confirmed: 0, actual: 0, forecastGp: 0, actualGp: 0 };
        lobChartGroups[lobName].actual += convertedAmount;
        lobChartGroups[lobName].actualGp += actualGp;

        repActuals[salesRepName] = (repActuals[salesRepName] || 0) + convertedAmount;
        if (!productLineChartGroups[pLine]) productLineChartGroups[pLine] = { lineName: pLine, forecast: 0 };

        initializeProductModelGroup(pModel, product);
    }

    uniqueProductIdsInView.forEach((pid: any) => {
        const p = productsById.get(pid);
        if (p) totalOnHand += Number(p.total_qty || 0);
    });

    return { 
        forecastTotal, confirmedTotal, actualTotal, totalOnHand, 
        tableData: Object.values(tableGroups).sort((a: any, b: any) => b.forecast - a.forecast),
        lobChartData: Object.values(lobChartGroups).sort((a: any, b: any) => a.lobName.localeCompare(b.lobName)),
        repChartData: Object.entries(repActuals).map(([name, actual]) => ({ name, actual })).sort((a: any, b: any) => b.actual - a.actual),
        productLineChartData: Object.values(productLineChartGroups).sort((a: any, b: any) => b.forecast - a.forecast),
        productModelTableData: Object.values(productModelGroups).sort((a: any, b: any) => a.productModel.localeCompare(b.productModel))
    };
  }, [dbEntries, dbActualSales, lobsById, productsById, repNameMap, dashFilters, dashCurrency, dbLobs]); 

  // ---- Chart.js datasets (derived from fullDashboardData) ----
  const compact = (v: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const money = (v: number) => `${dashCurrency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const repDoughnut = useMemo(() => {
    const reps = fullDashboardData.repChartData;
    return {
      labels: reps.map(r => r.name),
      datasets: [{
        data: reps.map(r => r.actual),
        backgroundColor: reps.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    };
  }, [fullDashboardData.repChartData]);

  const lobBar = useMemo(() => {
    const d = fullDashboardData.lobChartData;
    const barBase = { type: 'bar' as const, yAxisID: 'y', order: 3, borderRadius: 4, borderSkipped: false, maxBarThickness: 26, categoryPercentage: 0.7, barPercentage: 0.92 };
    const lineBase = { type: 'line' as const, yAxisID: 'yGp', order: 1, borderWidth: 2.5, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, pointBorderColor: '#fff', pointBorderWidth: 1.5 };
    return {
      labels: d.map(x => x.lobName),
      datasets: [
        // Bars (left axis): Actual Sales -> Forecast -> Confirmed
        { ...barBase, label: 'Actual Sales', data: d.map(x => x.actual), backgroundColor: SERIES.actual },
        { ...barBase, label: 'Forecast', data: d.map(x => x.forecast), backgroundColor: SERIES.forecast },
        { ...barBase, label: 'Confirmed', data: d.map(x => x.confirmed || 0), backgroundColor: SERIES.confirmed },
        // GP lines (right axis)
        { ...lineBase, label: 'Forecast GP', data: d.map(x => x.forecastGp || 0), borderColor: SERIES.forecastGp, backgroundColor: SERIES.forecastGp, pointBackgroundColor: SERIES.forecastGp },
        { ...lineBase, label: 'Actual GP', data: d.map(x => x.actualGp || 0), borderColor: SERIES.actualGp, backgroundColor: SERIES.actualGp, pointBackgroundColor: SERIES.actualGp, borderDash: [5, 4] },
      ],
    };
  }, [fullDashboardData.lobChartData]);

  const plBar = useMemo(() => {
    const d = fullDashboardData.productLineChartData;
    return {
      labels: d.map(x => x.lineName),
      datasets: [{ label: 'Forecast', data: d.map(x => x.forecast), backgroundColor: SERIES.forecast, borderRadius: 4, borderSkipped: false, maxBarThickness: 44 }],
    };
  }, [fullDashboardData.productLineChartData]);

  // ---- Monthly (year-to-date) aggregation: Jan -> current month, independent of the month filter ----
  const monthlyChartData = useMemo(() => {
    const year = new Date().getFullYear();
    const nowIdx = new Date().getMonth(); // 0-based current month
    const rate = EXCHANGE_RATES[dashCurrency as keyof typeof EXCHANGE_RATES];

    const map: Record<string, { forecast: number; confirmed: number; actual: number; forecastGp: number; actualGp: number }> = {};
    const months: string[] = [];
    for (let m = 0; m <= nowIdx; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      months.push(key);
      map[key] = { forecast: 0, confirmed: 0, actual: 0, forecastGp: 0, actualGp: 0 };
    }

    // Same filters as the rest of the dashboard, EXCEPT the month range (this chart is always YTD)
    const passNonMonth = (lobId: number, productId: number, repNo: string) => {
      if (dashFilters.salesPerson !== 'All' && repNo !== dashFilters.salesPerson) return false;
      const lob = lobsById.get(lobId);
      if (dashFilters.lob !== 'All' && lob?.lob_code !== dashFilters.lob) return false;
      if (dashFilters.businessPartner !== 'All' && lob?.sold_to_bp_name !== dashFilters.businessPartner) return false;
      const product = productsById.get(productId);
      if (dashFilters.brand !== 'All' && product?.brand !== dashFilters.brand) return false;
      if (dashFilters.productLine !== 'All' && product?.product_line !== dashFilters.productLine) return false;
      if (dashFilters.productCategory !== 'All' && product?.product_category !== dashFilters.productCategory) return false;
      if (dashFilters.productGroup !== 'All' && product?.item_group !== dashFilters.productGroup) return false;
      if (dashFilters.productModel !== 'All' && product?.product_model !== dashFilters.productModel) return false;
      if (dashFilters.itemCode !== 'All' && product?.item_code !== dashFilters.itemCode) return false;
      return true;
    };

    (dbEntriesYtd || []).forEach((entry: any) => {
      const key = String(entry.planning_month).substring(0, 7);
      if (!map[key]) return;
      const lob = lobsById.get(Number(entry.lob_id));
      const repNo = lob?.sales_representative_no || 'Unknown';
      if (!passNonMonth(Number(entry.lob_id), Number(entry.product_id), repNo)) return;
      const product = productsById.get(Number(entry.product_id));
      const convertedAmount = Number(entry.total_amount) * rate;
      map[key].forecast += convertedAmount;
      const plannedQty = Number(entry.planned_quantity || 1);
      const priceAed = Number(entry.planned_price_aed) || (Number(entry.total_amount) / plannedQty);
      map[key].confirmed += Number(entry.confirmed_quantity || 0) * priceAed * rate;
      const cogsRaw = Number(product?.cogs_price) || 0;
      const cogsAed = String(product?.cogs_currency || '').toUpperCase() === 'USD' ? cogsRaw * USD_TO_AED_RATE : cogsRaw;
      map[key].forecastGp += (priceAed - cogsAed) * plannedQty * rate;
    });

    (dbActualSalesYtd || []).forEach((actual: any) => {
      const key = String(actual.invoice_date).substring(0, 7);
      if (!map[key]) return;
      const lob = lobsById.get(Number(actual.lob_id));
      const repNo = actual.sales_representative_no || lob?.sales_representative_no || 'Unknown';
      if (!passNonMonth(Number(actual.lob_id), Number(actual.product_id), repNo)) return;
      const product = productsById.get(Number(actual.product_id));
      map[key].actual += Number(actual.sales) * rate;
      const cogsRaw = Number(product?.cogs_price) || 0;
      const cogsAed = String(product?.cogs_currency || '').toUpperCase() === 'USD' ? cogsRaw * USD_TO_AED_RATE : cogsRaw;
      map[key].actualGp += (Number(actual.sales) - cogsAed * Number(actual.quantities || 0)) * rate;
    });

    return months.map(key => ({ month: key, label: MONTHS_SHORT[Number(key.split('-')[1]) - 1], ...map[key] }));
  }, [dbEntriesYtd, dbActualSalesYtd, lobsById, productsById, dashFilters, dashCurrency, EXCHANGE_RATES, USD_TO_AED_RATE]);

  const monthBar = useMemo(() => {
    const d = monthlyChartData;
    const barBase = { type: 'bar' as const, yAxisID: 'y', order: 3, borderRadius: 4, borderSkipped: false, maxBarThickness: 22, categoryPercentage: 0.7, barPercentage: 0.92 };
    const lineBase = { type: 'line' as const, yAxisID: 'yGp', order: 1, borderWidth: 2.5, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, pointBorderColor: '#fff', pointBorderWidth: 1.5 };
    return {
      labels: d.map(x => x.label),
      datasets: [
        { ...barBase, label: 'Actual Sales', data: d.map(x => x.actual), backgroundColor: SERIES.actual },
        { ...barBase, label: 'Forecast', data: d.map(x => x.forecast), backgroundColor: SERIES.forecast },
        { ...barBase, label: 'Confirmed', data: d.map(x => x.confirmed), backgroundColor: SERIES.confirmed },
        { ...lineBase, label: 'Forecast GP', data: d.map(x => x.forecastGp), borderColor: SERIES.forecastGp, backgroundColor: SERIES.forecastGp, pointBackgroundColor: SERIES.forecastGp },
        { ...lineBase, label: 'Actual GP', data: d.map(x => x.actualGp), borderColor: SERIES.actualGp, backgroundColor: SERIES.actualGp, pointBackgroundColor: SERIES.actualGp, borderDash: [5, 4] },
      ],
    };
  }, [monthlyChartData]);

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    layout: { padding: 4 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP,
        callbacks: {
          label: (ctx: any) => {
            const total = fullDashboardData.actualTotal || 1;
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return `  ${money(ctx.parsed)}  (${pct}%)`;
          },
        },
      },
      datalabels: {
        color: '#ffffff',
        font: { size: 10, weight: '700' },
        formatter: (val: number) => {
          const total = fullDashboardData.actualTotal || 1;
          const pct = (val / total) * 100;
          return pct >= 6 ? `${pct.toFixed(0)}%` : '';
        },
      },
    },
  };

  // Combo chart (revenue bars on left axis, GP lines on right axis)
  const lobBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600, easing: 'easeOutQuart' },
    layout: { padding: { top: 8 } },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, padding: 16, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { ...TOOLTIP, callbacks: { label: (ctx: any) => `  ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } },
      datalabels: { display: false },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b', maxRotation: 0, autoSkip: true } },
      y: {
        position: 'left', beginAtZero: true,
        grid: { color: GRID_COLOR }, border: { display: false },
        ticks: { color: '#94a3b8', callback: (v: any) => compact(Number(v)) },
        title: { display: true, text: `Revenue (${dashCurrency})`, color: '#94a3b8', font: { size: 10 } },
      },
      yGp: {
        position: 'right', beginAtZero: true,
        grid: { drawOnChartArea: false }, border: { display: false },
        ticks: { color: '#94a3b8', callback: (v: any) => compact(Number(v)) },
        title: { display: true, text: `GP (${dashCurrency})`, color: '#94a3b8', font: { size: 10 } },
      },
    },
  };

  const plBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    layout: { padding: { top: 18 } },
    plugins: {
      legend: { display: false },
      tooltip: { ...TOOLTIP, callbacks: { label: (ctx: any) => `  Forecast: ${money(ctx.parsed.y)}` } },
      datalabels: { anchor: 'end', align: 'end', offset: 2, color: '#475569', font: { size: 10, weight: '600' }, formatter: (v: number) => v > 0 ? compact(v) : '' },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b', maxRotation: 0, autoSkip: true } },
      y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: { color: '#94a3b8', callback: (v: any) => compact(Number(v)) } },
    },
  };

  // ---- Empty-state helpers: explain zero results instead of showing a blank/0 dashboard ----
  const fmtMonth = (v: string) => {
    if (!v) return '';
    const [y, m] = v.split('-');
    const idx = Number(m) - 1;
    return idx >= 0 && idx < 12 ? `${MONTHS_SHORT[idx]} ${y}` : v;
  };
  const periodLabel = (() => {
    const s = fmtMonth(dashFilters.startMonth);
    const e = fmtMonth(dashFilters.endMonth);
    if (!s && !e) return 'the selected period';
    if (s && e && s !== e) return `${s} – ${e}`;
    return s || e;
  })();
  const repLabel = dashFilters.salesPerson === 'All'
    ? 'all reps'
    : (repNameMap.get(String(dashFilters.salesPerson))
        || (String(user.employee_id) === String(dashFilters.salesPerson) ? user.full_name : dashFilters.salesPerson));
  const hasNoData = !isLoadingData
    && fullDashboardData.forecastTotal === 0
    && fullDashboardData.actualTotal === 0
    && fullDashboardData.confirmedTotal === 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-12" aria-busy={isLoadingData}>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-6 gap-4 items-end mb-4">
                {/* DATE RANGE FILTER */}
                <div className="col-span-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-1 uppercase">
                        Period
                        {isLoadingData && <Loader2 size={12} className="animate-spin text-blue-500" />}
                    </label>
                    <MonthRangePicker
                        disabled={isLoadingData}
                        value={{ start: dashFilters.startMonth, end: dashFilters.endMonth }}
                        onChange={(v) => setDashFilters({ ...dashFilters, startMonth: v.start, endMonth: v.end })}
                        className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 text-left text-slate-700 font-bold bg-white hover:border-slate-300 disabled:opacity-50"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">LOB</label>
                    <SearchableSelect
                        disabled={isLoadingData}
                        value={dashFilters.lob}
                        onChange={(v) => setDashFilters({ ...dashFilters, lob: v })}
                        allLabel="All"
                        options={dashboardFilterOptions.lobs.map((l: any) => ({ value: l.code, label: `${l.code}${l.name ? ` - ${l.name}` : ''}` }))}
                    />
                </div>

               <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Sales Rep Name</label>
                    <SearchableSelect
                        disabled={isLoadingData}
                        value={dashFilters.salesPerson}
                        onChange={(v) => setDashFilters({ ...dashFilters, salesPerson: v })}
                        allLabel="All Reps"
                        emptyLabel="No reps in your LOB-code scope"
                        options={dashboardFilterOptions.salesReps.map((rep: any) => ({ value: rep.id, label: rep.name }))}
                    />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase truncate">Business Partner</label>
                    <SearchableSelect
                        disabled={isLoadingData}
                        value={dashFilters.businessPartner}
                        onChange={(v) => setDashFilters({ ...dashFilters, businessPartner: v })}
                        allLabel="All"
                        options={dashboardFilterOptions.bps.map(bp => ({ value: bp, label: bp }))}
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Brand</label>
                    <SearchableSelect
                        disabled={isLoadingData}
                        value={dashFilters.brand}
                        onChange={(v) => setDashFilters({ ...dashFilters, brand: v })}
                        allLabel="All"
                        align="right"
                        emptyLabel="No brands for the current rep / period"
                        options={dashboardFilterOptions.brands.map(b => ({ value: b, label: b }))}
                    />
                </div>
            </div>
            <div className="grid grid-cols-5 gap-4 items-end">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Product Line</label><SearchableSelect disabled={isLoadingData} value={dashFilters.productLine} onChange={(v) => setDashFilters({ ...dashFilters, productLine: v })} allLabel="All" emptyLabel="No product lines for the current selection" options={dashboardFilterOptions.pLines.map(l => ({ value: l, label: l }))} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Product Category</label><SearchableSelect disabled={isLoadingData} value={dashFilters.productCategory} onChange={(v) => setDashFilters({ ...dashFilters, productCategory: v })} allLabel="All" emptyLabel="No categories for the current selection" options={dashboardFilterOptions.pCats.map(c => ({ value: c, label: c }))} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Product Group</label><SearchableSelect disabled={isLoadingData} value={dashFilters.productGroup} onChange={(v) => setDashFilters({ ...dashFilters, productGroup: v })} allLabel="All" emptyLabel="No groups for the current selection" options={dashboardFilterOptions.pGroups.map(g => ({ value: g, label: g }))} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Product Model</label><SearchableSelect disabled={isLoadingData} value={dashFilters.productModel} onChange={(v) => setDashFilters({ ...dashFilters, productModel: v })} allLabel="All" align="right" emptyLabel="No models for the current selection" options={dashboardFilterOptions.pModels.map(m => ({ value: m, label: m }))} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Item Code</label><SearchableSelect disabled={isLoadingData} value={dashFilters.itemCode} onChange={(v) => setDashFilters({ ...dashFilters, itemCode: v })} allLabel="All" align="right" emptyLabel="No item codes for the current selection" options={dashboardFilterOptions.itemCodes.map(i => ({ value: i, label: i }))} /></div>
            </div>
        </div>

        {hasNoData && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 shadow-sm">
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold">No forecast or actual sales for <span className="underline decoration-amber-300 underline-offset-2">{repLabel}</span> in {periodLabel}.</p>
                    <p className="text-amber-700/90 mt-0.5">Try widening the period or choosing a different sales rep{dashFilters.salesPerson !== 'All' ? '' : ' / filter'}.</p>
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center border-b border-slate-100 pb-6 mb-6">
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Currency</label>
                    <div className="flex border border-slate-300 rounded overflow-hidden shadow-sm">
                        {['AED', 'MYR', 'USD'].map((curr: any) => (
                            <button key={curr} onClick={() => setDashCurrency(curr)} className={`px-4 py-1.5 text-xs font-bold transition-colors ${dashCurrency === curr ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border-r border-slate-200 last:border-0'}`}>{curr}</button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-6 gap-6 divide-x divide-slate-100">
                    <div className="text-center px-2"><p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Forecast Revenue</p><p className="text-3xl font-light text-slate-800">{fullDashboardData.forecastTotal.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                    <div className="text-center px-2"><p className="text-xs font-bold text-emerald-600 mb-2 uppercase tracking-wide">Confirmed Revenue</p><p className="text-3xl font-medium text-emerald-600">{fullDashboardData.confirmedTotal.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                    <div className="text-center px-2"><p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Actual Revenue</p><p className="text-3xl font-light text-slate-800">{fullDashboardData.actualTotal.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                    <div className="text-center px-2"><p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Variance</p><p className={`text-3xl font-light ${(fullDashboardData.actualTotal - fullDashboardData.forecastTotal) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{((fullDashboardData.actualTotal - fullDashboardData.forecastTotal) > 0 ? '+' : '')}{(fullDashboardData.actualTotal - fullDashboardData.forecastTotal).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                    <div className="text-center px-2"><p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Achievement %</p><p className={`text-3xl font-light ${(fullDashboardData.forecastTotal > 0 && fullDashboardData.actualTotal >= fullDashboardData.forecastTotal) ? 'text-emerald-500' : 'text-slate-800'}`}>{fullDashboardData.forecastTotal > 0 ? ((fullDashboardData.actualTotal / fullDashboardData.forecastTotal) * 100).toFixed(2) : '0.00'}%</p></div>
                    <div className="text-center px-2"><p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Total On Hand</p><p className="text-3xl font-light text-slate-800">{fullDashboardData.totalOnHand.toLocaleString()}</p></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-4 pb-8">
                <div className="col-span-1 flex items-center justify-center relative border-r border-slate-100 pr-6">
                    <div className="w-56 h-56 relative shrink-0">
                        {fullDashboardData.actualTotal > 0 ? (
                            <>
                                <Doughnut data={repDoughnut} options={doughnutOptions} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Actual</span>
                                    <span className="text-xl font-light text-slate-800">{compact(fullDashboardData.actualTotal)}</span>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-center"><p className="text-slate-500 italic text-sm">No actual sales for the selected filters.</p></div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 ml-6 text-[11px] font-bold text-slate-600 max-h-56 overflow-y-auto custom-scrollbar">
                        {fullDashboardData.repChartData.map((rep, idx) => {
                            if (rep.actual === 0) return null;
                            const pct = ((rep.actual / fullDashboardData.actualTotal) * 100).toFixed(2);
                            return (
                                <div key={rep.name} className="flex items-center gap-2 whitespace-nowrap">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                                    <span className="w-10 text-slate-500 font-mono text-right">{pct}%</span>
                                    <span className="truncate max-w-[100px]" title={rep.name}>{rep.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="col-span-2 flex flex-col h-72">
                    <p className="text-sm font-bold text-slate-700 mb-3 px-1">Revenue Performance by LOB</p>
                    <div className="flex-1 min-h-0">
                        {fullDashboardData.lobChartData.length > 0 ? (
                            <Bar data={lobBar as any} options={lobBarOptions} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><p className="text-slate-500 italic text-sm">No data available for the selected filters.</p></div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 border border-slate-200 rounded-lg overflow-auto max-h-[500px] relative">
                <table className="w-full text-xs text-right whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 text-center w-12">No</th>
                            <th className="px-4 py-3 text-left">Sales Rep Name</th>
                            <th className="px-4 py-3 text-left">LOB</th>
                            <th className="px-4 py-3 text-left">Business Partner</th>
                            <th className="px-4 py-3">Forecast</th>
                            <th className="px-4 py-3 text-emerald-700">Confirmed</th>
                            <th className="px-4 py-3">Actual Sales</th>
                            <th className="px-4 py-3">Variance</th>
                            <th className="px-4 py-3">Achievement %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {fullDashboardData.tableData.map((row: any, idx: number) => {
                            const isPos = (row.actual - row.forecast) >= 0;
                            const pct = row.forecast > 0 ? ((row.actual / row.forecast) * 100).toFixed(2) : '0.00';
                            return (
                                <tr key={row.rowKey} className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-bold text-slate-500 text-left">{row.salesRep}</td>
                                    <td className="px-4 py-2.5 font-bold text-slate-700 text-left">{row.lobName}</td>
                                    <td className="px-4 py-2.5 text-slate-600 text-left truncate max-w-[250px]" title={row.bpName}>{row.bpName}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.forecast.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className="px-4 py-2.5 font-mono text-emerald-600">{row.confirmed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.actual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className={`px-4 py-2.5 font-mono ${isPos ? 'text-slate-700' : 'text-rose-500'}`}>{row.actual - row.forecast > 0 ? '+' : ''}{(row.actual - row.forecast).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className={`px-4 py-2.5 font-mono font-bold ${Number(pct) >= 100 ? 'text-emerald-500' : 'text-slate-600'}`}>{pct}%</td>
                                </tr>
                            );
                        })}
                        {fullDashboardData.tableData.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500 italic">No forecast or actual data matches the selected filters.</td></tr>}
                    </tbody>
                    
                    {fullDashboardData.tableData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20 bg-slate-100 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] border-t-2 border-slate-200">
                            <tr className="font-bold">
                                <td colSpan={4} className="px-4 py-3 text-left text-slate-800">Total</td>
                                <td className="px-4 py-3 font-mono text-slate-800">{fullDashboardData.forecastTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 font-mono text-emerald-600">{fullDashboardData.confirmedTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 font-mono text-slate-800">{fullDashboardData.actualTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className={`px-4 py-3 font-mono ${((fullDashboardData.actualTotal - fullDashboardData.forecastTotal) >= 0) ? 'text-slate-800' : 'text-rose-600'}`}>{((fullDashboardData.actualTotal - fullDashboardData.forecastTotal) > 0 ? '+' : '')}{(fullDashboardData.actualTotal - fullDashboardData.forecastTotal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 font-mono text-slate-800">{fullDashboardData.forecastTotal > 0 ? ((fullDashboardData.actualTotal / fullDashboardData.forecastTotal) * 100).toFixed(2) : '0.00'}%</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
            <div className="flex flex-col h-80">
                <p className="text-sm font-bold text-slate-700 mb-0.5 px-1">Revenue &amp; GP by Month</p>
                <p className="text-[11px] text-slate-500 mb-3 px-1">Current year to date ({currentYear}) — independent of the month filter above</p>
                <div className="flex-1 min-h-0">
                    {monthlyChartData.some(x => x.forecast || x.actual || x.confirmed) ? (
                        <Bar data={monthBar as any} options={lobBarOptions} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><p className="text-slate-500 italic text-sm">No data for {currentYear} yet.</p></div>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
            <div className="flex flex-col h-72 mb-6">
                <p className="text-sm font-bold text-slate-700 mb-3 px-1">Forecast by Product Line</p>
                <div className="flex-1 min-h-0">
                    {fullDashboardData.productLineChartData.length > 0 ? (
                        <Bar data={plBar} options={plBarOptions} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><p className="text-slate-500 italic text-sm">No forecast data available.</p></div>
                    )}
                </div>
            </div>

            <div className="mt-12 border border-slate-200 rounded-lg overflow-auto max-h-[500px] relative">
                <table className="w-full text-xs text-right whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 text-center w-12">No</th>
                            <th className="px-4 py-3 text-left">Product Model</th>
                            <th className="px-4 py-3">Forecast Quantity</th>
                            <th className="px-4 py-3">Forecast Amount</th>
                            <th className="px-4 py-3">On Hand KME</th>
                            <th className="px-4 py-3">On Hand KMI</th>
                            <th className="px-4 py-3">Total On Hand</th>
                            <th className="px-4 py-3">Avg Sales Last 12M</th>
                            <th className="px-4 py-3">Avg Sales Last 6M</th>
                            <th className="px-4 py-3">Avg Sales Last 3M</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {fullDashboardData.productModelTableData.map((row, idx: number) => {
                            return (
                                <tr key={row.productModel} className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-bold text-slate-600 text-left">{row.productModel}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.forecastQty.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.forecastAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.onHandKME.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.onHandKMI.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{row.totalOnHand.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.avg12m.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.avg6m.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 font-mono">{row.avg3m.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                        {fullDashboardData.productModelTableData.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500 italic">No data matches the selected filters.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}