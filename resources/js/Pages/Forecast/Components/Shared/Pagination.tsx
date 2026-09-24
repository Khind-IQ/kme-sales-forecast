import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPrev: () => void;
    onNext: () => void;
}

export default function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPrev, onNext }: PaginationProps) {
    if (totalPages <= 1) return null;

    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-500 font-medium">
                Showing {startItem} to {endItem} of {totalItems} items
            </span>
            <div className="flex items-center gap-2">
                <button onClick={onPrev} disabled={currentPage === 1} className="p-1.5 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-slate-700 px-2">
                    Page {currentPage} of {totalPages}
                </span>
                <button onClick={onNext} disabled={currentPage === totalPages} className="p-1.5 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}