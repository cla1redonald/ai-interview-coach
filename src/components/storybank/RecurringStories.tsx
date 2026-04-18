'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { StoryCluster } from '@/app/api/mirror/analyze/route';

interface RecurringStoriesProps {
  clusters: StoryCluster[];
}

function MiniQualityBar({ qb, total }: {
  qb: StoryCluster['quality_breakdown'];
  total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div
      className="flex h-1.5 rounded-full overflow-hidden"
      style={{ width: '60px', background: 'var(--card-raised)' }}
      aria-label={`${qb.strong} strong, ${qb.weak} weak`}
    >
      {qb.strong > 0 && <div style={{ width: pct(qb.strong), background: '#e2a039' }} />}
      {qb.neutral > 0 && <div style={{ width: pct(qb.neutral), background: '#6a8a8a' }} />}
      {qb.unrated > 0 && <div style={{ width: pct(qb.unrated), background: '#2a3a4a' }} />}
      {qb.weak > 0 && <div style={{ width: pct(qb.weak), background: '#a04040' }} />}
    </div>
  );
}

function StoryCard({ cluster }: { cluster: StoryCluster }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg p-4 space-y-3 transition-all"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        minWidth: '220px',
        maxWidth: '280px',
        flexShrink: 0,
      }}
    >
      <div>
        <h4
          className="font-heading font-semibold text-sm leading-snug mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          {cluster.label}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: 'var(--amber)' }}>
            Used {cluster.count}×
          </span>
          <MiniQualityBar qb={cluster.quality_breakdown} total={cluster.count} />
        </div>
      </div>

      {/* Preview question */}
      {cluster.preview_question && (
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: 'var(--sage)' }}
        >
          e.g. &ldquo;{cluster.preview_question}&rdquo;
        </p>
      )}

      {/* Expand to see all examples */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
        style={{ color: 'var(--copper)' }}
      >
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
        />
        {expanded ? 'Hide' : `See all ${cluster.count} examples`}
      </button>

      {expanded && (
        <ul className="space-y-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          {cluster.example_ids.map(id => (
            <li key={id}>
              <Link
                href={`/examples#${id}`}
                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                style={{ color: 'var(--sage)' }}
              >
                <ExternalLink size={11} strokeWidth={1.5} />
                View example
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecurringStories({ clusters }: RecurringStoriesProps) {
  if (clusters.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--sage)' }}>
        No recurring stories detected yet. Upload more transcripts to see your patterns.
      </p>
    );
  }

  return (
    <div>
      {/* Horizontal scroll on desktop, vertical stack on mobile */}
      <div
        className="flex gap-4 overflow-x-auto pb-3 sm:flex-row flex-col sm:overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {clusters.map((cluster, i) => (
          <StoryCard key={i} cluster={cluster} />
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--sage)' }}>
        Stories detected across your example bank. Scroll to see all.
      </p>
    </div>
  );
}
