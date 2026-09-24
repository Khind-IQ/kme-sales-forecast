import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

/**
 * Cross-browser month picker.
 *
 * Replaces the native <input type="month">, which desktop Safari (macOS) does
 * NOT support — Safari silently falls back to a plain text box with no calendar
 * popup. This component renders an identical popover month grid in every browser.
 *
 * Value contract matches the old inputs exactly: a "YYYY-MM" string (or "").
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthPickerProps {
    /** Current value as "YYYY-MM" (or empty string for none). */
    value: string;
    /** Called with the new "YYYY-MM" string when a month is chosen. */
    onChange: (value: string) => void;
    /** Optional lower bound, inclusive, as "YYYY-MM". Months before this are disabled. */
    min?: string;
    /** Optional upper bound, inclusive, as "YYYY-MM". Months after this are disabled. */
    max?: string;
    /** Disable the whole control. */
    disabled?: boolean;
    /** Classes applied to the trigger button so callers can match existing styling. */
    className?: string;
    /** Text shown when value is empty. */
    placeholder?: string;
    /** Which edge the popover aligns to. */
    align?: 'left' | 'right';
    /**
     * Optional "YYYY-MM" threshold. Months BEFORE this are still selectable but
     * marked as view-only (amber + lock) so users can see at a glance which
     * months can no longer be edited. A legend is shown when this is set.
     */
    editableFrom?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const formatDisplay = (value: string, placeholder: string) => {
    if (!value) return placeholder;
    const [y, m] = value.split('-');
    const monthIdx = Number(m) - 1;
    if (!y || monthIdx < 0 || monthIdx > 11) return placeholder;
    return `${MONTHS_SHORT[monthIdx]} ${y}`;
};

export default function MonthPicker({
    value,
    onChange,
    min,
    max,
    disabled = false,
    className = '',
    placeholder = 'Select month',
    align = 'left',
    editableFrom,
}: MonthPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState<number>(() => {
        const fromValue = value ? Number(value.split('-')[0]) : NaN;
        return Number.isFinite(fromValue) ? fromValue : new Date().getFullYear();
    });
    const containerRef = useRef<HTMLDivElement>(null);

    // Re-sync the visible year to the selected value whenever the popover opens.
    useEffect(() => {
        if (isOpen && value) {
            const y = Number(value.split('-')[0]);
            if (Number.isFinite(y)) setViewYear(y);
        }
    }, [isOpen, value]);

    // Close on outside click.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isMonthDisabled = (candidate: string) => {
        if (min && candidate < min) return true;
        if (max && candidate > max) return true;
        return false;
    };

    const selectMonth = (monthIdx: number) => {
        const candidate = `${viewYear}-${pad(monthIdx + 1)}`;
        if (isMonthDisabled(candidate)) return;
        onChange(candidate);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen((o) => !o)}
                className={`inline-flex items-center justify-between gap-1.5 ${className}`}
            >
                <span className={value ? '' : 'opacity-60'}>{formatDisplay(value, placeholder)}</span>
                <ChevronDown size={14} className="shrink-0 opacity-70" />
            </button>

            {isOpen && !disabled && (
                <div
                    className={`absolute z-50 mt-2 w-56 bg-base-100 border border-base-300 shadow-xl rounded-lg p-3 animate-in slide-in-from-top-2 ${
                        align === 'right' ? 'right-0' : 'left-0'
                    }`}
                >
                    {/* Year navigation */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-base-200">
                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y - 1)}
                            className="p-1 rounded hover:bg-base-150 text-base-content/60"
                            aria-label="Previous year"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-black text-base-content/80">{viewYear}</span>
                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y + 1)}
                            className="p-1 rounded hover:bg-base-150 text-base-content/60"
                            aria-label="Next year"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Month grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {MONTHS_SHORT.map((label, idx) => {
                            const candidate = `${viewYear}-${pad(idx + 1)}`;
                            const isSelected = candidate === value;
                            const monthDisabled = isMonthDisabled(candidate);
                            const isViewOnly = !!editableFrom && !monthDisabled && candidate < editableFrom;

                            let stateClasses: string;
                            if (isSelected) {
                                stateClasses = isViewOnly ? 'bg-secondary text-secondary-content' : 'bg-primary text-primary-content';
                            } else if (monthDisabled) {
                                stateClasses = 'text-base-content/30 cursor-not-allowed';
                            } else if (isViewOnly) {
                                stateClasses = 'bg-warning/10 text-warning-strong hover:bg-warning/20';
                            } else {
                                stateClasses = 'text-base-content/70 hover:bg-primary/10 hover:text-primary-strong';
                            }

                            return (
                                <button
                                    key={label}
                                    type="button"
                                    disabled={monthDisabled}
                                    onClick={() => selectMonth(idx)}
                                    title={isViewOnly ? 'View only — this month can no longer be edited' : undefined}
                                    className={`text-xs font-bold rounded-md py-1.5 transition-colors inline-flex items-center justify-center gap-1 ${stateClasses}`}
                                >
                                    {label}
                                    {isViewOnly && <Lock size={9} className="shrink-0 opacity-80" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend (only when an editable threshold is provided) */}
                    {editableFrom && (
                        <div className="mt-3 pt-2 border-t border-base-200 flex items-center justify-between text-[10px] font-semibold text-base-content/60">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-primary shrink-0" /> Editable
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Lock size={10} className="text-warning-strong shrink-0" /> View only
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
