'use client';

import { Star, StarOff } from 'lucide-react';

type Quality = 'strong' | 'weak' | 'neutral' | null;

interface QualityBadgeProps {
  quality: Quality;
  /** If true, renders as interactive buttons for picking quality */
  interactive?: boolean;
  onSelect?: (q: Quality) => void;
  loading?: boolean;
}

const QUALITY_CONFIG: Record<NonNullable<Quality>, { label: string; color: string; icon: 'filled' | 'off' | 'outline' }> = {
  strong: { label: 'Strong', color: '#e2a039', icon: 'filled' },
  weak:   { label: 'Weak',   color: '#a04040', icon: 'off' },
  neutral: { label: 'Neutral', color: '#6a8a8a', icon: 'outline' },
};

function QualityIcon({ icon, color }: { icon: 'filled' | 'off' | 'outline'; color: string }) {
  if (icon === 'off') {
    return <StarOff size={14} strokeWidth={1.5} style={{ color }} aria-hidden="true" />;
  }
  if (icon === 'filled') {
    return <Star size={14} strokeWidth={1.5} fill={color} style={{ color }} aria-hidden="true" />;
  }
  return <Star size={14} strokeWidth={1.5} style={{ color }} aria-hidden="true" />;
}

export function QualityBadge({ quality, interactive, onSelect, loading }: QualityBadgeProps) {
  if (interactive) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Quality rating">
        {(['strong', 'weak', 'neutral'] as const).map((q) => {
          const cfg = QUALITY_CONFIG[q];
          const isSelected = quality === q;
          return (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => onSelect?.(isSelected ? null : q)}
              aria-pressed={isSelected}
              aria-label={`Mark as ${cfg.label}`}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-100 disabled:opacity-50"
              style={{
                background: isSelected ? `${cfg.color}20` : 'var(--card-raised)',
                border: `1px solid ${isSelected ? cfg.color : 'var(--border)'}`,
                color: isSelected ? cfg.color : 'var(--sage)',
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              <QualityIcon icon={cfg.icon} color={isSelected ? cfg.color : 'var(--sage)'} />
              {cfg.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (!quality) {
    return (
      <span
        className="flex items-center gap-1 text-xs"
        style={{ color: 'var(--quality-unrated)' }}
        aria-label="Unrated example"
      >
        <Star size={13} strokeWidth={1.5} aria-hidden="true" />
        Unrated
      </span>
    );
  }

  const cfg = QUALITY_CONFIG[quality];
  return (
    <span
      className="flex items-center gap-1 text-xs"
      style={{ color: cfg.color }}
      aria-label={`${cfg.label} example`}
    >
      <QualityIcon icon={cfg.icon} color={cfg.color} />
      {cfg.label}
    </span>
  );
}
