'use client';

import Link from 'next/link';
import { AlertTriangle, TrendingDown, Target } from 'lucide-react';

interface WhereFocusCardProps {
  type: 'consistency' | 'weak-category' | 'lowest-strength';
  category: string;
  detail: string;
  href: string;
}

const ICON_MAP = {
  consistency: AlertTriangle,
  'weak-category': TrendingDown,
  'lowest-strength': Target,
} as const;

const TITLE_MAP = {
  consistency: 'Consistency flag active',
  'weak-category': 'Weak coverage',
  'lowest-strength': 'Room to improve',
} as const;

export function WhereFocusCard({ type, category, detail, href }: WhereFocusCardProps) {
  const Icon = ICON_MAP[type];
  const title = TITLE_MAP[type];
  const isContradiction = type === 'consistency';

  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${isContradiction ? 'var(--contradiction)' : 'var(--amber)'}`,
      }}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon
          size={18}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0"
          style={{ color: isContradiction ? 'var(--contradiction)' : 'var(--amber)' }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--mist)' }}>
            {title}: {category}
          </p>
          <p className="text-xs mt-1 mb-3" style={{ color: 'var(--sage)' }}>
            {detail}
          </p>
          <Link
            href={href}
            className="text-xs font-medium"
            style={{ color: 'var(--amber)' }}
          >
            {isContradiction ? 'Review consistency \u2192' : `Practice ${category} \u2192`}
          </Link>
        </div>
      </div>
    </div>
  );
}
