'use client';

import { AlertTriangle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div
        className="p-8 rounded-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <AlertTriangle
          size={32}
          strokeWidth={1.5}
          className="mx-auto mb-4"
          style={{ color: 'var(--amber)' }}
        />
        <h2
          className="font-heading text-xl font-semibold mb-2"
          style={{ color: 'var(--mist)' }}
        >
          Something went wrong
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--sage)' }}>
          {error.message || 'An unexpected error occurred. Your data is safe.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 rounded-md text-sm font-medium transition-colors"
          style={{ background: 'var(--amber)', color: 'var(--ink)' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
