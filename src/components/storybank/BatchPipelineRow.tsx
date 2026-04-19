'use client';

import { Loader2, Check, X } from 'lucide-react';

interface BatchApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  status: string;
  fitScoreOverall?: number | null;
}

interface BatchPipelineRowProps {
  application: BatchApplication;
  isProcessing: boolean;
  fitThreshold?: number;
}

function fitScoreColor(score: number): string {
  if (score >= 70) return 'var(--amber)';
  if (score >= 50) return 'var(--copper)';
  return 'var(--sage)';
}

export function BatchPipelineRow({
  application,
  isProcessing,
  fitThreshold = 70,
}: BatchPipelineRowProps) {
  const { jobTitle, companyName, status, fitScoreOverall } = application;
  const hasFit = fitScoreOverall !== null && fitScoreOverall !== undefined;
  const isFailed = status === 'failed' || status === 'rejected';
  const isComplete = !isProcessing && status !== 'pending' && status !== 'running';
  const isBelowThreshold = hasFit && (fitScoreOverall as number) < fitThreshold;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Left: company + role */}
      <div className="min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--mist)' }}
        >
          {companyName}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: 'var(--sage)' }}
        >
          {jobTitle}
        </p>
      </div>

      {/* Right: status + score */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {/* Fit score */}
        {hasFit && isComplete && (
          <div className="flex items-center gap-1.5">
            {isBelowThreshold && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(156,163,175,0.1)',
                  color: 'var(--sage)',
                  border: '1px solid var(--border)',
                }}
              >
                Below threshold
              </span>
            )}
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: fitScoreColor(fitScoreOverall as number) }}
            >
              {fitScoreOverall}
            </span>
          </div>
        )}

        {/* Status icon */}
        {isProcessing ? (
          <Loader2
            size={16}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ color: 'var(--amber)' }}
            aria-label="Processing"
          />
        ) : isFailed ? (
          <X
            size={16}
            strokeWidth={2}
            style={{ color: 'var(--sage)' }}
            aria-label="Failed"
          />
        ) : isComplete ? (
          <Check
            size={16}
            strokeWidth={2}
            style={{ color: 'var(--amber)' }}
            aria-label="Complete"
          />
        ) : (
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--border)',
            }}
            aria-label="Pending"
          />
        )}
      </div>
    </div>
  );
}
