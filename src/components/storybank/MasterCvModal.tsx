'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'storybank_master_cv';

interface MasterCvModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (masterCv: string) => void;
}

export function MasterCvModal({ open, onClose, onSubmit }: MasterCvModalProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-populate from localStorage when modal opens
  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setValue(stored);
    } catch {
      // localStorage unavailable
    }
    // Focus textarea after open animation
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    // Persist to localStorage — never sent to server
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // localStorage unavailable
    }
    onSubmit(trimmed);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-cv-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full max-w-xl rounded-xl shadow-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between p-5 pb-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h2
                id="master-cv-title"
                className="font-heading text-lg font-semibold"
                style={{ color: 'var(--mist)' }}
              >
                Paste your master CV
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--sage)' }}>
                This helps us tailor the generated CV to your existing format and content.
                Stays in your browser — never sent to the server.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 shrink-0 p-1 rounded-md"
              style={{ color: 'var(--sage)' }}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste the full text of your existing CV here…"
              rows={10}
              className="w-full rounded-lg text-sm resize-none focus:outline-none"
              style={{
                minHeight: '200px',
                background: 'var(--card-raised)',
                border: '1px solid var(--border)',
                color: 'var(--mist)',
                padding: '12px',
                lineHeight: '1.6',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--amber)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ color: 'var(--sage)', background: 'transparent' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md text-sm font-semibold"
                style={{ background: 'var(--copper)', color: '#111a24' }}
              >
                Use this CV
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
