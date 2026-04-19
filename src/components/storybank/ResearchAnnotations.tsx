'use client';

import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface ResearchAnnotationsProps {
  jobId: string;
  initialNotes: string;
}

export function ResearchAnnotations({ jobId, initialNotes }: ResearchAnnotationsProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [savedMsg, setSavedMsg] = useState(false);
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setUndoValue(notes);
    setNotes(value);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/applications/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: value }),
        });
        setSavedMsg(true);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
          setSavedMsg(false);
          setUndoValue(null);
        }, 5000);
      } catch {
        // Silent failure — user can retry
      }
    }, 800);
  }

  function handleUndo() {
    if (undoValue !== null) {
      setNotes(undoValue);
      setUndoValue(null);
      setSavedMsg(false);
    }
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--card)' }}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
          My notes
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          style={{
            color: 'var(--sage)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            background: 'var(--card-raised)',
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
          }}
        >
          <textarea
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Add your thoughts, questions, or context about this company…"
            rows={5}
            className="w-full rounded-md text-sm resize-y"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--mist)',
              padding: '8px 10px',
              outline: 'none',
            }}
          />
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-xs" style={{ color: 'var(--sage)', flex: 1 }}>
              {savedMsg ? 'Saved automatically' : ' '}
            </p>
            {savedMsg && undoValue !== null && (
              <button
                type="button"
                onClick={handleUndo}
                className="text-xs"
                style={{ color: 'var(--copper)' }}
              >
                Undo last change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
