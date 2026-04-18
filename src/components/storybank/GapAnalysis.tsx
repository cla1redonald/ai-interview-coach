'use client';

import { AlertCircle } from 'lucide-react';

export interface GapItem {
  requirement: string;
  gap_description: string;
}

interface GapAnalysisProps {
  gaps: GapItem[];
}

export function GapAnalysis({ gaps }: GapAnalysisProps) {
  if (gaps.length === 0) return null;

  return (
    <section aria-labelledby="gaps-heading">
      <div
        className="flex items-center gap-2 p-4 rounded-t-lg"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--amber)' }} />
        <h2
          id="gaps-heading"
          className="font-heading font-semibold"
          style={{ color: 'var(--mist)', fontSize: '1rem', letterSpacing: '-0.01em' }}
        >
          Gaps to address
        </h2>
      </div>
      <div
        className="p-4 rounded-b-lg"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '1px solid var(--border-strong)',
        }}
      >
        <p className="text-xs mb-4" style={{ color: 'var(--sage)' }}>
          Requirements in the job spec with no strong example in your bank. Consider preparing a
          story before applying.
        </p>
        <ul className="flex flex-col gap-2">
          {gaps.map((gap, i) => (
            <li
              key={i}
              className="text-sm"
              style={{
                padding: '12px 16px',
                background: 'var(--card-raised)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <span
                className="font-semibold block mb-1"
                style={{ color: 'var(--mist)' }}
              >
                {gap.requirement}
              </span>
              <span style={{ color: 'var(--sage)' }}>{gap.gap_description}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
