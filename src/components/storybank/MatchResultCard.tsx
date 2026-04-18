'use client';

import { useState } from 'react';
import { BookMarked, ChevronDown, ChevronUp } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  isSystem: boolean;
  userId: string | null;
}

export interface ExampleData {
  id: string;
  question: string;
  answer: string;
  qualityRating: string | null;
  transcriptId: string | null;
  tags: TagData[];
}

export interface MatchResult {
  example: ExampleData;
  similarity: number;
  explanation: string;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return 'var(--amber)';
  if (score >= 0.6) return 'var(--copper)';
  return 'var(--sage)';
}

interface MatchResultCardProps {
  result: MatchResult;
  rank: number;
}

export function MatchResultCard({ result, rank }: MatchResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { example, similarity, explanation } = result;

  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '20px 24px',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e =>
        (e.currentTarget.style.boxShadow =
          '0 0 0 1px var(--amber-faint), 0 4px 16px rgba(226,160,57,0.06)')
      }
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header: rank + score */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--sage)', fontFamily: 'var(--font-mono)', minWidth: 24 }}
          >
            #{rank}
          </span>
          <span
            className="font-semibold"
            style={{
              color: scoreColor(similarity),
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-label={`${Math.round(similarity * 100)} percent match`}
          >
            {Math.round(similarity * 100)}%
          </span>
          <span className="text-xs" style={{ color: 'var(--sage)' }}>
            match
          </span>
        </div>
        <BookMarked size={16} strokeWidth={1.5} style={{ color: 'var(--sage)', flexShrink: 0 }} />
      </div>

      {/* Tags */}
      {example.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {example.tags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5"
              style={{
                background: 'var(--tay)',
                border: '1px solid var(--border)',
                borderRadius: '9999px',
                color: 'var(--sage)',
              }}
            >
              {tag.name}
            </span>
          ))}
          {example.tags.length > 3 && (
            <span
              className="text-xs px-2 py-0.5"
              style={{
                background: 'var(--tay)',
                border: '1px solid var(--border)',
                borderRadius: '9999px',
                color: 'var(--sage)',
              }}
            >
              +{example.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Question */}
      <h3
        className="font-heading font-semibold mb-2"
        style={{ color: 'var(--mist)', fontSize: '1rem', letterSpacing: '-0.01em' }}
      >
        {example.question}
      </h3>

      {/* Answer preview */}
      <p
        className="text-sm mb-3"
        style={{
          color: 'var(--sage)',
          lineHeight: 1.6,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {example.answer}
      </p>

      {example.answer.length > 200 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs flex items-center gap-1 mb-3"
          style={{
            color: 'var(--copper)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {expanded ? (
            <>
              <ChevronUp size={12} strokeWidth={1.5} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} strokeWidth={1.5} />
              Read more
            </>
          )}
        </button>
      )}

      {/* Why this matches */}
      {explanation && (
        <div
          className="text-sm p-3 rounded"
          style={{
            background: 'var(--card-raised)',
            borderLeft: '3px solid var(--amber)',
            color: 'var(--mist)',
            lineHeight: 1.55,
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--amber)', display: 'block', marginBottom: 4 }}
          >
            Why this matches
          </span>
          {explanation}
        </div>
      )}
    </article>
  );
}
