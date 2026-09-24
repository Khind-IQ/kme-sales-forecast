import React, { useState, useEffect, useMemo } from 'react';
import { router, usePage } from '@inertiajs/react'; 
import Select from 'react-select'; 
import { Save, CheckCircle2, Download, Search, Loader2, Lock, AlertCircle, Info, Plus, X, Trash2 } from 'lucide-react';

// shared  Utilities & Hooks
import { getNextMonthString, getPreviousMonthString } from '../Utils/helpers';
import { downloadCSV } from '../Utils/exportUtils';
import { usePagination } from '../Hooks/usePagination';
import { useExchangeRates } from '../Hooks/useExchangeRates';
import Pagination from './Shared/Pagination';
import MonthPicker from './Shared/MonthPicker';

const customSelectStyles = {
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    control: (base: any, state: any) => ({ 
        ...base, borderColor: state.isFocused ? 'rgb(var(--color-accent))' : 'rgb(var(--color-base-300))', borderRadius: '0.5rem', minHeight: '36px', height: '36px', boxShadow: 'none', fontSize: '13px', backgroundColor: state.isDisabled ? 'rgb(var(--color-base-200))' : 'rgb(var(--color-base-100))' 
    }),
    valueContainer: (base: any) => ({ ...base, padding: '0 8px' }),
    input: (base: any) => ({ ...base, margin: '0', padding: '0' }),
    indicatorsContainer: (base: any) => ({ ...base, height: '36px' }),
    option: (base: any, state: any) => ({
        ...base, fontSize: '13px', padding: '6px 10px',
        color: 'rgb(var(--color-base-content))',
        backgroundColor: state.isSelected ? 'rgb(var(--color-primary) / 0.2)' : state.isFocused ? 'rgb(var(--color-base-200))' : 'transparent',
    })
};

export default function SalesDataEntry({ dbLobs, dbProducts, dbPricing, dbEntries, dbAddableProducts = [] }: any) {
  const user = usePage().props.auth.user as any; 
  const { EXCHANGE_RATES, USD_TO_AED_RATE } = useExchangeRates();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false); // track loading state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [planningMonth, setPlanningMonth] = useState(getNextMonthString());
  const [productSearchInput, setProductSearchInput] = useState('');
  const [lobSearchInput, setLobSearchInput] = useState(''); 
  const [recentMonthFilter, setRecentMonthFilter] = useState(getNextMonthString());
  const [edits, setEdits] = useState<Record<number, { qty?: number | '', planPrice?: number | '', confirmedQty?: number | '', priceUsdRaw?: string }>>({});

  // "Add Model to Forecast": models the rep manually adds to this BP's grid.
  // Purely client-side until saved — a refresh clears unsaved additions.
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoadingAddable, setIsLoadingAddable] = useState(false);
  const [addedProducts, setAddedProducts] = useState<any[]>([]);

  // Reset manual additions whenever the BP or forecast month changes (they're BP/month-specific).
  useEffect(() => { setAddedProducts([]); }, [selectedLob, planningMonth]);

  // View-only rule: forecasts can only be entered/edited for next month onward
  // (matches the backend validation `after_or_equal:nextMonth`). Selecting the
  // current month or any past month puts the grid into read-only mode so reps
  // can still review historical forecasts without editing or saving them.
  const isReadOnly = planningMonth < getNextMonthString();

  const lobOptions = useMemo(() => {
    const lowerSearch = lobSearchInput.toLowerCase();
    return dbLobs
        .filter((l: any) => user.role_id === 2 || l.sales_representative_no === user.employee_id)
        .filter((l: any) => (l.sold_to_bp || '').toLowerCase().includes(lowerSearch) || (l.sold_to_bp_name || '').toLowerCase().includes(lowerSearch))
        .slice(0, 50) 
        .map((l: any) => {
            // if the user is an Admin, prefix the label with the Sales Rep's Name
            const repPrefix = user.role_id === 2 ? `[${l.sales_rep_name || l.sales_representative_no || 'Unassigned'}] ` : '';
            
            return { 
                value: l.lob_id, 
                label: `${repPrefix}${l.sold_to_bp} - ${l.sold_to_bp_name}`,
                repName: l.sales_rep_name 
            };
        });
  }, [dbLobs, lobSearchInput, user]);

  const currentLobName = useMemo(() => dbLobs.find((l: any) => l.lob_id === selectedLob)?.lob_name || '-', [dbLobs, selectedLob]);

  const baseGridProducts = useMemo(() => {
      if (!selectedLob || dbProducts.length === 0) return [];
      const prevMonthString = getPreviousMonthString(planningMonth);
      const priceMap = new Map();
      
      // makesure dbPricing is an array before iterating
      if (Array.isArray(dbPricing)) {
          dbPricing.forEach((p: any) => {
              if (p.lob_id === selectedLob) priceMap.set(p.product_id, p.price);
              else if (p.lob_id === null && !priceMap.has(p.product_id)) priceMap.set(p.product_id, p.price);
          });
      }

      const currentMonthEntries = new Map();
      const prevMonthEntries = new Map();
      
      if (Array.isArray(dbEntries)) {
          dbEntries.forEach((e: any) => {
              if (e.lob_id === selectedLob) {
                  if (e.planning_month === planningMonth) currentMonthEntries.set(e.product_id, e);
                  if (e.planning_month === prevMonthString) prevMonthEntries.set(e.product_id, e);
              }
          });
      }

      const validIds = new Set([...currentMonthEntries.keys(), ...priceMap.keys()]);
      const list = dbProducts.filter((p: any) => validIds.has(p.product_id));

      return list.map((prod: any) => {
          const masterPrice = priceMap.get(prod.product_id) || 0;
          const existingEntry = currentMonthEntries.get(prod.product_id);
          const previousEntry = prevMonthEntries.get(prod.product_id);

          const cogsRaw = Number(prod.cogs_price) || 0;
          const isCogsUsd = (prod.cogs_currency || '').toUpperCase() === 'USD';
          const cogsPriceAed = isCogsUsd ? (cogsRaw * USD_TO_AED_RATE) : cogsRaw;

          return { 
              ...prod, master_price_aed: Number(masterPrice), cogs_price_aed: cogsPriceAed, cogs_raw: cogsRaw, is_cogs_usd: isCogsUsd,
              saved_qty: existingEntry ? Number(existingEntry.planned_quantity) : '',
              saved_price: existingEntry && Number(existingEntry.planned_price_aed) !== Number(masterPrice) ? Number(existingEntry.planned_price_aed) : '',
              saved_confirmed_qty: existingEntry && existingEntry.confirmed_quantity != null ? Number(existingEntry.confirmed_quantity) : '', 
              // No carry-forward prefill when viewing a past/current month (read-only) — show saved data only
              prefill_qty: (!isReadOnly && !existingEntry && previousEntry) ? Number(previousEntry.planned_quantity) : '',
              prefill_price: (!isReadOnly && !existingEntry && previousEntry && Number(previousEntry.planned_price_aed) !== Number(masterPrice)) ? Number(previousEntry.planned_price_aed) : '',
              prefill_confirmed_qty: (!isReadOnly && !existingEntry && previousEntry && previousEntry.confirmed_quantity != null) ? Number(previousEntry.confirmed_quantity) : ''
          };
      });
  }, [selectedLob, planningMonth, dbProducts, dbPricing, dbEntries, isReadOnly, USD_TO_AED_RATE]);

  // Manually-added models, shaped like grid rows. Excludes any that are already in the
  // base grid (can't add a duplicate). Uses the resolved reference price as the list price.
  const addedRows = useMemo(() => {
      if (addedProducts.length === 0) return [];
      const baseIds = new Set(baseGridProducts.map((p: any) => p.product_id));
      return addedProducts
          .filter((prod: any) => !baseIds.has(prod.product_id))
          .map((prod: any) => {
              const cogsRaw = Number(prod.cogs_price) || 0;
              const isCogsUsd = (prod.cogs_currency || '').toUpperCase() === 'USD';
              const cogsPriceAed = isCogsUsd ? (cogsRaw * USD_TO_AED_RATE) : cogsRaw;
              return {
                  ...prod,
                  master_price_aed: Number(prod.resolved_price || 0),
                  cogs_price_aed: cogsPriceAed, cogs_raw: cogsRaw, is_cogs_usd: isCogsUsd,
                  saved_qty: '', saved_price: '', saved_confirmed_qty: '',
                  prefill_qty: '', prefill_price: '', prefill_confirmed_qty: '',
                  is_added: true,
              };
          });
  }, [addedProducts, baseGridProducts, USD_TO_AED_RATE]);

  // Full grid = manually-added rows on top, then the normal priced rows.
  const gridProducts = useMemo(() => [...addedRows, ...baseGridProducts], [addedRows, baseGridProducts]);

  const filteredGridProducts = useMemo(() => {
      if (!productSearchInput.trim()) return gridProducts;
      const lower = productSearchInput.toLowerCase();
      return gridProducts.filter((p: any) => 
          (p.product_model || '').toLowerCase().includes(lower) || 
          (p.item_code || '').toLowerCase().includes(lower) ||
          (p.item_description || '').toLowerCase().includes(lower)
      );
  }, [gridProducts, productSearchInput]);

  //  Custom Pagination Hook
  const { currentPage, totalPages, paginatedData, goToNextPage, goToPrevPage, setCurrentPage } = usePagination(filteredGridProducts, 100);

  useEffect(() => {
      setCurrentPage(1);
  }, [selectedLob, productSearchInput, setCurrentPage]);

  const filteredEntries = useMemo(() => {
      if (!Array.isArray(dbEntries)) return [];
      return dbEntries.filter((entry: any) => entry.planning_month === recentMonthFilter);
  }, [dbEntries, recentMonthFilter]);

  const handleEdit = (productId: number, field: 'qty' | 'planPrice' | 'confirmedQty', value: any) => {
      setEdits(prev => {
          const current = prev[productId] || {}; 
          const parsedValue = value === '' ? '' : Number(value);
          return { ...prev, [productId]: { ...current, [field]: parsedValue } };
      });
  };

  // Plan price entered in AED — canonical value; drop any stale USD raw so the USD box re-derives.
  const handlePlanPriceAed = (productId: number, value: any) => {
      setEdits(prev => {
          const current = { ...(prev[productId] || {}) };
          delete current.priceUsdRaw;
          current.planPrice = value === '' ? '' : Number(value);
          return { ...prev, [productId]: current };
      });
  };

  // Plan price entered in USD — convert to AED (canonical) and keep the raw USD text for smooth typing.
  const handlePlanPriceUsd = (productId: number, value: any) => {
      setEdits(prev => {
          const current = prev[productId] || {};
          const aed = value === '' ? '' : Number((Number(value) * USD_TO_AED_RATE).toFixed(2));
          return { ...prev, [productId]: { ...current, planPrice: aed, priceUsdRaw: value } };
      });
  };

  // Open the "Add Model" picker and lazily fetch the priced-product list for this LOB.
  const openAddModal = () => {
      if (!selectedLob || isReadOnly) return;
      setShowAddModal(true);
      setIsLoadingAddable(true);
      router.reload({
          only: ['dbAddableProducts'],
          data: { lob_id: selectedLob },
          onFinish: () => setIsLoadingAddable(false),
      });
  };

  const addModel = (product: any) => {
      if (!product) return;
      setAddedProducts(prev => prev.some(p => p.product_id === product.product_id) ? prev : [...prev, product]);
  };

  const removeAddedModel = (productId: number) => {
      setAddedProducts(prev => prev.filter(p => p.product_id !== productId));
      setEdits(prev => { const next = { ...prev }; delete next[productId]; return next; });
  };

  // Priced models not already in the grid — options for the Add Model picker.
  const addableOptions = useMemo(() => {
      const existing = new Set(gridProducts.map((p: any) => p.product_id));
      return (dbAddableProducts || [])
          .filter((p: any) => !existing.has(p.product_id))
          .map((p: any) => ({
              value: p.product_id,
              label: `${p.product_model || p.item_code} — ${p.item_code} (suggested AED ${Number(p.resolved_price || 0).toFixed(2)})`,
              product: p,
          }));
  }, [dbAddableProducts, gridProducts]);

  const pendingSavesCount = useMemo(() => {
      let count = 0;
      gridProducts.forEach((prod: any) => {
          const editData = edits[prod.product_id];
          const hasEdit = editData !== undefined;
          const rowQty = hasEdit && editData.qty !== undefined ? editData.qty : (prod.saved_qty !== '' ? prod.saved_qty : prod.prefill_qty);
          const defaultPrice = prod.saved_price !== '' ? prod.saved_price : prod.prefill_price;
          const rowPlanPrice = hasEdit && editData.planPrice !== undefined ? editData.planPrice : defaultPrice;
          const rowConfirmedQty = hasEdit && editData.confirmedQty !== undefined ? editData.confirmedQty : (prod.saved_confirmed_qty !== '' ? prod.saved_confirmed_qty : prod.prefill_confirmed_qty);
          
          const activePrice = rowPlanPrice !== '' && Number(rowPlanPrice) > 0 ? Number(rowPlanPrice) : prod.master_price_aed;
          const isQtyChanged = Number(rowQty || 0) !== Number(prod.saved_qty || 0);
          const isPriceChanged = Number(activePrice) !== Number(prod.saved_price || prod.master_price_aed);
          const isConfirmedQtyChanged = Number(rowConfirmedQty || 0) !== Number(prod.saved_confirmed_qty || 0);
          const isUnsavedPrefill = prod.saved_qty === '' && prod.prefill_qty !== '';
          
          if ((isQtyChanged || isPriceChanged || isConfirmedQtyChanged || isUnsavedPrefill) && (rowQty !== '' && Number(rowQty) > 0)) count++;
      });
      return count;
  }, [gridProducts, edits]);

  const gridTotals = useMemo(() => {
      let totalFcastQty = 0, totalConfQty = 0, totalPlanPrice = 0, totalAed = 0, totalGp = 0;

      filteredGridProducts.forEach((prod: any) => {
          const editData = edits[prod.product_id];
          const isEditing = editData !== undefined;
          
          const rowQty = isEditing && editData.qty !== undefined ? editData.qty : (prod.saved_qty !== '' ? prod.saved_qty : prod.prefill_qty);
          const defaultPrice = prod.saved_price !== '' ? prod.saved_price : prod.prefill_price;
          const rowPlanPrice = isEditing && editData.planPrice !== undefined ? editData.planPrice : defaultPrice;
          const rowConfirmedQty = isEditing && editData.confirmedQty !== undefined ? editData.confirmedQty : (prod.saved_confirmed_qty !== '' ? prod.saved_confirmed_qty : prod.prefill_confirmed_qty);
          
          const activePrice = rowPlanPrice !== '' && Number(rowPlanPrice) > 0 ? Number(rowPlanPrice) : prod.master_price_aed;
          const qtyNum = rowQty !== '' ? Number(rowQty) : 0;
          const confQtyNum = rowConfirmedQty !== '' && !isNaN(Number(rowConfirmedQty)) ? Number(rowConfirmedQty) : 0;
          totalFcastQty += qtyNum;
          totalConfQty += confQtyNum;
          if (rowPlanPrice !== '') totalPlanPrice += Number(rowPlanPrice);
          totalAed += (qtyNum * activePrice);
          totalGp += ((activePrice - prod.cogs_price_aed) * qtyNum);
      });

      return { totalFcastQty, totalConfQty, totalPlanPrice, totalAed, totalGp };
  }, [filteredGridProducts, edits]);

  const handleSaveAll = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedLob) return;
      if (isReadOnly) return showNotification('This month is view-only. Select next month or later to edit.', 'info');

      const payloadEntries: any[] = [];
      gridProducts.forEach((prod: any) => {
          const editData = edits[prod.product_id];
          const hasEdit = editData !== undefined;
          const rowQty = hasEdit && editData.qty !== undefined ? editData.qty : (prod.saved_qty !== '' ? prod.saved_qty : prod.prefill_qty);
          const defaultPrice = prod.saved_price !== '' ? prod.saved_price : prod.prefill_price;
          const rowPlanPrice = hasEdit && editData.planPrice !== undefined ? editData.planPrice : defaultPrice;
          const rowConfirmedQty = hasEdit && editData.confirmedQty !== undefined ? editData.confirmedQty : (prod.saved_confirmed_qty !== '' ? prod.saved_confirmed_qty : prod.prefill_confirmed_qty);
          const activePrice = rowPlanPrice !== '' && Number(rowPlanPrice) > 0 ? Number(rowPlanPrice) : prod.master_price_aed;

          if ((Number(rowQty || 0) !== Number(prod.saved_qty || 0) || Number(activePrice) !== Number(prod.saved_price || prod.master_price_aed) || Number(rowConfirmedQty || 0) !== Number(prod.saved_confirmed_qty || 0) || (prod.saved_qty === '' && prod.prefill_qty !== '')) && (rowQty !== '' && Number(rowQty) > 0)) {
              payloadEntries.push({
                  lob_id: selectedLob, product_id: prod.product_id, planning_month: planningMonth, planned_quantity: Number(rowQty),
                  planned_price_aed: activePrice, planned_price_myr: Number((activePrice * EXCHANGE_RATES.MYR).toFixed(2)),
                  planned_price_usd: Number((activePrice / USD_TO_AED_RATE).toFixed(2)), total_amount: Number((Number(rowQty) * activePrice).toFixed(2)),
                  confirmed_quantity: Number(rowConfirmedQty || 0)
              });
          }
      });

      if (payloadEntries.length === 0) return showNotification('No pending updates found.', 'info');

      setIsSaving(true);
      router.post(route('forecast.store'), { entries: payloadEntries }, {
          preserveScroll: true,
          preserveState: true, 
          onSuccess: () => {
              showNotification(`Saved ${payloadEntries.length} entries successfully!`);
              setEdits({}); 
              setRecentMonthFilter(planningMonth); 
              setIsSaving(false);
              // Refresh this LOB's grid so any newly-added models come back as real,
              // persisted rows (and clear the client-only "added" list to avoid dupes).
              setAddedProducts([]);
              if (selectedLob) {
                  router.reload({
                      only: ['dbProductsLob', 'dbPricingLob', 'dbEntriesLob'],
                      data: { lob_id: selectedLob },
                  });
              }
          },
          onError: () => { showNotification('Error saving entries.', 'error'); setIsSaving(false); }
      });
  };

  const exportEntriesToCSV = () => {
    if (filteredEntries.length === 0) return showNotification('No entries to export.', 'info');
    const headers = ['Month', 'BP Code', 'Product Line', 'Product Model', 'Plan Qty', 'Confirmed Qty', 'Net Sales (AED)'];
    const rows = filteredEntries.map((entry: any) => {
        const bp = dbLobs.find((l:any) => l.lob_id === entry.lob_id)?.sold_to_bp || 'Unknown';
        const productMatch = dbProducts.find((p:any) => p.product_id === entry.product_id);
        return [
            entry.planning_month, bp, `"${productMatch?.product_line || 'Unknown'}"`, `"${productMatch?.product_model || 'Unknown'}"`, 
            entry.planned_quantity, entry.confirmed_quantity != null ? entry.confirmed_quantity : 0, Number(entry.total_amount).toFixed(2)
        ].join(',');
    });
    downloadCSV(`forecast_entries_${recentMonthFilter}.csv`, headers, rows);
  };

  const showNotification = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), type === 'error' ? 5000 : 3000);
  };

  return (
    <div className="max-w-8xl mx-auto flex flex-col h-full space-y-4 relative animate-in fade-in duration-300">
        {notification && (
          <div
            role={notification.type === 'error' ? 'alert' : 'status'}
            aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
            className={`fixed top-20 right-8 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-top-4 ${
              notification.type === 'error' ? 'bg-error' : notification.type === 'info' ? 'bg-neutral' : 'bg-success'
            }`}
          >
            {notification.type === 'error' ? <AlertCircle size={20} /> : notification.type === 'info' ? <Info size={20} /> : <CheckCircle2 size={20} />}
            {notification.message}
          </div>
        )}

      {/* Header Filters */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0">
          <div className="flex flex-wrap items-end gap-6">
              <div className="w-96 flex-shrink-0">
                  <label className="block text-[11px] font-bold text-base-content/60 mb-1 uppercase">Sold to BP</label>
                  <Select isClearable options={lobOptions} menuPortalTarget={document.body} styles={customSelectStyles} value={lobOptions.find((opt:any) => opt.value === selectedLob) || null} placeholder="Search BP Code or Name..." onInputChange={(val, a) => { if (a.action === 'input-change') setLobSearchInput(val); }} onChange={(opt: any) => { 
                        const newLobId = opt ? opt.value : null;
                        setSelectedLob(newLobId); 
                        setEdits({}); 
                        setProductSearchInput(''); 
                        
                        // ask backend for just this LOB's data
                        if (newLobId) {
                            setIsLoadingData(true);
                            router.reload({
                                only: ['dbProductsLob', 'dbPricingLob', 'dbEntriesLob'],
                                data: { lob_id: newLobId }, // Pass the selected LOB
                                onFinish: () => setIsLoadingData(false) // preserveState and preserveScroll are true by default!
                            });
                        }
                    }} 
                  />
              </div>
              <div className="w-48">
                  <label className="block text-[11px] font-bold text-base-content/60 mb-1 uppercase">Forecast Month</label>
                  <MonthPicker value={planningMonth} onChange={setPlanningMonth} editableFrom={getNextMonthString()} className={`w-full border rounded-lg h-[36px] px-3 text-sm text-left bg-base-100 focus:ring-2 focus:ring-accent ${isReadOnly ? 'border-warning/40 text-warning-strong' : 'border-base-content/15 text-base-content/80 hover:border-base-content/25'}`} />
              </div>

              {/* View-only indicator for current/past months */}
              {isReadOnly && (
                  <div className="bg-warning/10 border border-warning/40 px-3 h-[36px] rounded-lg flex items-center gap-2" role="status">
                      <Lock size={14} className="text-warning-strong shrink-0" />
                      <span className="text-xs font-bold text-warning-strong">View only — past forecasts can't be edited</span>
                  </div>
              )}

              {/* show the Admin who owns this LOB */}
              {user.role_id === 2 && selectedLob && (
                  <div className="bg-warning/10 border border-warning/40 px-3 py-1.5 rounded-lg flex flex-col justify-center">
                      <span className="text-[11px] font-black text-warning-strong uppercase tracking-wider"></span>
                      <span className="text-xs font-bold text-warning-strong">
                          {lobOptions.find((opt: any) => opt.value === selectedLob)?.repName || 'Unassigned'}
                      </span>
                  </div>
              )}
              
              <div className="flex-1"></div>

              {!isReadOnly && (
                  <button
                      type="button"
                      onClick={openAddModal}
                      disabled={!selectedLob || isLoadingData}
                      className="h-[36px] px-4 rounded-lg font-bold text-sm border border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                      title={!selectedLob ? 'Select a Business Partner first' : 'Add a model to this forecast'}
                  >
                      <Plus size={16} /> Add Model
                  </button>
              )}

              {isReadOnly ? (
                  <div className="h-[36px] px-6 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-base-150 text-base-content/60 border border-base-300 whitespace-nowrap cursor-not-allowed">
                      <Lock size={16} /> Saving disabled
                  </div>
              ) : (
                  <button onClick={handleSaveAll} disabled={pendingSavesCount === 0 || isSaving || isLoadingData} className="bg-primary text-primary-content h-[36px] px-6 rounded-lg font-bold text-sm hover:bg-primary-hover disabled:bg-base-content/20 flex items-center justify-center gap-2 transition-all shadow-sm whitespace-nowrap">
                      <Save size={16} /> {isSaving ? 'Saving...' : `Save ${pendingSavesCount} Updates`}
                  </button>
              )}
          </div>
      </div>

      {/* Grid */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden flex-1 flex flex-col" style={{ minHeight: '600px', maxHeight: '60vh' }}>
          <div className="bg-base-200 border-b border-base-300 p-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-widest">Mass Entry {filteredGridProducts.length > 0 && `(${filteredGridProducts.length} Products)`}</span>
                  {isLoadingData && <Loader2 size={14} className="animate-spin text-primary ml-2" />}
                  {selectedLob && !isReadOnly && (
                      <div className="hidden xl:flex items-center gap-3 ml-3 pl-3 border-l border-base-300">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-base-content/60">
                              <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/50 shrink-0"></span>
                              Unsaved changes
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-base-content/60">
                              <span className="w-2.5 h-2.5 rounded-sm bg-success/20 border border-success/40 shrink-0"></span>
                              Carried from last month
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-base-content/60">
                              <span className="w-2.5 h-2.5 rounded-sm bg-warning/20 border border-warning/40 shrink-0"></span>
                              Custom price (differs from list)
                          </span>
                      </div>
                  )}
              </div>
              <div className="relative">
                  <Search className="w-4 h-4 text-base-content/60 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Filter product based on BP..." value={productSearchInput} onChange={(e) => setProductSearchInput(e.target.value)} disabled={!selectedLob || isLoadingData} className="pl-9 pr-4 py-1.5 border border-base-content/15 rounded-full text-xs focus:ring-accent w-64 shadow-inner disabled:bg-base-150" />
              </div>
          </div>
          
          <div className="overflow-auto flex-1 relative" aria-busy={isLoadingData}>
            {!selectedLob ? (
                <div className="absolute inset-0 flex items-center justify-center text-base-content/60 italic text-sm bg-base-200/50">Please select a Business Partner to load the grid.</div>
            ) : isLoadingData ? (
                <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center text-base-content/60 bg-base-200/50 gap-3">
                    <Loader2 size={30} className="animate-spin text-primary" />
                    <span className="text-sm font-medium">Fetching Pricing & Data...</span>
                </div>
            ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-20 shadow-sm text-[11px] uppercase tracking-wider text-base-content/60 bg-base-100">
                        <tr>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150 w-12 text-center">No</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150">LOB</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150">Product Model</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150">Item Code</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150">Description</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150 text-right">Price (AED)</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-150 text-right">COGS (AED)</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-accent-tint text-accent text-center border-l border-l-base-300 w-32 shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.05)]">Forecast Qty</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-accent-tint text-accent text-center w-32">Plan Price AED</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-accent-tint text-accent text-center w-32">Plan Price USD</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-success-tint text-success text-center w-32 border-x border-base-300">Confirm Qty</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-base-200 text-base-content text-right w-32">Total AED</th>
                            <th className="border-b border-base-300 px-4 py-3 font-bold bg-secondary-tint text-secondary text-right w-32 border-l border-base-300">GP (AED)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200 text-xs">
                        {paginatedData.map((prod: any, idx: number) => {
                            const editData = edits[prod.product_id];
                            const isEditing = editData !== undefined;
                            const rowQty = isEditing && editData.qty !== undefined ? editData.qty : (prod.saved_qty !== '' ? prod.saved_qty : prod.prefill_qty);
                            const defaultPrice = prod.saved_price !== '' ? prod.saved_price : prod.prefill_price;
                            const rowPlanPrice = isEditing && editData.planPrice !== undefined ? editData.planPrice : defaultPrice;
                            const rowConfirmedQty = isEditing && editData.confirmedQty !== undefined ? editData.confirmedQty : (prod.saved_confirmed_qty !== '' ? prod.saved_confirmed_qty : prod.prefill_confirmed_qty);
                            const isPrefilled = prod.saved_qty === '' && prod.prefill_qty !== '' && (!isEditing || editData.qty === undefined);
                            
                            const activePrice = rowPlanPrice !== '' && Number(rowPlanPrice) > 0 ? Number(rowPlanPrice) : prod.master_price_aed;
                            // USD box: show what the user typed (if editing in USD), else derive from the AED plan price
                            const rowPlanPriceUsd = (isEditing && editData.priceUsdRaw !== undefined)
                                ? editData.priceUsdRaw
                                : (rowPlanPrice !== '' && rowPlanPrice != null ? (Number(rowPlanPrice) / USD_TO_AED_RATE).toFixed(2) : '');
                            const qtyNum = rowQty !== '' ? Number(rowQty) : 0;
                            const totalVal = qtyNum * activePrice;
                            const gpVal = (activePrice - prod.cogs_price_aed) * qtyNum;
                            const actualIdx = ((currentPage - 1) * 100) + idx + 1;

                            const isQtyChanged = Number(rowQty || 0) !== Number(prod.saved_qty || 0);
                            const isPriceChanged = Number(activePrice) !== Number(prod.saved_price || prod.master_price_aed);
                            const isConfirmedQtyChanged = Number(rowConfirmedQty || 0) !== Number(prod.saved_confirmed_qty || 0);
                            const isRowModified = isQtyChanged || isPriceChanged || isConfirmedQtyChanged;

                            return (
                                <tr key={prod.product_id} className={`transition-colors ${isRowModified ? 'bg-primary/20 hover:bg-primary/25' : prod.is_added ? 'bg-info/5 hover:bg-info/10' : 'hover:bg-base-200'}`}>
                                    <td className="px-4 py-2 font-mono text-base-content/60 text-center">
                                        {prod.is_added && !isReadOnly ? (
                                            <button type="button" onClick={() => removeAddedModel(prod.product_id)} title="Remove this added model" className="text-base-content/30 hover:text-error transition-colors"><Trash2 size={14} /></button>
                                        ) : actualIdx}
                                    </td>
                                    <td className="px-4 py-2 font-medium text-base-content/80 truncate max-w-[120px]">{currentLobName}</td>
                                    <td className="px-4 py-2 font-bold text-base-content">
                                        {prod.is_added && <span className="inline-flex items-center mr-2 px-1.5 py-0.5 rounded bg-info/20 text-info text-[9px] font-black uppercase tracking-wide align-middle">New</span>}
                                        {prod.product_model}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-base-content/60">{prod.item_code}</td>
                                    <td className="px-4 py-2 text-base-content/70 truncate max-w-[200px]" title={prod.item_description}>{prod.item_description}</td>
                                    <td className="px-4 py-2 text-right font-medium text-base-content/70">
                                        {prod.master_price_aed > 0 ? (
                                            <div className="flex flex-col">
                                                <span>{prod.master_price_aed.toFixed(2)}</span>
                                                <span className="text-[11px] text-base-content/60">≈ ${(prod.master_price_aed / USD_TO_AED_RATE).toFixed(2)}</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    
                                    <td className="px-4 py-2 text-right font-medium text-base-content/70">
                                        {prod.cogs_price_aed > 0 ? (
                                            <div className="flex flex-col">
                                                <span>{prod.cogs_price_aed.toFixed(2)}</span>
                                                <span className="text-[11px] text-base-content/60">≈ ${(prod.cogs_price_aed / USD_TO_AED_RATE).toFixed(2)}</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    
                                    <td className="px-3 py-1.5 border-l border-l-base-200 shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.02)]">
                                        <input type="number" min="0" value={rowQty} disabled={isReadOnly} onChange={(e) => handleEdit(prod.product_id, 'qty', e.target.value)} placeholder="0" className={`w-full border-base-content/15 rounded text-center text-xs h-7 focus:ring-accent font-bold transition-colors disabled:bg-base-150 disabled:text-base-content/60 disabled:cursor-not-allowed ${isPrefilled ? 'bg-success/10 text-success border-success/40' : ''}`} />
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <input type="number" step="0.01" min="0" value={rowPlanPrice} disabled={isReadOnly} onChange={(e) => handlePlanPriceAed(prod.product_id, e.target.value)} placeholder={prod.master_price_aed.toFixed(2)} className={`w-full rounded text-right text-xs h-7 focus:ring-accent font-medium transition-colors disabled:bg-base-150 disabled:text-base-content/60 disabled:cursor-not-allowed ${isPrefilled && rowPlanPrice !== '' ? 'bg-success/10 border-success/40 text-success' : rowPlanPrice !== '' && !isPrefilled ? 'bg-warning/10 border-warning/40 text-warning-strong' : 'border-base-content/15'}`} />
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <input type="number" step="0.01" min="0" value={rowPlanPriceUsd} disabled={isReadOnly} onChange={(e) => handlePlanPriceUsd(prod.product_id, e.target.value)} placeholder={(prod.master_price_aed / USD_TO_AED_RATE).toFixed(2)} className={`w-full rounded text-right text-xs h-7 focus:ring-accent font-medium transition-colors disabled:bg-base-150 disabled:text-base-content/60 disabled:cursor-not-allowed ${isPrefilled && rowPlanPrice !== '' ? 'bg-success/10 border-success/40 text-success' : rowPlanPrice !== '' && !isPrefilled ? 'bg-warning/10 border-warning/40 text-warning-strong' : 'border-base-content/15'}`} />
                                    </td>
                                    <td className="px-3 py-1.5 border-x border-base-300">
                                        <input type="number" min="0" value={rowConfirmedQty} disabled={isReadOnly} onChange={(e) => handleEdit(prod.product_id, 'confirmedQty', e.target.value)} placeholder="0" className="w-full border-base-content/15 rounded text-center text-xs h-7 focus:ring-success font-bold transition-colors disabled:bg-base-150 disabled:text-base-content/60 disabled:cursor-not-allowed" />
                                    </td>
                                    <td className="px-4 py-2 text-right font-black text-base-content/80">{totalVal > 0 ? totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                    <td className={`px-4 py-2 text-right font-black border-l border-base-200 ${gpVal > 0 ? 'text-secondary' : gpVal < 0 ? 'text-error' : 'text-base-content/60'}`}>{gpVal !== 0 ? gpVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                </tr>
                            );
                        })}
                        {paginatedData.length === 0 && <tr><td colSpan={13} className="px-4 py-12 text-center text-base-content/60 italic">No products found matching your filter.</td></tr>}
                    </tbody>
                    {filteredGridProducts.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] bg-base-150 font-bold text-xs text-base-content/80">
                            <tr>
                                <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider">Total (All Pages)</td>
                                <td className="px-3 py-3 text-center text-accent border-l border-base-300">{gridTotals.totalFcastQty}</td>
                                <td className="px-3 py-3 text-right text-base-content border-l border-base-300">{gridTotals.totalPlanPrice > 0 ? gridTotals.totalPlanPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                <td className="px-3 py-3 text-right text-base-content border-x border-base-300">{gridTotals.totalPlanPrice > 0 ? (gridTotals.totalPlanPrice / USD_TO_AED_RATE).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                <td className="px-3 py-3 text-center text-success border-r border-base-300">{gridTotals.totalConfQty}</td>
                                <td className="px-4 py-3 text-right text-base-content">{gridTotals.totalAed > 0 ? gridTotals.totalAed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                <td className="px-4 py-3 text-right text-secondary border-l border-base-300">{gridTotals.totalGp !== 0 ? gridTotals.totalGp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            )}
          </div>
          
          {selectedLob && !isLoadingData && (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredGridProducts.length} itemsPerPage={100} onPrev={goToPrevPage} onNext={goToNextPage} />
          )}
      </div>

      {/* Recent Entry Table */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden flex flex-col shrink-0" style={{ minHeight: '400px', maxHeight: '60vh' }}>
        <div className="p-5 border-b border-base-300 bg-base-200/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
              <h3 className="text-sm font-bold text-base-content uppercase tracking-wider">Your Recent Entries</h3>
              <div className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-lg px-2 py-1 shadow-sm">
                  <span className="text-[11px] font-bold text-base-content/60 uppercase">View Month:</span>
                  <MonthPicker value={recentMonthFilter} onChange={setRecentMonthFilter} className="text-xs font-black text-accent h-6 px-1 cursor-pointer" />
              </div>
          </div>
          <button onClick={exportEntriesToCSV} disabled={filteredEntries.length === 0} className="flex items-center gap-2 text-xs font-bold bg-base-100 border border-base-content/15 text-base-content/80 px-3 py-1.5 rounded hover:bg-base-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Download size={14} /> Export CSV</button>
        </div>
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-base-200 text-base-content/60 font-bold border-b border-base-300 text-[11px] uppercase sticky top-0 shadow-sm z-20">
              <tr>
                <th className="px-6 py-4 bg-base-100">Month</th>
                <th className="px-6 py-4 bg-base-100">BP Code</th>
                <th className="px-6 py-4 bg-base-100">Product Line</th>
                <th className="px-6 py-4 bg-base-100">Product Model</th>
                <th className="px-6 py-4 text-center bg-base-100">Plan Qty</th>
                <th className="px-6 py-4 text-center bg-base-100 text-success">Confirm Qty</th>
                <th className="px-6 py-4 text-right bg-base-100">Net Sales (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200 text-xs">
                {filteredEntries.map((entry: any) => (
                <tr key={entry.user_planning_id} className="hover:bg-base-200 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{entry.planning_month}</td>
                  <td className="px-6 py-4 font-medium">{dbLobs.find((l:any) => l.lob_id === entry.lob_id)?.sold_to_bp}</td>
                  <td className="px-6 py-4 text-base-content/70">{dbProducts.find((p:any) => p.product_id === entry.product_id)?.product_line || '-'}</td>
                  <td className="px-6 py-4 text-base-content/70">{dbProducts.find((p:any) => p.product_id === entry.product_id)?.product_model}</td>
                  <td className="px-6 py-4 text-center font-bold">{entry.planned_quantity}</td>
                  <td className="px-6 py-4 text-center font-bold text-success">{entry.confirmed_quantity != null ? entry.confirmed_quantity : 0}</td>
                  <td className="px-6 py-4 text-right font-black text-accent">{Number(entry.total_amount).toFixed(2)}</td>
                </tr>
              ))}
              {filteredEntries.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-base-content/60 italic font-medium">No entries found for {recentMonthFilter}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Model to Forecast picker */}
      {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center bg-neutral/40 backdrop-blur-sm p-4 pt-28" onMouseDown={() => setShowAddModal(false)}>
              <div className="bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between px-5 py-4 border-b border-base-300">
                      <div>
                          <h3 className="text-sm font-bold text-base-content">Add Model to Forecast</h3>
                          <p className="text-xs text-base-content/60 mt-0.5 max-w-sm">Only models with a valid price are listed. Added rows appear at the top of the grid — enter a forecast and <span className="font-semibold">Save</span> to keep them.</p>
                      </div>
                      <button type="button" onClick={() => setShowAddModal(false)} className="text-base-content/45 hover:text-base-content/70 shrink-0"><X size={18} /></button>
                  </div>
                  <div className="p-5 space-y-3 min-h-[120px]">
                      {isLoadingAddable ? (
                          <div className="flex items-center gap-2 text-sm text-base-content/60 py-8 justify-center"><Loader2 size={18} className="animate-spin text-primary" /> Loading models…</div>
                      ) : (
                          <>
                              <Select
                                  autoFocus
                                  options={addableOptions}
                                  menuPortalTarget={document.body}
                                  styles={customSelectStyles}
                                  placeholder={`Search ${addableOptions.length} models…`}
                                  value={null}
                                  onChange={(opt: any) => { if (opt) addModel(opt.product); }}
                                  noOptionsMessage={() => 'No more priced models to add for this BP'}
                              />
                              {addedProducts.length > 0 && (
                                  <div className="rounded-lg bg-info/10 border border-info/20 px-3 py-2 text-xs text-info">
                                      <span className="font-bold">{addedProducts.length}</span> model{addedProducts.length > 1 ? 's' : ''} added to the grid. Fill in the forecast and click <span className="font-bold">Save</span> — unsaved additions are cleared on refresh.
                                  </div>
                              )}
                          </>
                      )}
                  </div>
                  <div className="px-5 py-3 border-t border-base-300 flex justify-end">
                      <button type="button" onClick={() => setShowAddModal(false)} className="px-4 h-[34px] rounded-lg bg-primary text-primary-content text-sm font-bold hover:bg-primary-hover transition-colors">Done</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}