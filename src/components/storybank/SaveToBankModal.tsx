'use client';

import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import type { QAPair } from '@/lib/practice-utils';

interface SaveToBankModalProps {
  pairs: QAPair[];
  focusTopic?: string | null;
  onClose: () => void;
  onSaved: (count: number) => void;
}

export function SaveToBankModal({ pairs, focusTopic, onClose, onSaved }: SaveToBankModalProps) {
  const [selections, setSelections] = useState<Map<number, boolean>>(
    new Map(pairs.map((p, i) => [i, p.autoSelected]))
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedAnswers, setEditedAnswers] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const selectedCount = Array.from(selections.values()).filter(Boolean).length;

  const toggle = (index: number) => {
    setSelections(prev => {
      const next = new Map(prev);
      next.set(index, !prev.get(index));
      return next;
    });
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);

    const toSave = pairs.filter((_, i) => selections.get(i));
    let savedCount = 0;

    for (const pair of toSave) {
      const index = pairs.indexOf(pair);
      const answer = editedAnswers.get(index) ?? pair.answer;

      try {
        const res = await fetch('/api/examples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: pair.question,
            answer,
            transcriptId: null,
            qualityRating: null,
          }),
        });

        if (res.ok) {
          savedCount++;
        } else {
          console.error('Failed to save example:', await res.text());
        }
      } catch (err) {
        console.error('Save error:', err);
      }
    }

    if (savedCount === 0) {
      setError('Save failed — please try again');
      setSaving(false);
      savingRef.current = false;
      return;
    }

    savingRef.current = false;
    onSaved(savedCount);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] max-h-[80vh] overflow-y-auto rounded-lg p-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2
            id="save-modal-title"
            className="font-heading text-lg font-semibold"
            style={{ color: 'var(--mist)' }}
          >
            Save practice answers
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded"
            style={{ color: 'var(--sage)' }}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
          Select the answers worth keeping:
        </p>

        {/* Q&A pairs */}
        <div className="space-y-3 mb-4">
          {pairs.map((pair, i) => (
            <div
              key={i}
              className="p-3 rounded-md"
              style={{
                background: selections.get(i) ? 'var(--amber-faint)' : 'transparent',
                border: `1px solid ${selections.get(i) ? 'var(--amber)' : 'var(--border)'}`,
              }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selections.get(i) ?? false}
                  onChange={() => toggle(i)}
                  className="mt-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--sage)' }}>
                    Q: {pair.question.length > 120 ? pair.question.slice(0, 120) + '...' : pair.question}
                  </p>
                  {editingIndex === i ? (
                    <textarea
                      className="w-full min-h-[80px] p-2 rounded text-sm"
                      style={{
                        background: 'var(--ink)',
                        color: 'var(--mist)',
                        border: '1px solid var(--border)',
                      }}
                      value={editedAnswers.get(i) ?? pair.answer}
                      onChange={(e) => {
                        setEditedAnswers(prev => {
                          const next = new Map(prev);
                          next.set(i, e.target.value);
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--mist)' }}>
                      A:{' '}
                      {(editedAnswers.get(i) ?? pair.answer).length > 200
                        ? (editedAnswers.get(i) ?? pair.answer).slice(0, 200) + '...'
                        : (editedAnswers.get(i) ?? pair.answer)}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-xs mt-1"
                    style={{ color: 'var(--amber)' }}
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingIndex(editingIndex === i ? null : i);
                    }}
                  >
                    {editingIndex === i ? 'Done editing' : 'Edit answer'}
                  </button>
                </div>
              </label>
            </div>
          ))}
        </div>

        {/* Focus tag indicator */}
        {focusTopic && (
          <p className="text-xs mb-3" style={{ color: 'var(--sage)' }}>
            All saved answers will be tagged:{' '}
            <span style={{ color: 'var(--amber)' }}>Practice session</span>
            {' · '}
            <span style={{ color: 'var(--amber)' }}>{focusTopic}</span>
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm mb-3" style={{ color: 'var(--contradiction)' }}>
            {error}
          </p>
        )}

        {/* Count + save */}
        <div className="flex items-center justify-end gap-3" aria-live="polite">
          <span className="text-sm" style={{ color: 'var(--sage)' }}>
            {selectedCount} answer{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm"
            style={{ color: 'var(--sage)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedCount === 0 || saving}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--amber)',
              color: 'var(--ink)',
            }}
          >
            {saving ? 'Saving...' : `Save ${selectedCount} answer${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}
