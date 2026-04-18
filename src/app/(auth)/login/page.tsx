import { signIn } from '@/lib/auth';

export const metadata = {
  title: 'Sign in — StoryBank',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
    OAuthCallbackError: 'Could not complete sign in. Please try again.',
    Default: 'Something went wrong. Please try again.',
  };

  const errorMessage = searchParams.error
    ? (errorMessages[searchParams.error] ?? errorMessages.Default)
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--ink)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2 mb-8">
          <span style={{ color: 'var(--amber)', fontSize: '12px' }}>◆</span>
          <span
            className="font-heading font-semibold text-base tracking-tight"
            style={{ color: 'var(--mist)' }}
          >
            StoryBank
          </span>
        </div>

        <h1
          className="font-heading text-2xl font-bold mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Sign in
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--sage)' }}>
          Sign in with your Google account to get started.
        </p>

        {errorMessage && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-sm"
            style={{
              background: 'rgba(196, 90, 42, 0.12)',
              border: '1px solid var(--contradiction)',
              color: 'var(--mist)',
            }}
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="w-full py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 flex items-center justify-center gap-2"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        <p className="mt-6 text-xs text-center" style={{ color: 'var(--sage)' }}>
          No account needed — we create one automatically on first sign in.
        </p>
      </div>
    </div>
  );
}
