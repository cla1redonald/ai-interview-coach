'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface FlagCardProps {
  title: string;
  description: string;
  relatedDimension?: string;
  consistencyLink?: string;
  onDismiss: () => void;
  dismissed: boolean;
}

export function FlagCard({
  title,
  description,
  relatedDimension,
  consistencyLink,
  onDismiss,
  dismissed,
}: FlagCardProps) {
  const [hovered, setHovered] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="relative rounded-md p-4"
      style={{
        background: 'rgba(226,160,57,0.05)',
        borderLeft: '3px solid var(--contradiction)',
        border: '1px solid rgba(196,90,42,0.25)',
        borderLeftWidth: '3px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={16}
          strokeWidth={1.5}
          className="shrink-0 mt-0.5"
          style={{ color: 'var(--contradiction)' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--mist)' }}>
            {title}
          </p>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            {description}
          </p>
          {relatedDimension && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--sage)' }}>
              Related: {relatedDimension}
            </p>
          )}
          {consistencyLink && (
            <a
              href={consistencyLink}
              className="text-xs mt-1 block"
              style={{ color: 'var(--copper)' }}
            >
              View consistency check →
            </a>
          )}
        </div>

        {/* Dismiss button — shown on hover */}
        {hovered && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0 transition-colors"
            style={{
              color: 'var(--sage)',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              whiteSpace: 'nowrap',
            }}
            aria-label={`Dismiss flag: ${title}`}
          >
            Not a concern for me
            <X size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
