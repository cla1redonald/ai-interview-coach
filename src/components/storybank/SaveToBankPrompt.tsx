'use client';

import { Archive } from 'lucide-react';

interface SaveToBankPromptProps {
  onReview: () => void;
  onSkip: () => void;
}

export function SaveToBankPrompt({ onReview, onSkip }: SaveToBankPromptProps) {
  return (
    <div
      className="mt-4 p-5 rounded-lg"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--amber)',
      }}
    >
      <div className="flex items-start gap-3">
        <Archive
          size={20}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--amber)' }}
        />
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--mist)' }}>
            Save to your Example Bank?
          </p>
          <p className="text-sm mb-3" style={{ color: 'var(--sage)' }}>
            Your answers during this session can become examples in your bank.
            They will be tagged &ldquo;Practice session&rdquo; and marked as unrated until you review them.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onReview}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: 'var(--amber)',
                color: 'var(--ink)',
              }}
            >
              Review and save
            </button>
            <button
              onClick={onSkip}
              className="text-sm transition-colors"
              style={{ color: 'var(--sage)' }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
