import React, { useState, useEffect } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { Database, LogOut, Search, Menu, FileEdit, PieChart, Building2, Layers, Loader2 } from 'lucide-react';
import SalesDataEntry from './Components/SalesDataEntry';
import SummaryByItem from './Components/SummaryByItem';
import SummaryByBP from './Components/SummaryByBP'; 
import SummaryByLOB from './Components/SummaryByLOB'; 
import FullDashboard from './Components/FullDashboard';
import ActualSales from './Components/ActualSales';

const NavButton = ({ id, label, icon: Icon, activeTab, isSidebarOpen, onClick }: any) => (
  <button 
    onClick={() => onClick(id)} 
    title={!isSidebarOpen ? label : ""} 
    className={`w-full flex items-center ${isSidebarOpen ? 'px-4 justify-start gap-3' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all duration-200 ${activeTab === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
  >
      <Icon size={20} className="shrink-0" />
      {isSidebarOpen && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
  </button>
);

export default function Forecast({ dbLobs, dbProductsLob, dbProductsMonth, dbPricingLob, dbPricingMonth, dbEntriesLob, dbEntriesMonth, dbBudgets, dbActualSales }: any) {
  const user = usePage().props.auth.user as any; 

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('data-entry'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());


  const handleTabChange = (id: string) => {
      setActiveTab(id);
      setSearchTerm('');
      setMobileNavOpen(false); // close the off-canvas nav after picking a tab on mobile
  };

  // On desktop the hamburger collapses the rail; on mobile it opens the off-canvas overlay.
  const toggleNav = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileNavOpen((o) => !o);
      } else {
          setIsSidebarOpen((o) => !o);
      }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden animate-in fade-in duration-300">
      <Head title="Sales Forecast" />
      
      {/* Backdrop for the mobile off-canvas nav */}
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}

      <aside className={`bg-slate-900 text-white flex flex-col shadow-xl transition-transform duration-300 ease-in-out shrink-0 fixed inset-y-0 left-0 z-40 w-64 transform ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:z-20 lg:translate-x-0 lg:transition-all ${isSidebarOpen ? 'lg:w-64' : 'lg:w-20'}`}>
        <div className={`p-6 border-b border-slate-800 flex items-center h-20 transition-all ${isSidebarOpen ? 'gap-3 justify-start' : 'px-0 justify-center'}`}>
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-lg shrink-0 hover:bg-blue-500 transition-colors">K</div>
            {isSidebarOpen && (
                <div className="whitespace-nowrap overflow-hidden">
                    <h1 className="font-bold text-lg tracking-tight">KME RSP</h1>
                    <p className="text-xs text-slate-400">Forecast system</p>
                </div>
            )}
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {isSidebarOpen ? <div className="px-4 pb-2 pt-2 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-80 whitespace-nowrap">Data Management</div> : <div className="w-8 mx-auto border-t border-slate-700 my-4"></div>}
          
          <NavButton id="data-entry" label="Sales Forecast" icon={FileEdit} activeTab={activeTab} isSidebarOpen={isSidebarOpen} onClick={handleTabChange} />
          <NavButton id="summary-item" label="Summary by Item" icon={Database} activeTab={activeTab} isSidebarOpen={isSidebarOpen} onClick={handleTabChange} />
          <NavButton id="summary-bp" label="Summary by BP" icon={Building2} activeTab={activeTab} isSidebarOpen={isSidebarOpen} onClick={handleTabChange} />
          
          {/* ADDED NEW LOB TAB HERE */}
          <NavButton id="summary-lob" label="Summary by LOB" icon={Layers} activeTab={activeTab} isSidebarOpen={isSidebarOpen} onClick={handleTabChange} />
          
          {isSidebarOpen ? <div className="px-4 pb-2 pt-6 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-80 whitespace-nowrap">Analytics & Reports</div> : <div className="w-8 mx-auto border-t border-slate-700 my-4"></div>}
          
          <NavButton id="dashboard" label="Full Dashboard" icon={PieChart} activeTab={activeTab} isSidebarOpen={isSidebarOpen} onClick={handleTabChange} />
        </nav>

        <div className={`p-4 border-t border-slate-800 flex items-center ${isSidebarOpen ? 'gap-3' : 'flex-col gap-3 justify-center'}`}>
          <div className="w-10 h-10 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold uppercase">{user.full_name?.charAt(0) || 'U'}</div>
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-white truncate">
                  {user.full_name} 
                  {user.role_id === 2 && <span className="text-emerald-400 text-xs ml-1 font-bold">(Admin)</span>}
              </div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          )}
          <Link href={route('logout')} method="post" as="button" className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"><LogOut size={20} /></Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={toggleNav} aria-label="Toggle navigation" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Menu size={20} /></button>
            <h2 className="text-xl font-bold text-gray-800 capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'actual-sales' && (
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-bold focus:ring-blue-500">
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                </select>
            )}
            {/* Added summary-lob to the search bar condition */}
            {(activeTab === 'summary-item' || activeTab === 'summary-bp' || activeTab === 'summary-lob') && (
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-64 bg-slate-50" />
                </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
            {/* Data entry stays mounted so unsaved edits survive tab switches */}
            <div className={activeTab === 'data-entry' ? 'block h-full' : 'hidden'}>
              <SalesDataEntry dbLobs={dbLobs} dbProducts={dbProductsLob || []} dbPricing={dbPricingLob || []} dbEntries={dbEntriesLob || []} />
            </div>

            {/* Read-only tabs mount only when active so their aggregations don't run in the background */}
            {activeTab === 'summary-item' && (
              <div className="h-full">
                <SummaryByItem isActive dbLobs={dbLobs} dbProducts={dbProductsMonth || []} dbPricing={dbPricingMonth || []} dbEntries={dbEntriesMonth || []} searchTerm={searchTerm} user={user} />
              </div>
            )}
            {activeTab === 'summary-bp' && (
              <div className="h-full">
                <SummaryByBP isActive dbLobs={dbLobs} dbProducts={dbProductsMonth || []} dbPricing={dbPricingMonth || []} dbEntries={dbEntriesMonth || []} searchTerm={searchTerm} user={user} />
              </div>
            )}
            {activeTab === 'summary-lob' && (
              <div className="h-full">
                <SummaryByLOB isActive dbLobs={dbLobs} dbProducts={dbProductsMonth || []} dbPricing={dbPricingMonth || []} dbEntries={dbEntriesMonth || []} searchTerm={searchTerm} user={user} />
              </div>
            )}
            {activeTab === 'dashboard' && (
              <div className="h-full">
                <FullDashboard isActive dbLobs={dbLobs} dbProducts={dbProductsMonth || []} dbEntries={dbEntriesMonth || []} dbActualSales={dbActualSales || []} dbPricing={dbPricingMonth || []} user={user} />
              </div>
            )}
        </div>
      </main>
    </div>
  );
}