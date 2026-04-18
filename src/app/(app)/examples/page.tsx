'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { BookMarked, Upload } from 'lucide-react';
import { FilterBar, type FilterState } from '@/components/storybank/FilterBar';
import { ExampleCard, type ExampleData } from '@/components/storybank/ExampleCard';

interface Tag {
  id: string;
  name: string;
  isSystem: boolean;
  userId?: string | null;
}

const DEFAULT_FILTERS: FilterState = {
  query: '',
  tagIds: [],
  company: '',
  quality: null,
  dateRange: 'all',
  bestOf: false,
};

function getDateCutoff(range: FilterState['dateRange']): string | null {
  const now = new Date();
  if (range === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === '90d') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === 'year') {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }
  return null;
}

function buildApiUrl(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.company) params.set('company', filters.company);
  if (filters.bestOf) {
    params.set('quality', 'strong');
  } else if (filters.quality) {
    params.set('quality', filters.quality);
  }
  filters.tagIds.forEach(id => params.append('tag_id', id));
  params.set('limit', '100');
  return `/api/examples?${params.toString()}`;
}

function applyClientFilters(examples: ExampleData[], filters: FilterState): ExampleData[] {
  let result = [...examples];

  const cutoff = getDateCutoff(filters.dateRange);
  if (cutoff) {
    result = result.filter(e => e.createdAt >= cutoff!);
  }

  return result;
}

export default function ExamplesPage() {
  const [examples, setExamples] = useState<ExampleData[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Initial data load — fetch tags, companies, and first examples in parallel
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [tagsRes, examplesRes] = await Promise.all([
          fetch('/api/tags'),
          fetch('/api/examples?limit=100'),
        ]);

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setAllTags(data.tags ?? []);
        }

        if (examplesRes.ok) {
          const data = await examplesRes.json();
          const exs: ExampleData[] = data.examples ?? [];
          setExamples(exs);
          // Derive unique companies from loaded examples
          const companySet = new Set<string>();
          exs.map((e: ExampleData) => e.company).filter(Boolean).forEach(c => companySet.add(c as string));
          const uniqueCompanies = Array.from(companySet).sort();
          setCompanies(uniqueCompanies);
        }
      } catch {
        setError('Failed to load examples');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch when filters change (server-side filters: query, company, quality, tags)
  const fetchExamples = useCallback(async (f: FilterState) => {
    const url = buildApiUrl(f);
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    return data.examples as ExampleData[];
  }, []);

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f);
    startTransition(async () => {
      setLoading(true);
      try {
        const result = await fetchExamples(f);
        if (result) setExamples(result);
      } catch {
        // keep existing data
      } finally {
        setLoading(false);
      }
    });
  }, [fetchExamples]);

  // Apply client-side date filter on top of server results
  const displayedExamples = applyClientFilters(examples, filters);

  // Update an example — optimistic update + API call
  const handleUpdate = useCallback(async (id: string, updates: Partial<ExampleData> & { tagIds?: string[] }) => {
    // Optimistic update
    setExamples(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = { ...e, ...updates };
      if (updates.tagIds !== undefined) {
        next.tags = allTags.filter(t => updates.tagIds!.includes(t.id));
      }
      return next;
    }));

    const res = await fetch(`/api/examples/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      // Revert on failure — re-fetch
      const data = await fetch(buildApiUrl(filters)).then(r => r.json()).catch(() => ({ examples: [] }));
      setExamples(data.examples ?? []);
    } else {
      const data = await res.json();
      setExamples(prev => prev.map(e => e.id === id ? { ...e, ...data.example } : e));
    }
  }, [allTags, filters]);

  // Delete an example
  const handleDelete = useCallback(async (id: string) => {
    setExamples(prev => prev.filter(e => e.id !== id));
    const res = await fetch(`/api/examples/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      // Restore on failure
      const data = await fetch(buildApiUrl(filters)).then(r => r.json()).catch(() => ({ examples: [] }));
      setExamples(data.examples ?? []);
    }
  }, [filters]);

  // Create a custom tag
  const handleCreateTag = useCallback(async (name: string): Promise<Tag | null> => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newTag: Tag = data.tag;
    setAllTags(prev => [...prev, newTag].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.name.localeCompare(b.name);
    }));
    return newTag;
  }, []);

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Example Bank
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Your extracted Q&amp;A pairs, tagged and ready to use.
          </p>
        </div>
      </div>

      {/* Filters — sticky */}
      <div
        className="sticky top-0 z-10 pb-4 mb-2"
        style={{ background: 'var(--background)' }}
      >
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          tags={allTags.filter(t => t.isSystem)}
          companies={companies}
          total={displayedExamples.length}
          loading={loading}
        />
      </div>

      {/* Error state */}
      {error && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-sm"
          style={{
            background: 'rgba(160,64,64,0.1)',
            border: '1px solid rgba(160,64,64,0.3)',
            borderLeft: '3px solid var(--contradiction)',
            color: 'var(--mist)',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && examples.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading examples">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="skeleton rounded-lg"
              style={{ height: '120px', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayedExamples.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <BookMarked size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <p className="font-heading text-xl font-semibold mb-2" style={{ color: 'var(--mist)' }}>
              {filters.query || filters.tagIds.length > 0 || filters.quality || filters.company
                ? 'No examples match your filters'
                : 'Your bank is empty'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
              {filters.query || filters.tagIds.length > 0 || filters.quality || filters.company
                ? 'Try adjusting your search or clearing your filters.'
                : 'Upload a transcript and extract Q&A pairs to build your example bank.'}
            </p>
          </div>
          {!filters.query && !filters.tagIds.length && !filters.quality && !filters.company && (
            <Link
              href="/upload"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{ background: 'var(--copper)', color: '#111a24' }}
            >
              <Upload size={16} strokeWidth={1.5} />
              Upload transcript
            </Link>
          )}
        </div>
      )}

      {/* Example cards */}
      {displayedExamples.length > 0 && (
        <section aria-label="Example bank" className="space-y-3">
          {displayedExamples.map(example => (
            <ExampleCard
              key={example.id}
              example={example}
              allTags={allTags}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onCreateTag={handleCreateTag}
            />
          ))}
        </section>
      )}
    </div>
  );
}
