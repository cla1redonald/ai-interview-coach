'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

type Quality = 'strong' | 'weak' | 'neutral' | 'unrated' | null;

export interface FilterState {
  query: string;
  tagIds: string[];
  company: string;
  quality: Quality;
  dateRange: 'all' | '30d' | '90d' | 'year';
  bestOf: boolean;
}

interface TagOption {
  id: string;
  name: string;
  isSystem: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  tags: TagOption[];
  companies: string[];
  total: number;
  loading?: boolean;
}

const DATE_OPTIONS: { value: FilterState['dateRange']; label: string }[] = [
  { value: 'all',  label: 'All time' },
  { value: '30d',  label: 'Last 30 days' },
  { value: '90d',  label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

const QUALITY_OPTIONS: { value: NonNullable<Quality>; label: string }[] = [
  { value: 'strong',  label: 'Strong' },
  { value: 'weak',    label: 'Weak' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'unrated', label: 'Unrated' },
];

export function FilterBar({ filters, onChange, tags, companies, total, loading }: FilterBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const isActive =
    filters.query !== '' ||
    filters.tagIds.length > 0 ||
    filters.company !== '' ||
    filters.quality !== null ||
    filters.dateRange !== 'all' ||
    filters.bestOf;

  const set = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const handleQueryChange = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      set('query', value);
    }, 300);
  }, [set]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const clearAll = () => {
    if (queryInputRef.current) queryInputRef.current.value = '';
    onChange({
      query: '',
      tagIds: [],
      company: '',
      quality: null,
      dateRange: 'all',
      bestOf: false,
    });
  };

  const toggleTag = (id: string) => {
    const next = filters.tagIds.includes(id)
      ? filters.tagIds.filter(t => t !== id)
      : [...filters.tagIds, id];
    set('tagIds', next);
  };

  return (
    <div className="space-y-3">
      {/* Best of toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => set('bestOf', false)}
          className="px-3 py-1 rounded-md text-xs font-medium transition-all"
          style={{
            background: !filters.bestOf ? 'var(--amber-glow)' : 'var(--card-raised)',
            border: `1px solid ${!filters.bestOf ? 'var(--amber)' : 'var(--border)'}`,
            color: !filters.bestOf ? 'var(--amber)' : 'var(--sage)',
          }}
          aria-pressed={!filters.bestOf}
        >
          All examples
        </button>
        <button
          type="button"
          onClick={() => set('bestOf', true)}
          className="px-3 py-1 rounded-md text-xs font-medium transition-all"
          style={{
            background: filters.bestOf ? 'var(--amber-glow)' : 'var(--card-raised)',
            border: `1px solid ${filters.bestOf ? 'var(--amber)' : 'var(--border)'}`,
            color: filters.bestOf ? 'var(--amber)' : 'var(--sage)',
          }}
          aria-pressed={filters.bestOf}
        >
          Best of
        </button>
      </div>

      {/* Filter row */}
      <form role="search" className="flex flex-wrap gap-2 items-center" onSubmit={e => e.preventDefault()}>
        {/* Keyword search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--sage)' }}
            aria-hidden="true"
          />
          <input
            ref={queryInputRef}
            type="search"
            defaultValue={filters.query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search examples..."
            aria-label="Search examples by keyword"
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm transition-all"
            style={{
              background: 'var(--card-raised)',
              border: '1px solid var(--border)',
              color: 'var(--mist)',
              outline: 'none',
              caretColor: 'var(--amber)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--amber)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* Company filter */}
        {companies.length > 0 && (
          <select
            value={filters.company}
            onChange={e => set('company', e.target.value)}
            aria-label="Filter by company"
            className="px-3 py-1.5 rounded-md text-sm transition-all"
            style={{
              background: filters.company ? 'var(--amber-faint)' : 'var(--card-raised)',
              border: `1px solid ${filters.company ? 'var(--amber)' : 'var(--border)'}`,
              color: filters.company ? 'var(--amber)' : 'var(--mist)',
              outline: 'none',
            }}
          >
            <option value="">Company</option>
            {companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Quality filter */}
        <select
          value={filters.quality ?? ''}
          onChange={e => set('quality', (e.target.value || null) as Quality)}
          aria-label="Filter by quality"
          className="px-3 py-1.5 rounded-md text-sm transition-all"
          style={{
            background: filters.quality ? 'var(--amber-faint)' : 'var(--card-raised)',
            border: `1px solid ${filters.quality ? 'var(--amber)' : 'var(--border)'}`,
            color: filters.quality ? 'var(--amber)' : 'var(--mist)',
            outline: 'none',
          }}
        >
          <option value="">Quality</option>
          {QUALITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Date range */}
        <select
          value={filters.dateRange}
          onChange={e => set('dateRange', e.target.value as FilterState['dateRange'])}
          aria-label="Filter by date range"
          className="px-3 py-1.5 rounded-md text-sm transition-all"
          style={{
            background: filters.dateRange !== 'all' ? 'var(--amber-faint)' : 'var(--card-raised)',
            border: `1px solid ${filters.dateRange !== 'all' ? 'var(--amber)' : 'var(--border)'}`,
            color: filters.dateRange !== 'all' ? 'var(--amber)' : 'var(--mist)',
            outline: 'none',
          }}
        >
          {DATE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear all */}
        {isActive && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors"
            style={{ color: 'var(--copper)' }}
            aria-label="Clear all filters"
          >
            <X size={12} strokeWidth={2} />
            Clear all
          </button>
        )}
      </form>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {tags.map(t => {
            const isSelected = filters.tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={isSelected}
                className="px-2.5 py-1 rounded-full text-xs transition-all"
                style={{
                  background: isSelected ? 'var(--amber-faint)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                  color: isSelected ? 'var(--amber)' : 'var(--sage)',
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Result count */}
      <p className="text-xs" style={{ color: 'var(--sage)' }} aria-live="polite" aria-atomic="true">
        {loading ? 'Loading...' : `${total} ${total === 1 ? 'example' : 'examples'}`}
      </p>
    </div>
  );
}
