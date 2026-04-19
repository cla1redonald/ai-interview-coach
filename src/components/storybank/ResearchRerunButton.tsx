'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, RefreshCw } from 'lucide-react';

interface ResearchRerunButtonProps {
  jobId: string;
}

export function ResearchRerunButton({ jobId }: ResearchRerunButtonProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRerun() {
    setLoading(true);
    setConfirming(false);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/applications/${jobId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="p-1.5 rounded-md"
        style={{ color: 'var(--sage)', border: '1px solid var(--border)' }}
        aria-label="Application options"
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      {menuOpen && !confirming && (
        <div
          className="absolute right-0 top-8 w-44 rounded-lg z-20 py-1"
          style={{ background: 'var(--card-raised)', border: '1px solid var(--border)' }}
        >
          <button
            type="button"
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left"
            style={{ color: 'var(--mist)' }}
            onClick={() => {
              setMenuOpen(false);
              setConfirming(true);
            }}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            Re-research
          </button>
        </div>
      )}

      {confirming && (
        <div
          className="absolute right-0 top-8 w-64 rounded-lg z-20 p-4"
          style={{ background: 'var(--card-raised)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--mist)' }}>
            Re-run research? This will overwrite the current results.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRerun}
              disabled={loading}
              className="flex-1 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--copper)', color: '#111a24' }}
            >
              {loading ? 'Running…' : 'Re-research'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded text-xs"
              style={{ color: 'var(--sage)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close menu */}
      {(menuOpen || confirming) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setMenuOpen(false);
            setConfirming(false);
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
