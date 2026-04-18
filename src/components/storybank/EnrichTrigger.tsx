'use client';

import { useEffect, useState } from 'react';

export function EnrichTrigger({ transcriptId }: { transcriptId: string }) {
  const [status, setStatus] = useState<'idle' | 'enriching' | 'done' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    async function enrich() {
      setStatus('enriching');
      try {
        const res = await fetch('/api/extract/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript_id: transcriptId }),
        });

        if (cancelled) return;

        if (res.ok) {
          setStatus('done');
        } else {
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    enrich();
    return () => { cancelled = true; };
  }, [transcriptId]);

  if (status === 'enriching') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs"
        style={{
          background: 'rgba(196, 163, 98, 0.1)',
          border: '1px solid rgba(196, 163, 98, 0.2)',
          color: 'var(--copper)',
        }}
      >
        <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
        Enriching tags &amp; consistency...
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div
        className="px-3 py-1.5 rounded-md text-xs"
        style={{ color: 'var(--sage)' }}
      >
        Tags &amp; consistency enriched — reload to see updates
      </div>
    );
  }

  return null;
}
