import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SearchableOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SearchableOption[];
    /** When set, an "All" entry is rendered at the top with this label (value = "All"). */
    allLabel?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    align?: 'left' | 'right';
    /** Approx. number of rows visible before the list scrolls. Default 10. */
    maxVisible?: number;
    /** Message shown when there are no options to choose from (context-specific). */
    emptyLabel?: string;
}

/**
 * Searchable single-select dropdown (combobox).
 * Shows a scrollable list (about maxVisible rows tall) plus a search box to
 * narrow it. Long labels wrap so no name is truncated. Display-only; the
 * database is never modified by this control.
 */
export default function SearchableSelect({
    value,
    onChange,
    options,
    allLabel,
    placeholder = 'Select',
    disabled = false,
    className = '',
    align = 'left',
    maxVisible = 10,
    emptyLabel,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const allOptions = useMemo<SearchableOption[]>(
        () => (allLabel ? [{ value: 'All', label: allLabel }, ...options] : options),
        [allLabel, options]
    );

    const selectedLabel = useMemo(() => {
        if (allLabel && (value === 'All' || !value)) return allLabel;
        return options.find(o => o.value === value)?.label ?? (value || placeholder);
    }, [options, value, allLabel, placeholder]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allOptions;
        return allOptions.filter(o => o.label.toLowerCase().includes(q));
    }, [allOptions, query]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    useEffect(() => {
        if (open) {
            const id = window.setTimeout(() => inputRef.current?.focus(), 0);
            return () => window.clearTimeout(id);
        }
    }, [open]);

    const select = (v: string) => {
        onChange(v);
        setOpen(false);
        setQuery('');
    };

    const isPlaceholder = !value || (!!allLabel && value === 'All');
    const listMaxHeight = maxVisible * 36; // ~10 single-line rows; scrolls beyond that

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-1 text-xs border border-base-300 rounded py-1.5 px-2.5 bg-base-100 text-left focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed hover:border-base-content/15 transition-colors"
            >
                <span className={`truncate ${isPlaceholder ? 'text-base-content/45' : 'text-base-content/80'}`}>
                    {selectedLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-base-content/45 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && options.length === 0 && (
                <div
                    className={`absolute z-50 mt-1 w-[300px] max-w-[calc(100vw-2rem)] bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    <div className="px-3 py-4 text-xs text-base-content/60 text-center leading-relaxed">
                        {emptyLabel || 'No options available'}
                    </div>
                    {allLabel && (
                        <ul role="listbox" className="py-1 border-t border-base-200">
                            <li role="option" aria-selected={value === 'All' || !value}>
                                <button
                                    type="button"
                                    onClick={() => select('All')}
                                    className={`w-full flex items-center gap-2 text-left text-xs px-3 py-2 transition-colors ${(value === 'All' || !value) ? 'bg-primary/10 text-primary-strong font-semibold' : 'text-base-content/80 hover:bg-base-200'}`}
                                >
                                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${(value === 'All' || !value) ? 'text-primary-strong' : 'text-transparent'}`} />
                                    <span>{allLabel}</span>
                                </button>
                            </li>
                        </ul>
                    )}
                </div>
            )}

            {open && options.length > 0 && (
                <div
                    className={`absolute z-50 mt-1 w-[300px] max-w-[calc(100vw-2rem)] bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    <div className="p-2 border-b border-base-200">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-base-content/45 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                                    if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(filtered[0].value); }
                                }}
                                placeholder={`Search ${options.length} options...`}
                                className="w-full text-xs border border-base-300 rounded pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-base-content/80"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/45 hover:text-base-content/70"
                                    aria-label="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <ul role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: listMaxHeight }}>
                        {filtered.length === 0 && (
                            <li className="px-3 py-3 text-xs text-base-content/45 italic text-center">No matches for “{query}”</li>
                        )}
                        {filtered.map(opt => {
                            const active = opt.value === value;
                            return (
                                <li key={opt.value} role="option" aria-selected={active}>
                                    <button
                                        type="button"
                                        onClick={() => select(opt.value)}
                                        title={opt.label}
                                        className={`w-full flex items-start gap-2 text-left text-xs px-3 py-2 transition-colors ${active ? 'bg-primary/10 text-primary-strong font-semibold' : 'text-base-content/80 hover:bg-base-200'}`}
                                    >
                                        <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${active ? 'text-primary-strong' : 'text-transparent'}`} />
                                        <span className="break-words leading-snug">{opt.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {allOptions.length > maxVisible && (
                        <div className="px-3 py-1.5 border-t border-base-200 text-[10px] text-base-content/45 bg-base-200">
                            {filtered.length} of {allOptions.length} — scroll or type to search
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
