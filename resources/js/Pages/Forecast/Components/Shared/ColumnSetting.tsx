import React, { useState, useRef, useEffect } from 'react';
import { Settings2 } from 'lucide-react';

export default function ColumnSettings({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // handles closing the menu when  click outside of it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 text-xs font-bold border px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            >
                <Settings2 size={14} /> Columns
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-lg p-3 z-50 animate-in slide-in-from-top-2 max-h-96 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 pb-2 border-b border-slate-100">Toggle View</div>
                    <div className="flex flex-col gap-2">
                        {/* Your checkboxes will render here */}
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}