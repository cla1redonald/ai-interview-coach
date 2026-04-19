import { Globe, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export default async function ResearchPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const apps = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        isNotNull(jobApplications.researchedAt)
      )
    )
    .orderBy(jobApplications.createdAt);

  // Reverse for most-recent-first
  const sorted = [...apps].reverse();

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Company Research
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Structured intelligence for every role you&apos;re considering.
          </p>
        </div>
        <Link
          href="/research/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium"
          style={{ background: 'var(--copper)', color: '#111a24' }}
        >
          <Plus size={15} strokeWidth={2} />
          New research
        </Link>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-14 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Globe size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <p
              className="font-heading text-xl font-semibold mb-2"
              style={{ color: 'var(--mist)' }}
            >
              No company research yet
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
              Research a company before your application to understand their stage,
              culture, and recent news.
            </p>
          </div>
          <Link
            href="/research/new"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            Research a company
          </Link>
        </div>
      )}

      {/* Research list */}
      {sorted.length > 0 && (
        <section aria-label="Research list" className="space-y-3">
          {sorted.map((app) => {
            const descriptor = [app.location, app.status === 'researching' ? null : app.status]
              .filter(Boolean)
              .join(' · ');

            const researchedDate = app.researchedAt
              ? new Date(app.researchedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : null;

            return (
              <div
                key={app.id}
                className="p-4 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3
                      className="font-heading text-base font-semibold"
                      style={{ color: 'var(--mist)' }}
                    >
                      {app.companyName}
                    </h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--mist)', opacity: 0.7 }}>
                      {app.jobTitle}
                    </p>
                    {descriptor && (
                      <p className="text-xs mt-1" style={{ color: 'var(--sage)' }}>
                        {descriptor}
                      </p>
                    )}
                    {researchedDate && (
                      <p className="text-xs mt-1" style={{ color: 'var(--sage)' }}>
                        Researched {researchedDate}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <Link
                      href={`/research/${app.id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--copper)' }}
                    >
                      View research →
                    </Link>
                    <Link
                      href={app.assessedAt ? `/fit/${app.id}` : `/fit/new?job_id=${app.id}`}
                      className="text-sm font-medium"
                      style={{ color: app.assessedAt ? 'var(--copper)' : 'var(--amber)' }}
                    >
                      {app.assessedAt ? 'View fit assessment →' : 'Start fit assessment →'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
