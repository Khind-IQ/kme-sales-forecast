import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calendar month-range picker: one control to pick a start and end month.
 * First click sets the start, second click (on/after start) sets the end.
 * Values are "YYYY-MM" strings, matching the rest of the app.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (v: string) => {
    if (!v) return '';
    const [y, m] = v.split('-');
    const idx = Number(m) - 1;
    return idx >= 0 && idx < 12 ? `${MONTHS_SHORT[idx]} ${y}` : '';
};

interface MonthRangePickerProps {
    value: { start: string; end: string };
    onChange: (v: { start: string; end: string }) => void;
    disabled?: boolean;
    className?: string;
    align?: 'left' | 'right';
    placeholder?: string;
}

export default function MonthRangePicker({
    value,
    onChange,
    disabled = false,
    className = '',
    align = 'left',
    placeholder = 'Select range',
}: MonthRangePickerProps) {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState<number>(() => (value.start ? Number(value.start.split('-')[0]) : new Date().getFullYear()));
    const [pendingStart, setPendingStart] = useState<string | null>(null); // set while choosing the end
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && value.start) setViewYear(Number(value.start.split('-')[0]));
    }, [open, value.start]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setPendingStart(null);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const selectMonth = (idx: number) => {
        const cand = `${viewYear}-${pad(idx + 1)}`;
        if (pendingStart === null) {
            setPendingStart(cand); // begin a new range
        } else if (cand < pendingStart) {
            setPendingStart(cand); // clicked before the start -> restart from here
        } else {
            onChange({ start: pendingStart, end: cand });
            setPendingStart(null);
            setOpen(false);
        }
    };

    const isStart = (c: string) => c === (pendingStart ?? value.start);
    const isEnd = (c: string) => !pendingStart && c === value.end;
    const isInRange = (c: string) => !pendingStart && value.start && value.end && c > value.start && c < value.end;

    const label = value.start && value.end ? `${fmt(value.start)} – ${fmt(value.end)}` : placeholder;

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((o) => !o)}
                className={`inline-flex items-center justify-between gap-1.5 ${className}`}
            >
                <span className={value.start ? '' : 'opacity-60'}>{label}</span>
                <ChevronDown size={14} className="shrink-0 opacity-70" />
            </button>

            {open && !disabled && (
                <div
                    className={`absolute z-50 mt-2 w-64 bg-base-100 border border-base-300 shadow-xl rounded-lg p-3 ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-base-200">
                        <button type="button" onClick={() => setViewYear((y) => y - 1)} className="p-1 rounded hover:bg-base-150 text-base-content/60" aria-label="Previous year"><ChevronLeft size={16} /></button>
                        <span className="text-sm font-black text-base-content/80">{viewYear}</span>
                        <button type="button" onClick={() => setViewYear((y) => y + 1)} className="p-1 rounded hover:bg-base-150 text-base-content/60" aria-label="Next year"><ChevronRight size={16} /></button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                        {MONTHS_SHORT.map((lab, idx) => {
                            const cand = `${viewYear}-${pad(idx + 1)}`;
                            const start = isStart(cand);
                            const end = isEnd(cand);
                            const inRange = isInRange(cand);
                            const cls = start || end
                                ? 'bg-primary text-primary-content'
                                : inRange
                                ? 'bg-primary/10 text-primary-strong'
                                : 'text-base-content/70 hover:bg-primary/10 hover:text-primary-strong';
                            return (
                                <button key={lab} type="button" onClick={() => selectMonth(idx)} className={`text-xs font-bold rounded-md py-1.5 transition-colors ${cls}`}>
                                    {lab}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-2 pt-2 border-t border-base-200 text-[10px] font-semibold text-base-content/60">
                        {pendingStart ? `Start: ${fmt(pendingStart)} — now pick the end month` : (value.start ? `${fmt(value.start)} – ${fmt(value.end)}` : 'Pick the start month')}
                    </div>
                </div>
            )}
        </div>
    );
}
