'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';

interface TagOption {
  id: string;
  name: string;
  isSystem: boolean;
}

interface TagPickerProps {
  selected: string[];          // tag IDs currently applied
  options: TagOption[];        // all available tags
  onChange: (ids: string[]) => void;
  onCreateTag?: (name: string) => Promise<TagOption | null>;
  disabled?: boolean;
}

export function TagPicker({ selected, options, onChange, onCreateTag, disabled }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = options.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  const selectedOptions = options.filter(t => selected.includes(t.id));

  const toggle = useCallback((id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }, [selected, onChange]);

  const handleCreate = async () => {
    if (!onCreateTag || !query.trim()) return;
    setCreating(true);
    try {
      const newTag = await onCreateTag(query.trim());
      if (newTag) {
        onChange([...selected, newTag.id]);
        setQuery('');
      }
    } finally {
      setCreating(false);
    }
  };

  const showCreate = onCreateTag && query.trim() && !options.some(
    t => t.name.toLowerCase() === query.toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags display + open trigger */}
      <div
        className="flex flex-wrap gap-1 min-h-[36px] items-center px-2 py-1 rounded-md cursor-pointer transition-all"
        style={{
          background: 'var(--card-raised)',
          border: `1px solid ${open ? 'var(--amber)' : 'var(--border)'}`,
          outline: open ? '1px solid var(--amber)' : 'none',
          outlineOffset: '1px',
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
        onClick={() => !disabled && setOpen(o => !o)}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="tag-picker-listbox"
        aria-label="Tag picker"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--sage)' }}>
            <Tag size={12} strokeWidth={1.5} />
            Add tags
          </span>
        ) : (
          selectedOptions.map(t => (
            <span
              key={t.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: 'var(--tay)',
                border: '1px solid var(--border)',
                color: 'var(--sage)',
              }}
            >
              {t.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                aria-label={`Remove ${t.name}`}
                className="ml-0.5"
                style={{ color: 'var(--sage)' }}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-md overflow-hidden"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            maxHeight: '240px',
            display: 'flex',
            flexDirection: 'column',
          }}
          id="tag-picker-listbox"
          role="listbox"
          aria-label="Available tags"
        >
          {/* Search input */}
          <div
            className="px-2 py-1.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && showCreate) handleCreate();
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              }}
              placeholder="Search or create tag..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--mist)', caretColor: 'var(--amber)' }}
              aria-label="Search tags"
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--sage)' }}>
                No tags found
              </p>
            )}
            {filtered.map(t => {
              const isSelected = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  role="option"
                  aria-selected={isSelected}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                  style={{
                    color: isSelected ? 'var(--amber)' : 'var(--mist)',
                    background: isSelected ? 'var(--amber-faint)' : 'transparent',
                  }}
                >
                  <Check
                    size={12}
                    strokeWidth={2}
                    style={{ opacity: isSelected ? 1 : 0, color: 'var(--amber)', flexShrink: 0 }}
                  />
                  <span className="truncate">{t.name}</span>
                  {t.isSystem && (
                    <span className="ml-auto text-xs" style={{ color: 'var(--sage)' }}>system</span>
                  )}
                </button>
              );
            })}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-50"
                style={{ color: 'var(--copper)' }}
              >
                <Plus size={12} strokeWidth={2} />
                {creating ? 'Creating...' : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
