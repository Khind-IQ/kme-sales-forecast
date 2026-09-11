import React, { useMemo, useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Save, CheckCircle2 } from 'lucide-react';

const MONTHS = [
    { key: '01', label: 'Jan' }, { key: '02', label: 'Feb' }, { key: '03', label: 'Mar' },
    { key: '04', label: 'Apr' }, { key: '05', label: 'May' }, { key: '06', label: 'Jun' },
    { key: '07', label: 'Jul' }, { key: '08', label: 'Aug' }, { key: '09', label: 'Sep' },
    { key: '10', label: 'Oct' }, { key: '11', label: 'Nov' }, { key: '12', label: 'Dec' }
];

// --- DYNAMIC WEEK CALCULATOR ---
const getWeeksInMonth = (year: string, month: string) => {
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    // Standard 7-day chunking logic. 28 days = 4 weeks. 29+ days = 5 weeks.
    return daysInMonth === 28 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
};

export default function ActualSales({ dbEntries, dbProducts, dbBudgets = [], selectedYear, user }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // State now holds an object per month containing budget and weeks
  const [performanceData, setPerformanceData] = useState<Record<string, Record<string, Record<string, string>>>>({});

  // 1. LOAD EXISTING DB DATA
  const initialDataMap = useMemo(() => {
      const map: Record<string, Record<string, Record<string, string>>> = {};
      if (dbBudgets && dbBudgets.length > 0) {
          dbBudgets.forEach((b: any) => {
              const [y, m] = b.planning_month.split('-');
              if (y === selectedYear) {
                  if (!map[b.product_line]) map[b.product_line] = {};
                  map[b.product_line][m] = {
                      budget: b.budget_aed.toString(),
                      w1: b.w1_aed.toString(),
                      w2: b.w2_aed.toString(),
                      w3: b.w3_aed.toString(),
                      w4: b.w4_aed.toString(),
                      w5: b.w5_aed.toString()
                  };
              }
          });
      }
      return map;
  }, [dbBudgets, selectedYear]);

  useEffect(() => {
      setPerformanceData(initialDataMap);
  }, [initialDataMap]);

  // Handle any input change (Budget or W1-W5)
  const handleInputChange = (category: string, month: string, field: string, value: string) => {
      setPerformanceData(prev => ({
          ...prev,
          [category]: {
              ...(prev[category] || {}),
              [month]: {
                  ...((prev[category] || {})[month] || {}),
                  [field]: value
              }
          }
      }));
  };

  const pendingSavesCount = useMemo(() => {
      let count = 0;
      Object.keys(performanceData).forEach(category => {
          Object.keys(performanceData[category]).forEach(monthKey => {
              const current = performanceData[category][monthKey];
              const original = initialDataMap[category]?.[monthKey] || {};
              
              if (
                  current.budget !== (original.budget || '') ||
                  current.w1 !== (original.w1 || '') ||
                  current.w2 !== (original.w2 || '') ||
                  current.w3 !== (original.w3 || '') ||
                  current.w4 !== (original.w4 || '') ||
                  current.w5 !== (original.w5 || '')
              ) {
                  count++;
              }
          });
      });
      return count;
  }, [performanceData, initialDataMap]);

  const handleSaveData = () => {
      const payload: any[] = [];

      Object.keys(performanceData).forEach(category => {
          Object.keys(performanceData[category]).forEach(monthKey => {
              const current = performanceData[category][monthKey];
              const original = initialDataMap[category]?.[monthKey] || {};

              const isModified = current.budget !== (original.budget || '') ||
                                 current.w1 !== (original.w1 || '') ||
                                 current.w2 !== (original.w2 || '') ||
                                 current.w3 !== (original.w3 || '') ||
                                 current.w4 !== (original.w4 || '') ||
                                 current.w5 !== (original.w5 || '');

              if (isModified) {
                  payload.push({
                      product_line: category,
                      planning_month: `${selectedYear}-${monthKey}`,
                      budget_aed: current.budget === '' || !current.budget ? 0 : Number(current.budget),
                      w1_aed: current.w1 === '' || !current.w1 ? 0 : Number(current.w1),
                      w2_aed: current.w2 === '' || !current.w2 ? 0 : Number(current.w2),
                      w3_aed: current.w3 === '' || !current.w3 ? 0 : Number(current.w3),
                      w4_aed: current.w4 === '' || !current.w4 ? 0 : Number(current.w4),
                      w5_aed: current.w5 === '' || !current.w5 ? 0 : Number(current.w5),
                  });
              }
          });
      });

      if (payload.length === 0) return showNotification('No changes to save.');

      setIsSaving(true);

      router.post(route('forecast.budgets'), { budgets: payload }, {
          preserveScroll: true, 
          preserveState: true,
          only: ['dbBudgets', 'errors'], 
          onSuccess: () => {
              showNotification(`Saved ${payload.length} updates successfully!`);
              setIsSaving(false);
          },
          onError: () => {
              showNotification('Error saving data.');
              setIsSaving(false);
          }
      });
  };

  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  // Heavy DB Math
  const actualSalesData = useMemo(() => {
    const categoriesData: Record<string, any> = {};
    const totals = { 
        forecastAed: {} as Record<string, number>, 
        confirmedAed: {} as Record<string, number>
    };

    MONTHS.forEach(m => {
        totals.forecastAed[m.key] = 0;
        totals.confirmedAed[m.key] = 0;
    });

    dbEntries.forEach((entry: any) => {
        const [year, month] = entry.planning_month.split('-');
        if (year !== selectedYear) return;

        const product = dbProducts.find((p: any) => p.product_id === entry.product_id);
        const category = (product?.product_line || 'UNASSIGNED').toUpperCase();

        if (!categoriesData[category]) categoriesData[category] = {};
        if (!categoriesData[category][month]) categoriesData[category][month] = { forecastAed: 0, confirmedAed: 0 };

        const aedAmount = Number(entry.total_amount || 0);
        categoriesData[category][month].forecastAed += aedAmount;
        totals.forecastAed[month] += aedAmount;

        if (entry.is_confirmed) {
            categoriesData[category][month].confirmedAed += aedAmount;
            totals.confirmedAed[month] += aedAmount;
        }
    });

    return { categoriesData, totals };
  }, [dbEntries, dbProducts, selectedYear]); 

  // Light Input Math
  const dynamicTotals = useMemo(() => {
      const totals: Record<string, Record<string, number>> = {};
      MONTHS.forEach(m => {
          totals[m.key] = { budget: 0, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 };
          Object.keys(performanceData).forEach(cat => {
              const d = performanceData[cat]?.[m.key] || {};
              totals[m.key].budget += Number(d.budget || 0);
              totals[m.key].w1 += Number(d.w1 || 0);
              totals[m.key].w2 += Number(d.w2 || 0);
              totals[m.key].w3 += Number(d.w3 || 0);
              totals[m.key].w4 += Number(d.w4 || 0);
              totals[m.key].w5 += Number(d.w5 || 0);
          });
      });
      return totals;
  }, [performanceData]); 

  return (
    <div className="max-w-8xl mx-auto flex flex-col h-full space-y-4 relative animate-in fade-in duration-300">
        {notification && (
          <div className="fixed top-20 right-8 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-top-4">
            <CheckCircle2 size={20} /> {notification}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0 flex justify-between items-center">
            <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Weekly Category Performance</h3>
                <p className="text-xs text-slate-500">Track dynamic actuals and budgets for {selectedYear}</p>
            </div>
            
            <button 
                onClick={handleSaveData} 
                disabled={isSaving || pendingSavesCount === 0} 
                className="bg-amber-600 text-white h-[36px] px-6 rounded-lg font-bold text-sm hover:bg-amber-700 disabled:bg-slate-300 flex items-center gap-2 transition-all shadow-sm"
            >
                <Save size={16} /> {isSaving ? 'Saving...' : `Save ${pendingSavesCount} Updates`}
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto pb-4 max-h-[800px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs text-center border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="border border-slate-300 bg-[#fce4d6] px-3 py-2 sticky left-0 z-30 min-w-[120px]" rowSpan={2}>Sales person</th>
                            <th className="border border-slate-300 bg-[#fce4d6] px-3 py-2 sticky left-[120px] z-30 min-w-[180px]" rowSpan={2}>Category</th>
                            {MONTHS.map(month => {
                                const weeks = getWeeksInMonth(selectedYear, month.key);
                                // The colSpan is dynamic: # of weeks + Forecast + Confirmed + Budget
                                return <th key={`header-${month.key}`} colSpan={weeks.length + 3} className="border border-slate-300 bg-[#f8cbad] px-2 py-1 text-slate-800 font-bold uppercase tracking-wider">{month.label}</th>;
                            })}
                        </tr>
                        <tr>
                            {MONTHS.map(month => {
                                const weeks = getWeeksInMonth(selectedYear, month.key);
                                return (
                                    <React.Fragment key={`subheader-${month.key}`}>
                                        {/* Dynamically Generate W1, W2, W3... */}
                                        {weeks.map(w => (
                                            <th key={`w${w}-${month.key}`} className="border border-slate-300 bg-[#fce4d6] px-4 py-1 text-slate-700">W{w}</th>
                                        ))}
                                        <th className="border border-slate-300 bg-slate-100 px-4 py-1 text-slate-800 font-bold border-l-2 border-l-slate-400">Current Forecast</th>
                                        <th className="border border-slate-300 bg-emerald-50 px-4 py-1 text-emerald-800 font-bold">Confirmed Sales</th>
                                        <th className="border border-slate-300 bg-amber-50 px-4 py-1 text-amber-800 font-bold border-r-2 border-r-slate-400">Budget (AED)</th>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Object.keys(actualSalesData.categoriesData).length > 0 ? (
                            <>
                                {Object.keys(actualSalesData.categoriesData).sort().map((category, catIndex, arr) => (
                                    <tr key={`actual-${category}`} className="hover:bg-slate-50 transition-colors">
                                        {catIndex === 0 && <td className="border border-slate-300 px-3 py-2 font-bold bg-white sticky left-0 z-10 align-top uppercase shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={arr.length + 2}>{user.full_name}</td>}
                                        <td className="border border-slate-300 px-3 py-2 font-medium text-left bg-white sticky left-[120px] z-10 text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{category}</td>
                                        
                                        {MONTHS.map(month => {
                                            const monthData = actualSalesData.categoriesData[category][month.key];
                                            const weeks = getWeeksInMonth(selectedYear, month.key);
                                            const data = performanceData[category]?.[month.key] || {};
                                            
                                            return (
                                                <React.Fragment key={`${category}-${month.key}`}>
                                                    {/* DYNAMIC WEEK INPUTS */}
                                                    {weeks.map(w => {
                                                        const weekField = `w${w}`;
                                                        const val = data[weekField as keyof typeof data] ?? '';
                                                        const isEdited = val !== (initialDataMap[category]?.[month.key]?.[weekField] || '');
                                                        
                                                        return (
                                                            <td key={`input-w${w}-${month.key}`} className="border border-slate-300 px-1 py-1 bg-white">
                                                                <input 
                                                                    type="number" value={val} onChange={(e) => handleInputChange(category, month.key, weekField, e.target.value)} placeholder="0.00"
                                                                    className={`w-16 text-right text-[11px] h-6 border-slate-200 rounded focus:ring-blue-500 font-bold transition-colors ${isEdited ? 'bg-blue-50 text-blue-900 border-blue-400' : 'text-slate-700'}`}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                    
                                                    <td className="border border-slate-300 bg-slate-50/50 px-2 py-2 font-bold text-slate-600 border-l-2 border-l-slate-400">{monthData?.forecastAed > 0 ? monthData.forecastAed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                    <td className="border border-slate-300 bg-emerald-50/30 px-2 py-2 font-black text-emerald-700">{monthData?.confirmedAed > 0 ? monthData.confirmedAed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                    
                                                    {/* BUDGET INPUT */}
                                                    <td className="border border-slate-300 px-1 py-1 border-r-2 border-r-slate-400 bg-white">
                                                        <input 
                                                            type="number" value={data.budget ?? ''} onChange={(e) => handleInputChange(category, month.key, 'budget', e.target.value)} placeholder="0.00"
                                                            className={`w-20 text-right text-[11px] h-6 border-slate-200 rounded focus:ring-amber-500 font-bold transition-colors ${data.budget !== (initialDataMap[category]?.[month.key]?.budget || '') ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-amber-50/20 text-amber-900'}`}
                                                        />
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                                
                                {/* USD TOTALS */}
                                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                    <td className="border border-slate-300 px-3 py-3 text-left sticky left-[120px] z-10 bg-slate-100 uppercase text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTAL IN USD</td>
                                    {MONTHS.map(month => {
                                        const weeks = getWeeksInMonth(selectedYear, month.key);
                                        return (
                                            <React.Fragment key={`usd-total-${month.key}`}>
                                                {weeks.map(w => {
                                                    const val = dynamicTotals[month.key][`w${w}` as keyof typeof dynamicTotals[string]];
                                                    return <td key={`usd-w${w}`} className="border border-slate-200 px-2 py-2 text-slate-500">{val > 0 ? (val / 3.67).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                                })}
                                                <td className="border border-slate-300 px-2 py-2 border-l-2 border-l-slate-400 text-slate-600">{actualSalesData.totals.forecastAed[month.key] > 0 ? (actualSalesData.totals.forecastAed[month.key] / 3.67).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                <td className="border border-slate-300 px-2 py-2 text-emerald-600">{actualSalesData.totals.confirmedAed[month.key] > 0 ? (actualSalesData.totals.confirmedAed[month.key] / 3.67).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                <td className="border border-slate-300 px-2 py-2 border-r-2 border-r-slate-400 text-amber-600">{dynamicTotals[month.key].budget > 0 ? (dynamicTotals[month.key].budget / 3.67).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>

                                {/* AED TOTALS */}
                                <tr className="bg-slate-100/80 font-bold">
                                    <td className="border border-slate-300 px-3 py-3 text-left sticky left-[120px] z-10 bg-slate-200 uppercase text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTAL IN AED</td>
                                    {MONTHS.map(month => {
                                        const weeks = getWeeksInMonth(selectedYear, month.key);
                                        return (
                                            <React.Fragment key={`aed-total-${month.key}`}>
                                                {weeks.map(w => {
                                                    const val = dynamicTotals[month.key][`w${w}` as keyof typeof dynamicTotals[string]];
                                                    return <td key={`aed-w${w}`} className="border border-slate-200 px-2 py-2 text-slate-700">{val > 0 ? val.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                                })}
                                                <td className="border border-slate-300 px-2 py-2 border-l-2 border-l-slate-400 text-slate-800">{actualSalesData.totals.forecastAed[month.key] > 0 ? actualSalesData.totals.forecastAed[month.key].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                <td className="border border-slate-300 px-2 py-2 text-emerald-700">{actualSalesData.totals.confirmedAed[month.key] > 0 ? actualSalesData.totals.confirmedAed[month.key].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                                <td className="border border-slate-300 px-2 py-2 border-r-2 border-r-slate-400 text-amber-700">{dynamicTotals[month.key].budget > 0 ? dynamicTotals[month.key].budget.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            </>
                        ) : (
                            <tr><td colSpan={86} className="p-10 text-center text-slate-500 italic">No forecast data found for {selectedYear}.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}