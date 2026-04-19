'use client';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--ink)' }}>
      <div
        className="max-w-sm w-full p-8 rounded-lg text-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-heading text-lg font-semibold mb-2" style={{ color: 'var(--mist)' }}>
          Login error
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
          {error.message || 'Unable to complete authentication. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 rounded-md text-sm font-medium"
          style={{ background: 'var(--amber)', color: 'var(--ink)' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
