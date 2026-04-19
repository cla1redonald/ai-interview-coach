'use client';

import { Crosshair, X } from 'lucide-react';

interface PracticeContextBannerProps {
  type: 'focus' | 'gap';
  topic: string;
  onClear: () => void;
  collapsed?: boolean; // true when persona is selected — show as chip
}

export function PracticeContextBanner({
  type,
  topic,
  onClear,
  collapsed = false,
}: PracticeContextBannerProps) {
  const bannerText =
    type === 'focus'
      ? `Practising with focus: ${topic}. Your Mirror analysis flagged this as a weak area.`
      : `Practising a gap: ${topic}. Identified from your Job Match analysis.`;

  if (collapsed) {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-1.5"
        style={{
          background: 'var(--amber-faint)',
          border: '1px solid var(--amber)',
          borderRadius: '9999px',
          padding: '4px 12px',
          display: 'inline-flex',
        }}
      >
        <Crosshair
          size={14}
          strokeWidth={1.5}
          style={{ color: 'var(--amber)', flexShrink: 0 }}
          aria-hidden="true"
        />
        <span
          className="text-xs"
          style={{ color: 'var(--mist)' }}
        >
          {topic}
        </span>
        <button
          onClick={onClear}
          aria-label={`Clear practice focus: ${topic}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--sage)',
            marginLeft: 2,
          }}
        >
          <X size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3"
      style={{
        background: 'var(--amber-faint)',
        border: '1px solid var(--amber)',
        borderRadius: '6px',
        padding: '12px 16px',
        width: '100%',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Crosshair
          size={18}
          strokeWidth={1.5}
          style={{ color: 'var(--amber)', flexShrink: 0 }}
          aria-hidden="true"
        />
        <span
          className="text-sm"
          style={{ color: 'var(--mist)', lineHeight: 1.5 }}
        >
          {bannerText}
        </span>
      </div>
      <button
        onClick={onClear}
        aria-label={`Clear practice focus: ${topic}`}
        className="text-xs shrink-0"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--sage)',
          padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--mist)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--sage)')}
      >
        Clear
      </button>
    </div>
  );
}
