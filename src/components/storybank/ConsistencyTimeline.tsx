'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Trash2, X, Check, ExternalLink } from 'lucide-react';

type ConsistencyTopic = 'compensation' | 'leaving_reason' | 'start_date' | 'role_scope';

interface ConsistencyEntry {
  id: string;
  userId: string;
  exampleId: string | null;
  company: string;
  topic: ConsistencyTopic;
  claim: string;
  interviewDate: string | null;
  createdAt: string;
}

interface ConsistencyConflict {
  topic: ConsistencyTopic;
  entries: ConsistencyEntry[];
  conflict_description: string;
}

interface ConsistencyTimelineProps {
  topic: ConsistencyTopic;
  label: string;
  entries: ConsistencyEntry[];
  conflicts: ConsistencyConflict[];
  onEntryDeleted: (id: string) => void;
  onEntryAdded: (entry: ConsistencyEntry) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function isConflictingEntry(
  entry: ConsistencyEntry,
  conflicts: ConsistencyConflict[]
): boolean {
  return conflicts.some(
    c => c.topic === entry.topic && c.entries.some(e => e.id === entry.id)
  );
}

interface AddClaimFormProps {
  topic: ConsistencyTopic;
  onAdded: (entry: ConsistencyEntry) => void;
  onCancel: () => void;
}

function AddClaimForm({ topic, onAdded, onCancel }: AddClaimFormProps) {
  const [company, setCompany] = useState('');
  const [claim, setClaim] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !claim.trim()) {
      setError('Company and claim are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          topic,
          claim: claim.trim(),
          interviewDate: interviewDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save claim.');
        return;
      }
      const data = await res.json();
      onAdded(data.entry as ConsistencyEntry);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg p-4 mt-2"
      style={{
        background: 'var(--card-raised)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--sage)' }}
            >
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Airbox"
              className="w-full rounded px-3 py-2 text-sm"
              style={{
                background: 'var(--input)',
                border: '1px solid var(--border)',
                color: 'var(--mist)',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--amber)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div className="w-40">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--sage)' }}
            >
              Interview date
            </label>
            <input
              type="date"
              value={interviewDate}
              onChange={e => setInterviewDate(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm"
              style={{
                background: 'var(--input)',
                border: '1px solid var(--border)',
                color: 'var(--mist)',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--amber)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>
        <div>
          <label
            className="block text-xs font-semibold mb-1"
            style={{ color: 'var(--sage)' }}
          >
            What you said
          </label>
          <textarea
            value={claim}
            onChange={e => setClaim(e.target.value)}
            placeholder="e.g. £175k floor, open to equity discussion"
            rows={2}
            className="w-full rounded px-3 py-2 text-sm resize-none"
            style={{
              background: 'var(--input)',
              border: '1px solid var(--border)',
              color: 'var(--mist)',
              outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--amber)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'var(--destructive)' }}>
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
            style={{ color: 'var(--sage)' }}
          >
            <X size={14} strokeWidth={1.5} />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Check size={14} strokeWidth={1.5} />
            {saving ? 'Saving…' : 'Save claim'}
          </button>
        </div>
      </div>
    </form>
  );
}

interface ClaimRowProps {
  entry: ConsistencyEntry;
  isConflicting: boolean;
  onDelete: (id: string) => void;
}

function ClaimRow({ entry, isConflicting, onDelete }: ClaimRowProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this claim?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/consistency/${entry.id}`, { method: 'DELETE' });
      onDelete(entry.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Conflict marker */}
      <div className="w-5 flex-shrink-0 pt-0.5">
        {isConflicting && (
          <AlertTriangle
            size={14}
            strokeWidth={1.5}
            aria-label="Contradicted claim"
            style={{ color: 'var(--amber)' }}
          />
        )}
      </div>

      {/* Company */}
      <div className="w-32 flex-shrink-0">
        <span
          className="inline-block text-sm font-medium truncate"
          style={{ color: 'var(--mist)' }}
          title={entry.company}
        >
          {entry.company}
        </span>
      </div>

      {/* Claim text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--mist)' }}
        >
          {entry.claim}
        </p>
        {entry.exampleId && (
          <a
            href={`/examples?highlight=${entry.exampleId}`}
            className="inline-flex items-center gap-1 text-xs mt-1"
            style={{ color: 'var(--copper)' }}
          >
            <ExternalLink size={11} strokeWidth={1.5} />
            Source example
          </a>
        )}
      </div>

      {/* Date */}
      <div className="w-24 flex-shrink-0 text-right">
        <span className="text-xs" style={{ color: 'var(--sage)' }}>
          {formatDate(entry.interviewDate)}
        </span>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete claim"
        className="flex-shrink-0 p-1 rounded opacity-40 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--destructive)' }}
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function ConsistencyTimeline({
  topic,
  label,
  entries,
  conflicts,
  onEntryDeleted,
  onEntryAdded,
}: ConsistencyTimelineProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<ConsistencyTopic>>(new Set());

  const topicConflicts = conflicts.filter(c => c.topic === topic);
  const hasUndismissedConflict =
    topicConflicts.length > 0 && !dismissedConflicts.has(topic);

  function handleDismissConflict() {
    setDismissedConflicts(prev => { const s = new Set(prev); s.add(topic); return s; });
  }

  return (
    <section
      aria-labelledby={`topic-${topic}`}
      className="mb-8"
    >
      {/* Topic header */}
      <div className="flex items-center justify-between mb-3">
        <h2
          id={`topic-${topic}`}
          className="font-heading text-lg font-semibold"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          {label}
        </h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
          style={{
            color: 'var(--copper)',
            border: '1px solid var(--border)',
          }}
        >
          <Plus size={14} strokeWidth={1.5} />
          Add claim
        </button>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', marginBottom: '8px' }} />

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--sage)' }}>
          No {label.toLowerCase()} claims recorded yet.
        </p>
      ) : (
        <div role="list" aria-label={`${label} claims`}>
          {entries.map(entry => (
            <ClaimRow
              key={entry.id}
              entry={entry}
              isConflicting={isConflictingEntry(entry, topicConflicts)}
              onDelete={onEntryDeleted}
            />
          ))}
        </div>
      )}

      {/* Contradiction banner */}
      {hasUndismissedConflict && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg p-4 mt-3"
          style={{
            borderLeft: '3px solid var(--amber)',
            background: 'rgba(226,160,57,0.07)',
          }}
        >
          <AlertTriangle
            size={16}
            strokeWidth={1.5}
            className="flex-shrink-0 mt-0.5"
            style={{ color: 'var(--amber)' }}
          />
          <div className="flex-1 min-w-0">
            {topicConflicts.map((conflict, i) => (
              <p key={i} className="text-sm" style={{ color: 'var(--mist)' }}>
                <span className="font-medium">Contradiction flagged:</span>{' '}
                {conflict.conflict_description} Review before next interview.
              </p>
            ))}
          </div>
          <button
            onClick={handleDismissConflict}
            className="flex-shrink-0 text-xs px-2 py-1 rounded"
            style={{ color: 'var(--sage)', border: '1px solid var(--border)' }}
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Add claim form */}
      {showAddForm && (
        <AddClaimForm
          topic={topic}
          onAdded={entry => {
            onEntryAdded(entry);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </section>
  );
}
