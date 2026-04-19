import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/storybank/AppSidebar';

// Server Component — fetches session, guards the route, passes user to sidebar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Skip to main content — visible on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1 focus:rounded focus:text-sm"
        style={{ background: 'var(--amber)', color: '#111a24' }}
      >
        Skip to main content
      </a>

      <AppSidebar
        userEmail={session.user.email ?? ''}
        userName={session.user.name ?? ''}
        signOutAction={handleSignOut}
      />

      <main
        id="main-content"
        className="flex-1 min-h-screen"
      >
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
