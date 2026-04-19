'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        background: '#0a0f1a',
        color: '#d4dce4',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <p style={{ color: '#e2a039', fontSize: '14px', marginBottom: '8px' }}>Something went wrong</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
            StoryBank encountered an error
          </h1>
          <p style={{ color: '#8a9a9a', fontSize: '14px', marginBottom: '24px' }}>
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#e2a039',
              color: '#0a0f1a',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
