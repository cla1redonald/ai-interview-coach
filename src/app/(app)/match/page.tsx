'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Loader2,
  AlertCircle,
  BookMarked,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagData {
  id: string;
  name: string;
  isSystem: boolean;
  userId: string | null;
}

interface ExampleData {
  id: string;
  question: string;
  answer: string;
  qualityRating: string | null;
  transcriptId: string | null;
  tags: TagData[];
}

interface MatchResult {
  example: ExampleData;
  similarity: number;
  explanation: string;
}

interface GapItem {
  requirement: string;
  gap_description: string;
}

interface MatchResponse {
  matches: MatchResult[];
  gaps: GapItem[];
  job_spec_summary: string;
  error?: string;
}

// ─── Score colour helper ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.8) return 'var(--amber)';
  if (score >= 0.6) return 'var(--copper)';
  return 'var(--sage)';
}

function scoreLabel(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// ─── Match result card ────────────────────────────────────────────────────────

function MatchCard({ result, rank }: { result: MatchResult; rank: number }) {
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
            {scoreLabel(similarity)}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--sage)' }}
          >
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

      {/* Answer preview / expanded */}
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
          style={{ color: 'var(--copper)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
          <span className="text-xs font-semibold" style={{ color: 'var(--amber)', display: 'block', marginBottom: 4 }}>
            Why this matches
          </span>
          {explanation}
        </div>
      )}
    </article>
  );
}

// ─── Gap card ─────────────────────────────────────────────────────────────────

function GapCard({ gap }: { gap: GapItem }) {
  return (
    <li
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
      <Link
        href={`/practice?gap=${encodeURIComponent(gap.requirement)}`}
        className="text-xs mt-2 inline-block"
        style={{ color: 'var(--amber)' }}
      >
        Practice this gap →
      </Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchPage() {
  const [jobSpec, setJobSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MatchResponse | null>(null);

  async function handleMatch() {
    if (!jobSpec.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_spec: jobSpec }),
      });
      const data: MatchResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data);
    } catch {
      setError('Connection issue — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <h1
        className="font-heading text-3xl font-bold mb-2"
        style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
      >
        Job Match
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--sage)' }}>
        Paste a job spec to find your best matching examples from your bank.
      </p>

      {/* Input area */}
      <div
        className="rounded-lg p-6 mb-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <label
          htmlFor="job-spec"
          className="block text-xs font-semibold mb-2"
          style={{ color: 'var(--mist)' }}
        >
          Job specification
        </label>
        <textarea
          id="job-spec"
          value={jobSpec}
          onChange={e => setJobSpec(e.target.value)}
          placeholder="Paste the full job description or key requirements here…"
          rows={8}
          className="w-full text-sm resize-y rounded"
          style={{
            background: 'var(--input)',
            border: '1px solid var(--border)',
            color: 'var(--mist)',
            padding: '12px',
            outline: 'none',
            lineHeight: 1.6,
            minHeight: 160,
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          disabled={loading}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: 'var(--sage)' }}>
            {jobSpec.length} characters
          </span>
          <button
            onClick={handleMatch}
            disabled={loading || !jobSpec.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold"
            style={{
              background: loading || !jobSpec.trim() ? 'var(--tay)' : 'var(--primary)',
              color: loading || !jobSpec.trim() ? 'var(--sage)' : 'var(--primary-foreground)',
              border: 'none',
              cursor: loading || !jobSpec.trim() ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                Matching…
              </>
            ) : (
              <>
                <Target size={16} strokeWidth={1.5} />
                Match my bank
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded mb-6 text-sm"
          role="alert"
          style={{
            background: 'var(--card)',
            borderLeft: '3px solid var(--destructive)',
            color: 'var(--mist)',
          }}
        >
          <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16" aria-busy="true" aria-label="Matching examples">
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Searching your example bank…
          </p>
          <p className="text-xs" style={{ color: 'var(--sage)' }}>
            This usually takes 10–20 seconds
          </p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* Job spec summary */}
          {result.job_spec_summary && (
            <div
              className="p-4 rounded mb-6 text-sm"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--sage)',
                lineHeight: 1.6,
              }}
            >
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--mist)' }}>
                Role summary
              </span>
              {result.job_spec_summary}
            </div>
          )}

          {/* Match count */}
          <p className="text-xs font-semibold mb-4" style={{ color: 'var(--sage)' }}>
            {result.matches.length} example{result.matches.length !== 1 ? 's' : ''} matched
          </p>

          {/* Ranked results */}
          {result.matches.length > 0 ? (
            <ol className="flex flex-col gap-4 mb-8" aria-label="Matched examples">
              {result.matches.map((match, i) => (
                <li key={match.example.id}>
                  <MatchCard result={match} rank={i + 1} />
                </li>
              ))}
            </ol>
          ) : (
            <div
              className="flex flex-col items-center gap-3 p-12 rounded-lg mb-8"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Target size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
                No examples matched above the threshold
              </p>
              <p className="text-xs text-center" style={{ color: 'var(--sage)' }}>
                Try uploading more transcripts or a different job spec.
              </p>
            </div>
          )}

          {/* Gaps */}
          {result.gaps && result.gaps.length > 0 && (
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
                  Requirements in the job spec with no strong example in your bank. Consider preparing a story before applying.
                </p>
                <ul className="flex flex-col gap-2">
                  {result.gaps.map((gap, i) => (
                    <GapCard key={i} gap={gap} />
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Initial empty state (no results yet, not loading) */}
      {!result && !loading && !error && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-16 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Target size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
            Paste a job spec to find your best examples
          </p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--sage)' }}>
            Vector similarity matching ranks your examples by relevance, then Claude explains each match and identifies gaps.
          </p>
        </div>
      )}
    </div>
  );
}
