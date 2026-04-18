'use client';

import type { PatternInsight } from '@/app/api/mirror/analyze/route';

interface PatternCardsProps {
  patterns: PatternInsight[];
}

export function PatternCards({ patterns }: PatternCardsProps) {
  if (patterns.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--sage)' }}>
        Upload 3+ transcripts with tagged examples to see your answer patterns.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {patterns.map((insight, i) => (
        <article
          key={i}
          className="rounded-lg p-4"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--amber)',
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--amber)' }}
          >
            {insight.tag_name}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--mist)' }}>
            {insight.pattern}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--sage)' }}>
            {insight.example_ids.length} {insight.example_ids.length === 1 ? 'example' : 'examples'}
          </p>
        </article>
      ))}
    </div>
  );
}
