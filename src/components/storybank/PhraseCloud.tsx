'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import type { PhraseCount } from '@/app/api/mirror/analyze/route';

interface PhraseCloudProps {
  phrases: PhraseCount[];
  topInsight: string | null;
}

function getPhraseColor(index: number, total: number): string {
  const pct = index / Math.max(total - 1, 1);
  if (pct < 0.33) return 'var(--amber)';
  if (pct < 0.66) return 'var(--copper)';
  return 'var(--sage)';
}

function getPhraseSize(index: number, total: number): string {
  const pct = index / Math.max(total - 1, 1);
  if (pct < 0.2) return '1rem';
  if (pct < 0.4) return '0.875rem';
  if (pct < 0.6) return '0.8125rem';
  return '0.75rem';
}

export function PhraseCloud({ phrases, topInsight }: PhraseCloudProps) {
  const router = useRouter();

  const handlePhraseClick = (phrase: string) => {
    router.push(`/examples?q=${encodeURIComponent(phrase)}`);
  };

  if (phrases.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--sage)' }}>
        Not enough data yet. Upload more transcripts to see your signature phrases.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top phrase callout */}
      {topInsight && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-md"
          style={{
            background: 'var(--amber-faint)',
            borderLeft: '3px solid var(--amber)',
          }}
          role="note"
        >
          <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: '1px' }} />
          <p className="text-sm" style={{ color: 'var(--mist)' }}>
            {topInsight}
          </p>
        </div>
      )}

      {/* Phrase cloud */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Signature phrases — click to filter examples"
      >
        {phrases.map((p, i) => (
          <button
            key={p.phrase}
            type="button"
            onClick={() => handlePhraseClick(p.phrase)}
            role="button"
            aria-label={`"${p.phrase}" — used ${p.count} times. Click to filter examples.`}
            className="px-2.5 py-1 rounded-full transition-all hover:opacity-80 focus:outline-none focus:ring-2"
            style={{
              background: 'var(--card-raised)',
              border: '1px solid var(--border)',
              color: getPhraseColor(i, phrases.length),
              fontSize: getPhraseSize(i, phrases.length),
              fontWeight: i < phrases.length * 0.33 ? 600 : 400,
              // Focus ring uses amber per design
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ['--tw-ring-color' as any]: 'var(--amber)',
            }}
          >
            {p.phrase}
            <span
              className="ml-1 text-xs"
              style={{ color: 'var(--sage)', fontSize: '0.7rem' }}
              aria-hidden="true"
            >
              {p.count}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs" style={{ color: 'var(--sage)' }}>
        Click any phrase to filter your example bank.
      </p>
    </div>
  );
}
