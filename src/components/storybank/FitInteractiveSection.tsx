'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DimensionScoreRow } from '@/components/storybank/DimensionScoreRow';
import { FlagCard } from '@/components/storybank/FlagCard';
import type { DimensionScore, FitWeights } from '@/lib/types';

interface FitInteractiveSectionProps {
  jobId: string;
  assessmentId: string;
  dimScores: Record<keyof FitWeights, DimensionScore | null>;
  dimensionAnnotations: Partial<Record<keyof FitWeights, string>>;
  redFlags: string[];
  dismissedRedFlags: string[];
}

const DIMENSION_KEYS: (keyof FitWeights)[] = [
  'domain',
  'seniority',
  'scope',
  'technical',
  'mission',
  'location',
  'compensation',
  'culture',
];

const DIMENSION_LABELS: Record<keyof FitWeights, string> = {
  domain: 'Domain / Industry',
  seniority: 'Seniority',
  scope: 'Scope',
  technical: 'Technical',
  mission: 'Mission',
  location: 'Location',
  compensation: 'Compensation',
  culture: 'Culture',
};

export function FitInteractiveSection({
  jobId,
  assessmentId,
  dimScores,
  dimensionAnnotations: initialAnnotations,
  redFlags,
  dismissedRedFlags: initialDismissed,
}: FitInteractiveSectionProps) {
  const [annotations, setAnnotations] =
    useState<Partial<Record<keyof FitWeights, string>>>(initialAnnotations);
  const [dismissed, setDismissed] = useState<string[]>(initialDismissed);
  const [dismissedAccordionOpen, setDismissedAccordionOpen] = useState(false);

  // Persist annotation via PATCH
  async function handleAnnotationSave(dim: keyof FitWeights, value: string) {
    const next = { ...annotations, [dim]: value };
    setAnnotations(next);
    try {
      await fetch(`/api/applications/${jobId}/assessment/annotations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensionAnnotations: next }),
      });
    } catch {
      // Silent failure — annotation is still in local state
    }
  }

  // Dismiss a red flag
  async function handleDismiss(flag: string) {
    const next = [...dismissed, flag];
    setDismissed(next);
    try {
      await fetch(`/api/applications/${jobId}/assessment/annotations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissedRedFlags: next }),
      });
    } catch {
      // Optimistic — revert on persistent failure if needed
    }
  }

  const activeFlags = redFlags.filter((f) => !dismissed.includes(f));
  const dismissedFlags = redFlags.filter((f) => dismissed.includes(f));

  void assessmentId; // reserved for future use (e.g. GET assessment by assessmentId)

  return (
    <div className="space-y-6">
      {/* Dimension Score Rows */}
      <section aria-label="Dimension scores">
        <h2
          className="font-heading text-base font-semibold mb-3"
          style={{ color: 'var(--mist)' }}
        >
          Dimension breakdown
        </h2>
        <div className="space-y-2">
          {DIMENSION_KEYS.map((key) => {
            const dim = dimScores[key];
            if (!dim) {
              return (
                <div
                  key={key}
                  className="p-4 rounded-lg"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <p className="text-sm" style={{ color: 'var(--sage)' }}>
                    {DIMENSION_LABELS[key]} — not scored
                  </p>
                </div>
              );
            }

            return (
              <DimensionScoreRow
                key={key}
                dimension={DIMENSION_LABELS[key]}
                score={dim.score}
                rationale={dim.evidence}
                confidence={dim.confidence}
                userAnnotation={annotations[key] ?? ''}
                onAnnotationSave={(value) => handleAnnotationSave(key, value)}
              />
            );
          })}
        </div>
      </section>

      {/* Red Flags section */}
      {activeFlags.length > 0 && (
        <section aria-label="Red flags">
          <h2
            className="font-heading text-base font-semibold mb-3"
            style={{ color: 'var(--mist)' }}
          >
            Red flags
          </h2>
          <div className="space-y-3">
            {activeFlags.map((flag, i) => (
              <FlagCard
                key={i}
                title={`Flag ${i + 1}`}
                description={flag}
                onDismiss={() => handleDismiss(flag)}
                dismissed={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Dismissed flags accordion */}
      {dismissedFlags.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--card)' }}
            onClick={() => setDismissedAccordionOpen((prev) => !prev)}
            aria-expanded={dismissedAccordionOpen}
          >
            <span className="text-sm" style={{ color: 'var(--sage)' }}>
              {dismissedFlags.length} dismissed flag{dismissedFlags.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              style={{
                color: 'var(--sage)',
                transform: dismissedAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </button>

          {dismissedAccordionOpen && (
            <div
              style={{
                background: 'var(--card-raised)',
                borderTop: '1px solid var(--border)',
                padding: '12px 16px',
              }}
            >
              <div className="space-y-2">
                {dismissedFlags.map((flag, i) => (
                  <p
                    key={i}
                    className="text-sm italic"
                    style={{ color: 'var(--sage)' }}
                  >
                    {flag}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
