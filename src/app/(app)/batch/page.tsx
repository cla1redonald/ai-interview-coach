'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, FileText, Loader2 } from 'lucide-react';
import { MasterCvModal } from '@/components/storybank/MasterCvModal';
import { BatchPipelineRow } from '@/components/storybank/BatchPipelineRow';
import { BatchResultsTable } from '@/components/storybank/BatchResultsTable';
import type { JobApplication, MaterialType } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  jobTitle: string;
  companyName: string;
  /** Toggle: 'url' | 'text' */
  inputMode: 'url' | 'text';
  jobUrl: string;
  jobDescription: string;
}

interface BatchStatusApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  status: string;
  fitScoreOverall: number | null;
  materialsGenerated?: MaterialType[];
}

interface BatchStatusResponse {
  batch: {
    id: string;
    status: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    remaining: number;
  };
  applications: BatchStatusApplication[];
}

type PageView = 'input' | 'pipeline' | 'results';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _rowCounter = 0;
function newRow(): JobRow {
  _rowCounter += 1;
  return {
    id: `row-${_rowCounter}`,
    jobTitle: '',
    companyName: '',
    inputMode: 'url',
    jobUrl: '',
    jobDescription: '',
  };
}

/**
 * Serialise job rows into the batch markdown format.
 *
 * Format per spec:
 *   ## [Job Title] — [Company Name]
 *   [URL or pasted JD]
 */
export function serializeRowsToMarkdown(rows: JobRow[]): string {
  return rows
    .filter((r) => r.jobTitle.trim())
    .map((r) => {
      const heading = r.companyName.trim()
        ? `## ${r.jobTitle.trim()} — ${r.companyName.trim()}`
        : `## ${r.jobTitle.trim()}`;

      const content =
        r.inputMode === 'url' ? r.jobUrl.trim() : r.jobDescription.trim();

      return content ? `${heading}\n${content}` : heading;
    })
    .join('\n\n');
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BatchPage() {
  const [view, setView] = useState<PageView>('input');
  const [rows, setRows] = useState<JobRow[]>([newRow()]);
  const [masterCvModalOpen, setMasterCvModalOpen] = useState(false);
  const [masterCv, setMasterCv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Batch pipeline state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ─── Row management ─────────────────────────────────────────────────────────

  function addRow() {
    if (rows.length >= 10) return;
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<Omit<JobRow, 'id'>>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const canStart = rows.some((r) => r.jobTitle.trim().length > 0) && !submitting;

  // ─── Submit batch ────────────────────────────────────────────────────────────

  async function handleStartBatch() {
    setSubmitting(true);
    setSubmitError(null);

    const markdown = serializeRowsToMarkdown(rows);

    try {
      const body: Record<string, unknown> = { markdown };
      if (masterCv) body.masterCv = masterCv;

      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? 'Failed to start batch.');
        return;
      }

      const data = await res.json() as { batchId?: string; batch?: { id: string } };
      const id = data.batchId ?? data.batch?.id ?? null;
      if (!id) {
        setSubmitError('Invalid response from server.');
        return;
      }

      setBatchId(id);
      setView('pipeline');
      startPolling(id);
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Poll batch status ───────────────────────────────────────────────────────

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    async function poll() {
      try {
        const res = await fetch(`/api/batch/${id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!res.ok) return;

        const data = await res.json() as BatchStatusResponse;
        setBatchStatus(data);

        if (data.batch.remaining === 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          setView('results');
        }
      } catch {
        // Network error — keep polling
      }
    }

    void poll(); // immediate first poll
    pollRef.current = setInterval(() => void poll(), 3000);
  }, []);

  // ─── Input view ─────────────────────────────────────────────────────────────

  if (view === 'input') {
    return (
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Batch Apply
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Add up to 10 job listings and we&apos;ll research, assess, and generate materials for each.
          </p>
        </div>

        {/* Job rows */}
        <div className="space-y-4 mb-6">
          {rows.map((row, idx) => (
            <JobRowForm
              key={row.id}
              row={row}
              index={idx}
              canRemove={rows.length > 1}
              onUpdate={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </div>

        {/* Add row */}
        {rows.length < 10 && (
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium mb-6 w-full justify-center"
            style={{
              background: 'var(--card)',
              border: '1px dashed var(--border)',
              color: 'var(--sage)',
            }}
          >
            <Plus size={15} strokeWidth={2} />
            Add another listing
          </button>
        )}

        {/* Error */}
        {submitError && (
          <div
            className="px-4 py-3 rounded-lg mb-4 text-sm"
            style={{
              background: 'rgba(196,90,42,0.08)',
              border: '1px solid var(--copper)',
              color: 'var(--mist)',
            }}
          >
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMasterCvModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: masterCv ? 'var(--amber)' : 'var(--sage)',
            }}
          >
            <FileText size={15} strokeWidth={1.5} />
            {masterCv ? 'Master CV pasted' : 'Paste master CV'}
          </button>

          <button
            type="button"
            onClick={() => void handleStartBatch()}
            disabled={!canStart}
            className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-semibold"
            style={{
              background: canStart ? 'var(--copper)' : 'var(--border)',
              color: canStart ? '#111a24' : 'var(--sage)',
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />
                Starting…
              </>
            ) : (
              'Start batch'
            )}
          </button>
        </div>

        {/* Master CV modal */}
        <MasterCvModal
          open={masterCvModalOpen}
          onClose={() => setMasterCvModalOpen(false)}
          onSubmit={(cv) => setMasterCv(cv)}
        />
      </div>
    );
  }

  // ─── Pipeline view ───────────────────────────────────────────────────────────

  if (view === 'pipeline') {
    const total = batchStatus?.batch.totalJobs ?? rows.filter((r) => r.jobTitle.trim()).length;
    const completed = batchStatus?.batch.completedJobs ?? 0;
    const failed = batchStatus?.batch.failedJobs ?? 0;
    const pct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
    const pipelineApps = batchStatus?.applications ?? rows
      .filter((r) => r.jobTitle.trim())
      .map((r, i) => ({
        id: `pending-${i}`,
        jobTitle: r.jobTitle,
        companyName: r.companyName,
        status: 'pending',
        fitScoreOverall: null,
      }));

    return (
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Processing batch…
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Researching, assessing, and generating materials for each role.
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--sage)' }}>
            <span>{completed} of {total} complete</span>
            <span>{pct}%</span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '6px', background: 'var(--border)' }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'var(--amber)',
                borderRadius: '9999px',
                transition: 'width 400ms ease',
              }}
            />
          </div>
        </div>

        {/* Pipeline rows */}
        <div className="space-y-2">
          {pipelineApps.map((app) => (
            <BatchPipelineRow
              key={app.id}
              application={app}
              isProcessing={app.status === 'running' || app.status === 'pending'}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Results view ────────────────────────────────────────────────────────────

  const resultApps: (JobApplication & { materialsGenerated?: MaterialType[] })[] =
    (batchStatus?.applications ?? []).map((a) => ({
      id: a.id,
      userId: '',
      jobTitle: a.jobTitle,
      companyName: a.companyName,
      jobUrl: null,
      jobDescription: '',
      salary: null,
      location: null,
      researchedAt: null,
      assessedAt: null,
      materialsAt: null,
      fitScoreOverall: a.fitScoreOverall,
      fitArchetype: null,
      status: a.status as JobApplication['status'],
      notes: null,
      batchId: batchId,
      createdAt: '',
      updatedAt: '',
      materialsGenerated: a.materialsGenerated,
    }));

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1
          className="font-heading text-3xl font-bold mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Batch complete
        </h1>
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          {resultApps.length} role{resultApps.length !== 1 ? 's' : ''} processed.
        </p>
      </div>

      <BatchResultsTable
        applications={resultApps}
        fitThreshold={70}
      />
    </div>
  );
}

// ─── Job Row Form ─────────────────────────────────────────────────────────────

interface JobRowFormProps {
  row: JobRow;
  index: number;
  canRemove: boolean;
  onUpdate: (patch: Partial<Omit<JobRow, 'id'>>) => void;
  onRemove: () => void;
}

function JobRowForm({ row, index, canRemove, onUpdate, onRemove }: JobRowFormProps) {
  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--card-raised)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--mist)',
    fontSize: '0.875rem',
    outline: 'none',
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Row header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--sage)' }}
        >
          Listing {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded"
            style={{ color: 'var(--sage)' }}
            aria-label={`Remove listing ${index + 1}`}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Job title (required) + Company name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label
            htmlFor={`job-title-${row.id}`}
            className="block text-xs mb-1 font-medium"
            style={{ color: 'var(--sage)' }}
          >
            Job title <span style={{ color: 'var(--copper)' }}>*</span>
          </label>
          <input
            id={`job-title-${row.id}`}
            type="text"
            value={row.jobTitle}
            onChange={(e) => onUpdate({ jobTitle: e.target.value })}
            placeholder="e.g. Head of Product"
            required
            style={inputBaseStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>
        <div>
          <label
            htmlFor={`company-${row.id}`}
            className="block text-xs mb-1 font-medium"
            style={{ color: 'var(--sage)' }}
          >
            Company
          </label>
          <input
            id={`company-${row.id}`}
            type="text"
            value={row.companyName}
            onChange={(e) => onUpdate({ companyName: e.target.value })}
            placeholder="e.g. Acme Corp"
            style={inputBaseStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>
      </div>

      {/* Input mode toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => onUpdate({ inputMode: 'url' })}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: row.inputMode === 'url' ? 'var(--amber-faint)' : 'transparent',
            color: row.inputMode === 'url' ? 'var(--amber)' : 'var(--sage)',
            border: row.inputMode === 'url' ? '1px solid var(--amber)' : '1px solid var(--border)',
          }}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ inputMode: 'text' })}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: row.inputMode === 'text' ? 'var(--amber-faint)' : 'transparent',
            color: row.inputMode === 'text' ? 'var(--amber)' : 'var(--sage)',
            border: row.inputMode === 'text' ? '1px solid var(--amber)' : '1px solid var(--border)',
          }}
        >
          Paste JD
        </button>
      </div>

      {/* URL or textarea */}
      {row.inputMode === 'url' ? (
        <input
          type="url"
          value={row.jobUrl}
          onChange={(e) => onUpdate({ jobUrl: e.target.value })}
          placeholder="https://company.com/jobs/123"
          style={inputBaseStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      ) : (
        <textarea
          value={row.jobDescription}
          onChange={(e) => onUpdate({ jobDescription: e.target.value })}
          placeholder="Paste the job description here…"
          rows={4}
          className="resize-none"
          style={{ ...inputBaseStyle }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      )}
    </div>
  );
}
