'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, RefreshCw, Upload, Loader2 } from 'lucide-react';
import { RecurringStories } from '@/components/storybank/RecurringStories';
import { PhraseCloud } from '@/components/storybank/PhraseCloud';
import { PatternCards } from '@/components/storybank/PatternCards';
import { StrengthMap } from '@/components/storybank/StrengthMap';
import type { MirrorAnalysis } from '@/app/api/mirror/analyze/route';

interface AnalysisResult {
  analysis: MirrorAnalysis;
  examples_analyzed: number;
  generated_at: string;
}

interface InsufficientData {
  insufficient_data: true;
  examples_count: number;
  min_required: number;
}

type MirrorState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'insufficient'; data: InsufficientData }
  | { status: 'ready'; data: AnalysisResult }
  | { status: 'error'; message: string };

function SectionPanel({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2
        id={id}
        className="font-heading text-xl font-semibold"
        style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
      >
        {heading}
      </h2>
      {children}
      <div style={{ height: '1px', background: 'var(--border)' }} aria-hidden="true" />
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function MirrorPage() {
  const [state, setState] = useState<MirrorState>({ status: 'idle' });

  async function runAnalysis() {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/mirror/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setState({ status: 'error', message: (err as { error: string }).error ?? 'Analysis failed' });
        return;
      }

      const data = await res.json();

      if (data.insufficient_data) {
        setState({ status: 'insufficient', data: data as InsufficientData });
        return;
      }

      setState({ status: 'ready', data: data as AnalysisResult });
    } catch {
      setState({ status: 'error', message: 'Network error — please try again.' });
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Mirror
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Here is what your interviews are telling you about yourself.
          </p>
        </div>

        {state.status !== 'loading' && (
          <button
            type="button"
            onClick={runAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0"
            style={{
              background: state.status === 'ready' ? 'var(--card-raised)' : 'var(--copper)',
              color: state.status === 'ready' ? 'var(--mist)' : '#111a24',
              border: state.status === 'ready' ? '1px solid var(--border)' : 'none',
            }}
            aria-label={state.status === 'ready' ? 'Re-run analysis' : 'Run analysis'}
          >
            {state.status === 'ready' ? (
              <RefreshCw size={16} strokeWidth={1.5} />
            ) : (
              <Sparkles size={16} strokeWidth={1.5} />
            )}
            {state.status === 'ready' ? 'Re-run' : 'Analyse my bank'}
          </button>
        )}
      </div>

      {/* Idle state */}
      {state.status === 'idle' && (
        <div
          className="flex flex-col items-center justify-center gap-6 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Sparkles size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <h2 className="font-heading text-xl font-semibold mb-2" style={{ color: 'var(--mist)' }}>
              See your interview patterns
            </h2>
            <p className="text-sm max-w-sm" style={{ color: 'var(--sage)' }}>
              The Mirror analyses your example bank to surface recurring stories,
              signature phrases, answer patterns, and example quality by category.
            </p>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            <Sparkles size={16} strokeWidth={1.5} />
            Analyse my bank
          </button>
        </div>
      )}

      {/* Loading */}
      {state.status === 'loading' && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          aria-busy="true"
          aria-label="Running analysis"
        >
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <div className="text-center">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--mist)' }}>
              Analysing your example bank…
            </p>
            <p className="text-xs" style={{ color: 'var(--sage)' }}>
              Identifying patterns, clustering stories, extracting phrases. This usually takes 10–20 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Insufficient data */}
      {state.status === 'insufficient' && (
        <div
          className="flex flex-col items-center justify-center gap-6 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Sparkles size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <h2 className="font-heading text-xl font-semibold mb-2" style={{ color: 'var(--mist)' }}>
              Upload {state.data.min_required} examples to unlock Mirror
            </h2>
            <p className="text-sm mb-1" style={{ color: 'var(--sage)' }}>
              The Mirror needs at least {state.data.min_required} examples to detect patterns.
              You have {state.data.examples_count}.
            </p>
            <p className="text-sm" style={{ color: 'var(--sage)' }}>
              Upload {state.data.min_required - state.data.examples_count} more to continue.
            </p>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            <Upload size={16} strokeWidth={1.5} />
            Upload transcript
          </Link>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-sm"
          role="alert"
          style={{
            background: 'rgba(160,64,64,0.1)',
            border: '1px solid rgba(160,64,64,0.3)',
            borderLeft: '3px solid var(--contradiction)',
            color: 'var(--mist)',
          }}
        >
          <p className="font-medium mb-1">Analysis failed</p>
          <p style={{ color: 'var(--sage)' }}>{state.message}</p>
          <button
            type="button"
            onClick={runAnalysis}
            className="mt-3 text-xs underline"
            style={{ color: 'var(--copper)' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {state.status === 'ready' && (
        <div className="space-y-10">
          {/* Meta */}
          <p className="text-xs" style={{ color: 'var(--sage)' }}>
            {state.data.examples_analyzed} examples analysed · generated {formatDate(state.data.generated_at)}
          </p>

          {/* Section 1: Recurring Stories */}
          <SectionPanel id="recurring-stories-heading" heading="Your recurring stories">
            <RecurringStories clusters={state.data.analysis.recurring_stories} />
          </SectionPanel>

          {/* Section 2: Phrase Cloud */}
          <SectionPanel id="phrase-cloud-heading" heading="Your signature phrases">
            <PhraseCloud
              phrases={state.data.analysis.phrase_analysis}
              topInsight={state.data.analysis.top_phrase_insight}
            />
          </SectionPanel>

          {/* Section 3: Pattern Cards */}
          <SectionPanel id="pattern-cards-heading" heading="What you lead with">
            <PatternCards patterns={state.data.analysis.pattern_recognition} />
          </SectionPanel>

          {/* Section 4: Strength Map */}
          <SectionPanel id="strength-map-heading" heading="Example quality by category">
            <StrengthMap categories={state.data.analysis.strength_map} />
          </SectionPanel>
        </div>
      )}
    </div>
  );
}
