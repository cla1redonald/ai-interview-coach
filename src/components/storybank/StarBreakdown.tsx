'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Save } from 'lucide-react';

interface StarFields {
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  starReflection: string;
}

interface StarBreakdownProps {
  exampleId: string;
  initial: StarFields;
  onSave: (fields: StarFields) => Promise<void>;
}

const FIELD_CONFIG: { key: keyof StarFields; label: string; hint: string }[] = [
  { key: 'starSituation', label: 'Situation', hint: 'The context and background' },
  { key: 'starTask',      label: 'Task',      hint: 'What was required or the challenge faced' },
  { key: 'starAction',    label: 'Action',    hint: 'What you specifically did' },
  { key: 'starResult',    label: 'Result',    hint: 'The outcome, ideally with metrics' },
  { key: 'starReflection', label: 'Reflection', hint: 'What did you learn? What would you do differently?' },
];

export function StarBreakdown({ exampleId, initial, onSave }: StarBreakdownProps) {
  const [fields, setFields] = useState<StarFields>(initial);
  const [breaking, setBreaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasContent = Object.values(fields).some(v => v.trim());
  const isDirty = JSON.stringify(fields) !== JSON.stringify(initial);

  async function handleBreakdown() {
    setBreaking(true);
    setError(null);
    try {
      const res = await fetch(`/api/examples/${exampleId}/breakdown`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Breakdown failed');
      }
      const data = await res.json();
      setFields({
        starSituation:  data.situation ?? '',
        starTask:       data.task ?? '',
        starAction:     data.action ?? '',
        starResult:     data.result ?? '',
        starReflection: data.reflection ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBreaking(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSave(fields);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-heading text-sm font-semibold" style={{ color: 'var(--mist)' }}>
          STAR + Reflection
        </h4>
        <button
          type="button"
          onClick={handleBreakdown}
          disabled={breaking || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--amber-faint)',
            border: '1px solid var(--amber)',
            color: 'var(--amber)',
          }}
          aria-label="Break down answer with AI"
        >
          {breaking ? (
            <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Sparkles size={13} strokeWidth={1.5} />
          )}
          {breaking ? 'Breaking down...' : hasContent ? 'Re-run AI' : 'Break down with AI'}
        </button>
      </div>

      {error && (
        <p className="text-xs px-2 py-1 rounded" style={{ color: '#a04040', background: 'rgba(160,64,64,0.1)', border: '1px solid rgba(160,64,64,0.3)' }}>
          {error}
        </p>
      )}

      {/* STAR fields */}
      {FIELD_CONFIG.map(({ key, label, hint }) => (
        <div key={key} className="space-y-1">
          <label
            htmlFor={`star-${exampleId}-${key}`}
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--amber)' }}
          >
            {label}
          </label>
          <textarea
            id={`star-${exampleId}-${key}`}
            value={fields[key]}
            onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={hint}
            rows={2}
            className="w-full rounded-md px-3 py-2 text-sm resize-none transition-all"
            style={{
              background: 'var(--card-raised)',
              border: '1px solid var(--border)',
              color: 'var(--mist)',
              caretColor: 'var(--amber)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--amber)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          />
        </div>
      ))}

      {/* Save button */}
      {isDirty && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
            style={{
              background: 'var(--copper)',
              color: '#111a24',
            }}
          >
            {saving ? (
              <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Save size={13} strokeWidth={1.5} />
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saved && (
            <span className="text-xs" style={{ color: 'var(--amber)' }}>Saved</span>
          )}
        </div>
      )}
    </div>
  );
}
