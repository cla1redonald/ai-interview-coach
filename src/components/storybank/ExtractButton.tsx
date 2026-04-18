'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';

interface ExtractButtonProps {
  transcriptId: string;
  alreadyExtracted: boolean;
}

export function ExtractButton({ transcriptId, alreadyExtracted }: ExtractButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_id: transcriptId,
          force: alreadyExtracted,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Extraction failed' }));
        setError(data.error ?? 'Extraction failed');
        return;
      }

      router.push(`/transcripts/${transcriptId}/review`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleExtract}
        disabled={loading}
        className="flex items-center gap-2 px-4 rounded-md text-sm font-medium transition-opacity"
        style={{
          height: '40px',
          background: loading ? 'var(--sage)' : 'var(--primary)',
          color: 'var(--primary-foreground)',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        aria-live="polite"
        aria-label={loading ? 'Extracting Q&A pairs, please wait' : 'Extract Q&A pairs from this transcript'}
      >
        {loading ? (
          <>
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            Extracting Q&amp;A…
          </>
        ) : (
          <>
            <Zap size={16} strokeWidth={1.5} />
            {alreadyExtracted ? 'Re-extract Q&A' : 'Extract Q&A'}
          </>
        )}
      </button>

      {loading && (
        <p className="text-xs" style={{ color: 'var(--sage)' }}>
          This may take 15–30 seconds for long transcripts
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--quality-weak)' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
