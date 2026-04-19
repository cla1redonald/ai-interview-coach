'use client';

import { useState, useId } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import type { DimensionConfidence } from '@/lib/types';

interface DimensionScoreRowProps {
  dimension: string;
  score: number; // 1-10
  rationale: string;
  confidence: DimensionConfidence;
  redFlag?: string;
  uncertainClaim?: string;
  userAnnotation?: string;
  onAnnotationSave: (value: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--amber)';
  if (score >= 6) return 'var(--copper)';
  return 'var(--sage)';
}

export function DimensionScoreRow({
  dimension,
  score,
  rationale,
  confidence,
  redFlag,
  uncertainClaim,
  userAnnotation = '',
  onAnnotationSave,
}: DimensionScoreRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [annotation, setAnnotation] = useState(userAnnotation);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const panelId = useId();
  const color = scoreColor(score);

  function handleAnnotationChange(value: string) {
    setAnnotation(value);
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => {
      onAnnotationSave(value);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }, 800);
    setSaveTimer(t);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setExpanded((prev) => !prev);
    }
  }

  const pct = ((score / 10) * 100).toFixed(0) + '%';

  // First 2 lines of rationale for collapsed preview
  const previewLines = rationale.split('\n').slice(0, 2).join(' ');
  const previewText = previewLines.length > 120 ? previewLines.slice(0, 120) + '…' : previewLines;

  return (
    <article
      aria-label={`${dimension} score: ${score} out of 10`}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header row — always visible */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls={panelId}
        style={{ padding: '12px 16px' }}
      >
        <div className="flex items-center gap-3">
          {/* Dimension label */}
          <span
            className="text-sm font-medium flex-1 min-w-0"
            style={{ color: 'var(--mist)' }}
          >
            {dimension}
            {redFlag && (
              <AlertTriangle
                size={13}
                strokeWidth={1.5}
                className="inline ml-1.5 mb-0.5"
                style={{ color: 'var(--contradiction)' }}
                aria-label="Red flag"
              />
            )}
            {uncertainClaim && (
              <span
                className="ml-1.5 text-xs italic"
                style={{ color: 'var(--sage)' }}
                aria-label="Uncertain claim"
              >
                ~
              </span>
            )}
          </span>

          {/* Score number */}
          <span
            className="font-mono text-base font-bold tabular-nums shrink-0"
            style={{ color, minWidth: '2.5rem', textAlign: 'right' }}
          >
            {score}/10
          </span>

          {/* Chevron */}
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            style={{
              color: 'var(--sage)',
              flexShrink: 0,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        </div>

        {/* Progress bar */}
        <div
          className="mt-2 rounded-full"
          style={{
            height: '4px',
            background: 'var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: pct,
              background: color,
              borderRadius: '9999px',
              transition: 'width 300ms ease',
            }}
          />
        </div>

        {/* Collapsed preview text */}
        {!expanded && (
          <p
            className="mt-1.5 text-xs leading-relaxed"
            style={{ color: 'var(--sage)' }}
          >
            {previewText}
          </p>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-label={`${dimension} detail`}
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
          }}
        >
          {/* Full rationale */}
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--mist)' }}>
            {rationale}
          </p>

          {/* Confidence badge */}
          <p className="text-xs mb-3" style={{ color: 'var(--sage)' }}>
            Confidence:{' '}
            <span
              style={{
                color:
                  confidence === 'high'
                    ? 'var(--amber)'
                    : confidence === 'medium'
                    ? 'var(--copper)'
                    : 'var(--sage)',
              }}
            >
              {confidence}
            </span>
          </p>

          {/* Red flag */}
          {redFlag && (
            <div
              className="flex items-start gap-2 p-3 rounded-md mb-3"
              style={{
                background: 'rgba(196,90,42,0.08)',
                borderLeft: '3px solid var(--contradiction)',
              }}
            >
              <AlertTriangle
                size={14}
                strokeWidth={1.5}
                className="shrink-0 mt-0.5"
                style={{ color: 'var(--contradiction)' }}
              />
              <p className="text-xs" style={{ color: 'var(--contradiction)' }}>
                {redFlag}
              </p>
            </div>
          )}

          {/* Uncertain claim */}
          {uncertainClaim && (
            <p
              className="text-xs italic mb-3"
              style={{ color: 'var(--sage)' }}
            >
              ~ {uncertainClaim}
            </p>
          )}

          {/* Annotation textarea */}
          <div>
            <label
              htmlFor={`annotation-${panelId}`}
              className="text-xs mb-1 block"
              style={{ color: 'var(--sage)' }}
            >
              Your notes
            </label>
            <textarea
              id={`annotation-${panelId}`}
              value={annotation}
              onChange={(e) => handleAnnotationChange(e.target.value)}
              placeholder="Add your thoughts on this dimension…"
              rows={3}
              className="w-full rounded-md text-sm resize-y"
              style={{
                background: 'var(--card-raised)',
                border: '1px solid var(--border)',
                color: 'var(--mist)',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--sage)', minHeight: '1rem' }}
            >
              {savedMsg ? 'Saved automatically' : ' '}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
