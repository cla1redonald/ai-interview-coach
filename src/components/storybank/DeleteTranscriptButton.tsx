'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteTranscriptButtonProps {
  transcriptId: string;
}

export function DeleteTranscriptButton({ transcriptId }: DeleteTranscriptButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transcripts/${transcriptId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Failed to delete transcript');
        setDeleting(false);
        setConfirming(false);
        return;
      }
      router.push('/transcripts');
    } catch {
      setError('Network error — please try again');
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--mist)' }}>
          Delete this transcript?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            height: '36px',
            background: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
          }}
        >
          {deleting ? (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Trash2 size={14} strokeWidth={1.5} />
          )}
          {deleting ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 rounded-md text-sm transition-colors"
          style={{
            height: '36px',
            background: 'var(--input)',
            color: 'var(--mist)',
            border: '1px solid var(--border)',
          }}
        >
          Cancel
        </button>
        {error && (
          <span className="text-xs" style={{ color: 'var(--destructive)' }}>{error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-4 rounded-md text-sm font-medium transition-colors"
      style={{
        height: '40px',
        background: 'var(--input)',
        color: 'var(--mist)',
        border: '1px solid var(--border)',
      }}
    >
      <Trash2 size={16} strokeWidth={1.5} />
      Delete
    </button>
  );
}
