'use client';

import type { StrengthCategory } from '@/app/api/mirror/analyze/route';

interface StrengthMapProps {
  categories: StrengthCategory[];
}

function QualityBar({ strong, weak, neutral, unrated, total }: {
  strong: number; weak: number; neutral: number; unrated: number; total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div
      className="flex h-2 rounded-full overflow-hidden"
      style={{ background: 'var(--card-raised)', minWidth: 0 }}
      title={`${strong} strong · ${weak} weak · ${neutral} neutral · ${unrated} unrated`}
      aria-label={`${strong} strong, ${weak} weak, ${neutral} neutral, ${unrated} unrated`}
    >
      {strong > 0 && (
        <div style={{ width: pct(strong), background: '#e2a039', flexShrink: 0 }} />
      )}
      {neutral > 0 && (
        <div style={{ width: pct(neutral), background: '#6a8a8a', flexShrink: 0 }} />
      )}
      {unrated > 0 && (
        <div style={{ width: pct(unrated), background: '#2a3a4a', flexShrink: 0 }} />
      )}
      {weak > 0 && (
        <div style={{ width: pct(weak), background: '#a04040', flexShrink: 0 }} />
      )}
    </div>
  );
}

export function StrengthMap({ categories }: StrengthMapProps) {
  if (categories.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--sage)' }}>
        No tagged examples yet. Tag your examples to see strength by category.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map(cat => (
        <div key={cat.tag_name} className="group">
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-sm min-w-0 flex-1 truncate"
              style={{ color: 'var(--mist)' }}
              title={cat.tag_name}
            >
              {cat.tag_name}
            </span>
            <span
              className="text-xs shrink-0 font-mono"
              style={{ color: 'var(--sage)' }}
              aria-label={`${cat.total} examples`}
            >
              {cat.total}
            </span>
          </div>
          <QualityBar
            strong={cat.strong}
            weak={cat.weak}
            neutral={cat.neutral}
            unrated={cat.unrated}
            total={cat.total}
          />
          {/* Hover annotation */}
          <p
            className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
            style={{ color: 'var(--sage)' }}
            aria-live="polite"
          >
            {cat.strong > 0 && `${cat.strong} strong`}
            {cat.weak > 0 && ` · ${cat.weak} weak`}
            {cat.neutral > 0 && ` · ${cat.neutral} neutral`}
            {cat.unrated > 0 && ` · ${cat.unrated} unrated`}
          </p>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        {[
          { color: '#e2a039', label: 'Strong' },
          { color: '#6a8a8a', label: 'Neutral' },
          { color: '#2a3a4a', label: 'Unrated' },
          { color: '#a04040', label: 'Weak' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--sage)' }}>
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
