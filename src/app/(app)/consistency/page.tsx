'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, AlertTriangle, Loader2 } from 'lucide-react';
import { ConsistencyTimeline } from '@/components/storybank/ConsistencyTimeline';

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

const TOPIC_CONFIG: { topic: ConsistencyTopic; label: string }[] = [
  { topic: 'compensation', label: 'Compensation Expectations' },
  { topic: 'leaving_reason', label: 'Reasons for Leaving' },
  { topic: 'start_date', label: 'Start Date / Availability' },
  { topic: 'role_scope', label: 'Current Role Scope' },
];

export default function ConsistencyPage() {
  const [byTopic, setByTopic] = useState<Record<ConsistencyTopic, ConsistencyEntry[]>>({
    compensation: [],
    leaving_reason: [],
    start_date: [],
    role_scope: [],
  });
  const [conflicts, setConflicts] = useState<ConsistencyConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const totalEntries = Object.values(byTopic).reduce((sum, arr) => sum + arr.length, 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch entries and run contradiction check in parallel
      const [entriesRes, checkRes] = await Promise.all([
        fetch('/api/consistency'),
        fetch('/api/consistency/check', { method: 'POST' }),
      ]);

      if (!entriesRes.ok) throw new Error('Failed to load entries');
      const entriesData = await entriesRes.json();

      setByTopic(
        entriesData.by_topic ?? {
          compensation: [],
          leaving_reason: [],
          start_date: [],
          role_scope: [],
        }
      );

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        setConflicts(checkData.conflicts ?? []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load consistency data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleEntryDeleted(id: string) {
    setByTopic(prev => {
      const next = { ...prev } as Record<ConsistencyTopic, ConsistencyEntry[]>;
      for (const topic of Object.keys(next) as ConsistencyTopic[]) {
        next[topic] = next[topic].filter(e => e.id !== id);
      }
      return next;
    });
    // Re-run contradiction check after deletion
    runCheck();
  }

  function handleEntryAdded(entry: ConsistencyEntry) {
    const topic = entry.topic;
    setByTopic(prev => ({
      ...prev,
      [topic]: [entry, ...prev[topic]],
    }));
    // Re-run contradiction check after addition
    runCheck();
  }

  async function runCheck() {
    setChecking(true);
    try {
      const res = await fetch('/api/consistency/check', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setConflicts(data.conflicts ?? []);
      }
    } catch {
      // Non-fatal — contradiction check failing doesn't break the page
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h1
          className="font-heading text-3xl font-bold mb-2"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Consistency Tracker
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--sage)' }}>
          What you&apos;ve told each company.
        </p>
        <div
          className="flex items-center gap-3 p-8 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          aria-busy="true"
          aria-label="Loading consistency data"
        >
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <span className="text-sm" style={{ color: 'var(--sage)' }}>
            Loading claims and checking for contradictions…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <h1
          className="font-heading text-3xl font-bold mb-2"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Consistency Tracker
        </h1>
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--destructive)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (totalEntries === 0) {
    return (
      <div className="max-w-3xl">
        <h1
          className="font-heading text-3xl font-bold mb-2"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Consistency Tracker
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--sage)' }}>
          What you&apos;ve told each company.
        </p>
        <div
          className="flex flex-col items-center justify-center gap-4 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <GitBranch size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
            No claims tracked yet
          </p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--sage)' }}>
            Upload and extract transcripts to start tracking consistency. Claims are extracted
            automatically, or you can add them manually using the buttons below.
          </p>
        </div>

        {/* Still show the topic sections so users can add manual entries */}
        <div className="mt-8 space-y-8">
          {TOPIC_CONFIG.map(({ topic, label }) => (
            <ConsistencyTimeline
              key={topic}
              topic={topic}
              label={label}
              entries={byTopic[topic]}
              conflicts={conflicts}
              onEntryDeleted={handleEntryDeleted}
              onEntryAdded={handleEntryAdded}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-2"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Consistency Tracker
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            What you&apos;ve told each company.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {checking && (
            <Loader2
              size={14}
              strokeWidth={1.5}
              className="animate-spin"
              style={{ color: 'var(--sage)' }}
            />
          )}
          <span className="text-xs font-mono" style={{ color: 'var(--sage)' }}>
            {totalEntries} claim{totalEntries !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Contradiction summary banner */}
      {conflicts.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg px-4 py-3 mb-6"
          style={{
            background: 'rgba(226,160,57,0.08)',
            border: '1px solid var(--amber)',
          }}
        >
          <AlertTriangle size={16} strokeWidth={1.5} style={{ color: 'var(--amber)' }} />
          <p className="text-sm" style={{ color: 'var(--mist)' }}>
            <span className="font-medium">{conflicts.length} contradiction{conflicts.length !== 1 ? 's' : ''} flagged</span>
            {' '}— review the sections below before your next interview.
          </p>
        </div>
      )}

      {/* Topic sections */}
      <div>
        {TOPIC_CONFIG.map(({ topic, label }) => (
          <ConsistencyTimeline
            key={topic}
            topic={topic}
            label={label}
            entries={byTopic[topic]}
            conflicts={conflicts}
            onEntryDeleted={handleEntryDeleted}
            onEntryAdded={handleEntryAdded}
          />
        ))}
      </div>
    </div>
  );
}
